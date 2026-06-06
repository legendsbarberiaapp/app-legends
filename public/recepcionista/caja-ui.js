/**
 * LEGENDS BARBERIA - RECEPCIONISTA: CAJA (F3)
 *
 * Tab "Caja" del rol recepcionista. Muestra:
 *   - Totales del día por método de pago (efectivo / tarjeta / transferencia)
 *   - Total general del día
 *   - Historial de ventas del día (lista ordenada por hora descendente)
 *   - FAB "Venta directa" (overlay cobrar-ui en modo 'directa')
 *
 * Datos: VentasService.listBySedeRange(sedeId, hoy, hoy)
 *
 * Lee la sede de window.recepState (si está cargada) o del user doc.
 */
(function () {
    'use strict';

    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    const METODO_META = {
        efectivo:      { label: 'Efectivo',      icon: 'payments',         color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
        transferencia: { label: 'Transfer.',     icon: 'account_balance',  color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
        deuda:         { label: 'Deuda',         icon: 'schedule',         color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20' }
    };
    const METODOS_ORDEN = ['efectivo', 'transferencia', 'deuda'];

    function todayISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function fechaLargaHoy() {
        const d = new Date();
        return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
    }
    function fmtCOP(n) {
        return (typeof window.formatCOP === 'function') ? window.formatCOP(n || 0) : `$${n || 0}`;
    }
    function getCurrentUser() {
        return (typeof roleManager !== 'undefined') ? roleManager.currentUser : null;
    }
    /** Escapa texto libre (nombres de deudor, notas) para evitar inyección HTML. */
    function esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    const cajaState = {
        sedeId: null,
        sedeNombre: '',
        ventas: [],
        retiros: [],
        deudores: [],      // P7: deudas pendientes agrupadas por cliente
        abonosHoy: [],     // P7: pagos de deuda de hoy (para el efectivo del día)
        deudaById: {},     // P7: ventaId → {clienteId, clienteNombre, total}
        gastos: [],        // P8: gastos en efectivo de hoy
        isAdmin: false,    // admin puede ver/operar la caja de cualquier sede
        sedes: []          // lista de sedes (para el selector del admin)
    };

    async function init() {
        const sub = document.getElementById('caja-sub-label');
        const list = document.getElementById('caja-ventas-list');

        const user = getCurrentUser();
        const isAdmin = !!(user && user.role === 'admin');
        if (!user || (user.role !== 'recepcionista' && !isAdmin)) {
            if (list) list.innerHTML = renderError('Pantalla solo para personal interno');
            return;
        }
        cajaState.isAdmin = isAdmin;

        // Sedes (para el nombre y, si es admin, el selector de sede).
        const sedes = (typeof SedesService !== 'undefined') ? await SedesService.list() : [];
        cajaState.sedes = sedes;

        if (isAdmin) {
            // El admin elige la sede; default la que ya tenía o la primera.
            if (!cajaState.sedeId || !sedes.some(s => s.id === cajaState.sedeId)) {
                cajaState.sedeId = sedes.length ? sedes[0].id : null;
            }
        } else {
            cajaState.sedeId = user.sedeId || null;
        }

        if (!cajaState.sedeId) {
            if (sub) sub.textContent = isAdmin ? 'Sin sedes' : 'Sin sede asignada';
            if (list) list.innerHTML = renderError(isAdmin ? 'No hay sedes configuradas' : 'No tenés sede asignada');
            return;
        }
        cajaState.sedeNombre = (typeof SedesService !== 'undefined')
            ? SedesService.nombreById(sedes, cajaState.sedeId) : '';

        // Para que la venta directa (cobrar-ui) use la sede elegida también cuando
        // es el admin (que no tiene sede propia). Cada venta queda firmada con su uid.
        if (isAdmin) {
            window.recepState = window.recepState || {};
            window.recepState.sedeId = cajaState.sedeId;
            window.recepState.sedeNombre = cajaState.sedeNombre;
        }

        renderAdminSedeSelector();

        // Skeleton
        if (list) list.innerHTML = `
            <div class="flex flex-col items-center gap-3 py-12">
                <div class="auth-checking-spinner"></div>
                <p class="text-white/50 text-xs">Cargando ventas...</p>
            </div>`;
        renderTotalesSkeleton();

        try {
            const hoy = todayISO();
            const [ventas, retiros, deudores, abonosHoy, gastos] = await Promise.all([
                VentasService.listBySedeRange(cajaState.sedeId, hoy, hoy),
                (typeof RetirosService !== 'undefined')
                    ? RetirosService.listBySedeRange(cajaState.sedeId, hoy, hoy)
                    : Promise.resolve([]),
                (typeof DeudasService !== 'undefined')
                    ? DeudasService.listPendientesBySede(cajaState.sedeId)
                    : Promise.resolve([]),
                (typeof DeudasService !== 'undefined')
                    ? DeudasService.listPagosBySedeFecha(cajaState.sedeId, hoy)
                    : Promise.resolve([]),
                (typeof GastosService !== 'undefined')
                    ? GastosService.listBySedeFecha(cajaState.sedeId, hoy)
                    : Promise.resolve([])
            ]);
            cajaState.ventas = ventas;
            cajaState.retiros = retiros || [];
            cajaState.deudores = deudores || [];
            cajaState.abonosHoy = abonosHoy || [];
            cajaState.gastos = gastos || [];
            cajaState.deudaById = {};
            (cajaState.deudores || []).forEach(g => g.deudas.forEach(d => { cajaState.deudaById[d.ventaId] = d; }));

            if (sub) {
                sub.textContent = cajaState.sedeNombre
                    ? `${fechaLargaHoy()} · ${cajaState.sedeNombre}`
                    : fechaLargaHoy();
            }

            render();
        } catch (error) {
            console.error('❌ Error cargando caja:', error);
            if (list) list.innerHTML = renderError('No se pudieron cargar las ventas');
        }
    }

    function render() {
        renderTotales();
        renderCuadre();
        renderGastos();
        renderDeudores();
        renderBarberos();
        renderRetiros();
        renderVentas();
    }

    /** Suma de abonos de deuda de hoy por método ('efectivo'|'transferencia'). */
    function abonosHoyPorMetodo(metodo) {
        return (cajaState.abonosHoy || [])
            .filter(p => p.metodoPago === metodo)
            .reduce((s, p) => s + (Number(p.monto) || 0), 0);
    }

    /**
     * Cuadre de efectivo: cuánto DEBERÍA haber físicamente en la caja.
     *   efectivo vendido − retiros = efectivo esperado.
     * Transferencia y deuda no son plata en el cajón (no entran al cuadre).
     */
    function renderCuadre() {
        const container = document.getElementById('caja-cuadre');
        if (!container) return;
        const agg = VentasService.aggregarPorMetodo(cajaState.ventas);
        const efectivoVendido = (agg.efectivo && agg.efectivo.total) || 0;
        const abonosEfectivo = abonosHoyPorMetodo('efectivo'); // P7: deudas pagadas hoy en efectivo
        const retirosTotal = (typeof RetirosService !== 'undefined')
            ? RetirosService.sumTotal(cajaState.retiros)
            : 0;
        const gastosTotal = (typeof GastosService !== 'undefined') // P8: gastos en efectivo de hoy
            ? GastosService.sumTotal(cajaState.gastos)
            : 0;
        const esperado = efectivoVendido + abonosEfectivo - retirosTotal - gastosTotal;
        const row = (label, valor, signo, cls) => `
            <div class="flex items-center justify-between">
                <span class="text-white/55 text-xs font-bold">${label}</span>
                <span class="${cls} text-sm font-black tabular-nums">${signo}${fmtCOP(valor)}</span>
            </div>`;
        container.innerHTML = `
            ${row('Efectivo vendido', efectivoVendido, '', 'text-green-400')}
            ${abonosEfectivo > 0 ? row('Abonos de deuda (efectivo)', abonosEfectivo, '+ ', 'text-green-400') : ''}
            ${gastosTotal > 0 ? row('Gastos', gastosTotal, '− ', 'text-orange-400') : ''}
            ${row('Retiros de caja', retirosTotal, retirosTotal > 0 ? '− ' : '', 'text-red-400')}
            <div class="pt-2 mt-1 border-t border-white/10 flex items-center justify-between">
                <span class="text-white text-xs font-black uppercase tracking-wider">Debería haber en caja</span>
                <span class="text-primary text-lg font-black tabular-nums">${fmtCOP(esperado)}</span>
            </div>`;
    }

    /** Desglose de cortes/ventas por barbero (count + total cobrado). */
    function renderBarberos() {
        const container = document.getElementById('caja-barberos');
        if (!container) return;
        const agg = {};
        cajaState.ventas.forEach(v => {
            if (!v.barberoId) return;
            const id = v.barberoId;
            if (!agg[id]) agg[id] = { id, nombre: v.barberoNombre || 'Barbero', count: 0, total: 0 };
            agg[id].count += 1;
            agg[id].total += Number(v.total) || 0;
        });
        const lista = Object.values(agg).sort((a, b) => b.total - a.total);
        if (lista.length === 0) {
            container.innerHTML = `
                <div class="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <p class="text-white/35 text-xs text-center">Sin cortes cobrados aún hoy</p>
                </div>`;
            return;
        }
        container.innerHTML = lista.map(b => `
            <div class="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div class="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">content_cut</span>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-white text-sm font-bold truncate">${esc(b.nombre)}</p>
                    <p class="text-white/40 text-[11px]">${b.count} corte${b.count === 1 ? '' : 's'}</p>
                </div>
                <span class="text-primary text-sm font-black tabular-nums shrink-0">${fmtCOP(b.total)}</span>
            </div>`).join('');
    }

    /** Lista de retiros del día. */
    function renderRetiros() {
        const container = document.getElementById('caja-retiros-list');
        if (!container) return;
        if (cajaState.retiros.length === 0) {
            container.innerHTML = `
                <div class="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <p class="text-white/35 text-xs text-center">Sin retiros hoy</p>
                </div>`;
            return;
        }
        container.innerHTML = [...cajaState.retiros].reverse().map(r => {
            const hora = r.fechaHora && r.fechaHora.toDate
                ? r.fechaHora.toDate().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
                : (r.fechaHora?.seconds ? new Date(r.fechaHora.seconds * 1000).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--');
            const nota = (r.nota || '').trim();
            return `
            <div class="flex items-center gap-3 p-2.5 rounded-xl bg-red-500/[0.04] border border-red-500/15">
                <div class="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-red-400 text-sm" style="font-variation-settings: 'FILL' 1">account_balance_wallet</span>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-white text-sm font-bold truncate">${esc(nota) || 'Retiro de caja'}</p>
                    <p class="text-white/40 text-[11px] truncate">${hora}${r.hechoPorNombre ? ` · ${esc(r.hechoPorNombre)}` : ''}</p>
                </div>
                <span class="text-red-400 text-sm font-black tabular-nums shrink-0">− ${fmtCOP(r.monto)}</span>
            </div>`;
        }).join('');
    }

    /** Selector de sede (solo admin). Permite ver/operar la caja de cualquier sede. */
    function renderAdminSedeSelector() {
        const cont = document.getElementById('caja-admin-sede');
        if (!cont) return;
        if (!cajaState.isAdmin || (cajaState.sedes || []).length <= 1) { cont.innerHTML = ''; return; }
        cont.innerHTML = `
            <p class="text-white/45 text-[10px] font-black uppercase tracking-[0.3em] mb-2 pl-1">Caja de la sede</p>
            <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                ${cajaState.sedes.map(s => {
                    const active = s.id === cajaState.sedeId;
                    return `<button onclick="cajaSwitchSede('${s.id}')"
                        class="shrink-0 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-95
                            ${active ? 'bg-primary text-black shadow-[0_4px_15px_rgba(201,167,74,0.25)]' : 'bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-white/[0.08]'}">
                        ${(s.nombre || '').replace(/</g, '&lt;')}
                    </button>`;
                }).join('')}
            </div>`;
    }

    function switchSede(sedeId) {
        if (!sedeId || sedeId === cajaState.sedeId) return;
        cajaState.sedeId = sedeId;
        if (window.recepState) { window.recepState.sedeId = sedeId; window.recepState.sedeNombre = ''; }
        init();
    }

    function renderTotalesSkeleton() {
        const grid = document.getElementById('caja-totales');
        if (grid) {
            grid.innerHTML = METODOS_ORDEN.map(m => {
                const meta = METODO_META[m];
                return `
                    <div class="p-3 rounded-xl ${meta.bg} border ${meta.border}">
                        <div class="flex items-center gap-1.5 mb-1.5">
                            <span class="material-symbols-outlined ${meta.color} text-base" style="font-variation-settings: 'FILL' 1">${meta.icon}</span>
                            <span class="${meta.color} text-[9px] font-black uppercase tracking-wider">${meta.label}</span>
                        </div>
                        <p class="${meta.color} text-base font-black tabular-nums">$0</p>
                        <p class="text-white/35 text-[9px] mt-0.5">0 ventas</p>
                    </div>`;
            }).join('');
        }
        const tot = document.getElementById('caja-total-amount');
        if (tot) tot.textContent = '$0';
    }

    function renderTotales() {
        const agg = VentasService.aggregarPorMetodo(cajaState.ventas);
        const grid = document.getElementById('caja-totales');
        if (grid) {
            grid.innerHTML = METODOS_ORDEN.map(m => {
                const meta = METODO_META[m];
                const data = agg[m] || { count: 0, total: 0 };
                return `
                    <div class="p-3 rounded-xl ${meta.bg} border ${meta.border}">
                        <div class="flex items-center gap-1.5 mb-1.5">
                            <span class="material-symbols-outlined ${meta.color} text-base" style="font-variation-settings: 'FILL' 1">${meta.icon}</span>
                            <span class="${meta.color} text-[9px] font-black uppercase tracking-wider">${meta.label}</span>
                        </div>
                        <p class="${meta.color} text-base font-black tabular-nums">${fmtCOP(data.total)}</p>
                        <p class="text-white/35 text-[9px] mt-0.5">${data.count} venta${data.count === 1 ? '' : 's'}</p>
                    </div>`;
            }).join('');
        }
        const totalDia = cajaState.ventas.reduce((s, v) => s + (Number(v.total) || 0), 0);
        const tot = document.getElementById('caja-total-amount');
        if (tot) tot.textContent = fmtCOP(totalDia);
    }

    function renderVentas() {
        const list = document.getElementById('caja-ventas-list');
        if (!list) return;
        if (cajaState.ventas.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center gap-3 py-10 px-6 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <span class="material-symbols-outlined text-white/20 text-4xl" style="font-variation-settings: 'FILL' 1">receipt_long</span>
                    <p class="text-white/50 text-sm font-bold text-center">Sin ventas en este día</p>
                    <p class="text-white/25 text-[11px] text-center">Cuando cobres una cita o registres una venta directa, aparece acá</p>
                </div>`;
            return;
        }
        // Más reciente primero
        const ventasOrden = [...cajaState.ventas].reverse();
        list.innerHTML = ventasOrden.map(ventaCard).join('');
    }

    function ventaCard(v) {
        const meta = METODO_META[v.metodoPago] || METODO_META.efectivo;
        const hora = v.fechaHora && v.fechaHora.toDate
            ? v.fechaHora.toDate().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
            : (v.fechaHora?.seconds ? new Date(v.fechaHora.seconds * 1000).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--');
        const cliente = esc(v.clienteNombre || 'Cliente');
        const tipo = v.tipo === 'venta_directa' ? 'Venta directa' : (v.barberoNombre ? `con ${esc(v.barberoNombre)}` : 'Cita');
        const productos = (v.items || []).filter(it => it.tipo === 'producto').length;

        return `
        <div class="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
            <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl ${meta.bg} border ${meta.border} flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined ${meta.color} text-sm" style="font-variation-settings: 'FILL' 1">${meta.icon}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-white text-sm font-bold truncate">${cliente}</p>
                    <p class="text-white/45 text-[11px] truncate">${hora} · ${tipo}${productos > 0 ? ` · ${productos} producto${productos === 1 ? '' : 's'}` : ''}</p>
                </div>
                <div class="text-right shrink-0">
                    <p class="text-primary text-sm font-black tabular-nums">${fmtCOP(v.total)}</p>
                    <p class="${meta.color} text-[9px] font-black uppercase tracking-wider">${meta.label}</p>
                </div>
            </div>
        </div>`;
    }

    function renderError(msg) {
        return `
            <div class="text-center py-10 px-6 rounded-xl bg-red-500/5 border border-red-500/15">
                <span class="material-symbols-outlined text-red-400 text-4xl mb-2">error</span>
                <p class="text-red-400 text-sm font-bold">${msg}</p>
                <button onclick="initRecepcionistaCaja()" class="mt-4 px-4 py-2 bg-primary/20 text-primary text-xs font-black rounded-lg border border-primary/30">
                    Reintentar
                </button>
            </div>`;
    }

    /** P7: lista de deudores agrupada por cliente, con pago por deuda. */
    function renderDeudores() {
        const container = document.getElementById('caja-deudores');
        if (!container) return;

        // H3: resumen de abonos de deuda recibidos hoy (por método), para que
        // queden visibles también los de transferencia y "al admin".
        const abEf = abonosHoyPorMetodo('efectivo');
        const abTr = abonosHoyPorMetodo('transferencia');
        const abAd = abonosHoyPorMetodo('admin');
        const resumenAbonos = (abEf + abTr + abAd) > 0
            ? `<div class="p-2.5 rounded-xl bg-green-500/[0.06] border border-green-500/15 flex items-center gap-3 flex-wrap text-[11px]">
                   <span class="text-green-300 font-black uppercase tracking-wider">Abonos hoy</span>
                   ${abEf > 0 ? `<span class="text-white/70">Efectivo <b class="text-green-400">${fmtCOP(abEf)}</b></span>` : ''}
                   ${abTr > 0 ? `<span class="text-white/70">Transfer. <b class="text-purple-400">${fmtCOP(abTr)}</b></span>` : ''}
                   ${abAd > 0 ? `<span class="text-white/70">Al admin <b class="text-primary">${fmtCOP(abAd)}</b></span>` : ''}
               </div>`
            : '';

        if (!cajaState.deudores.length) {
            container.innerHTML = resumenAbonos + `
                <div class="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <p class="text-white/35 text-xs text-center">Sin deudores pendientes</p>
                </div>`;
            return;
        }
        container.innerHTML = resumenAbonos + cajaState.deudores.map(g => {
            const deudasHtml = g.deudas.map(d => {
                const f = d.fecha ? d.fecha.split('-').reverse().slice(0, 2).join('/') : '';
                return `
                <div class="flex items-center gap-2 px-3 py-2 border-t border-white/5">
                    <span class="text-white/45 text-[11px] flex-1">${f}</span>
                    <span class="text-white text-sm font-black tabular-nums">${fmtCOP(d.total)}</span>
                    <button onclick="cajaPagarDeuda('${d.ventaId}')"
                        class="px-3 py-1 rounded-lg bg-green-500 text-black text-[10px] font-black uppercase tracking-wider hover:bg-green-400 transition-all active:scale-95">
                        Pagar
                    </button>
                </div>`;
            }).join('');
            return `
            <details class="rounded-xl bg-amber-500/[0.04] border border-amber-500/15 overflow-hidden">
                <summary class="flex items-center gap-3 p-3 cursor-pointer list-none">
                    <div class="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-amber-400 text-sm" style="font-variation-settings: 'FILL' 1">person</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-white text-sm font-bold truncate">${esc(g.clienteNombre)}</p>
                        <p class="text-white/40 text-[11px]">${g.deudas.length} deuda${g.deudas.length === 1 ? '' : 's'}</p>
                    </div>
                    <span class="text-amber-400 text-sm font-black tabular-nums shrink-0">${fmtCOP(g.total)}</span>
                    <span class="material-symbols-outlined text-white/30 text-base shrink-0">expand_more</span>
                </summary>
                <div class="bg-black/10">${deudasHtml}</div>
            </details>`;
        }).join('');
    }

    /** Abre el mini-modal para elegir cómo se paga la deuda. */
    function openPagarDeuda(ventaId) {
        const d = cajaState.deudaById[ventaId];
        if (!d) return;
        const existing = document.getElementById('pagar-deuda-overlay');
        if (existing) existing.remove();
        const html = `
        <div id="pagar-deuda-overlay" class="barber-modal-overlay" style="z-index:160">
            <div class="barber-modal">
                <div class="barber-modal-header">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-green-400 text-xl" style="font-variation-settings: 'FILL' 1">price_check</span>
                        </div>
                        <div class="min-w-0">
                            <h2 class="text-lg font-black text-white truncate">Pagar deuda</h2>
                            <p class="text-white/40 text-xs truncate">${esc(d.clienteNombre)} · ${fmtCOP(d.total)}</p>
                        </div>
                    </div>
                    <button onclick="cajaCerrarPagarDeuda()" class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/20 transition-all active:scale-90">
                        <span class="material-symbols-outlined text-white/60 text-lg">close</span>
                    </button>
                </div>
                <div class="barber-modal-body">
                    <p class="text-white/50 text-xs mb-3">¿Cómo se paga esta deuda?</p>
                    <div class="space-y-2">
                        <button onclick="cajaConfirmarPagoDeuda('${ventaId}','efectivo')" class="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-green-500/40 transition-all active:scale-[0.98]">
                            <span class="material-symbols-outlined text-green-400" style="font-variation-settings: 'FILL' 1">payments</span>
                            <span class="text-white text-sm font-bold">Efectivo</span>
                            <span class="ml-auto text-white/30 text-[10px] uppercase">entra a caja</span>
                        </button>
                        <button onclick="cajaConfirmarPagoDeuda('${ventaId}','transferencia')" class="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-purple-500/40 transition-all active:scale-[0.98]">
                            <span class="material-symbols-outlined text-purple-400" style="font-variation-settings: 'FILL' 1">account_balance</span>
                            <span class="text-white text-sm font-bold">Transferencia</span>
                            <span class="ml-auto text-white/30 text-[10px] uppercase">entra a caja</span>
                        </button>
                        <button onclick="cajaConfirmarPagoDeuda('${ventaId}','admin')" class="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-primary/40 transition-all active:scale-[0.98]">
                            <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1">person</span>
                            <span class="text-white text-sm font-bold">Pagada al admin</span>
                            <span class="ml-auto text-white/30 text-[10px] uppercase">no pasa por caja</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => document.getElementById('pagar-deuda-overlay')?.classList.add('visible'));
    }

    function closePagarDeuda() {
        const ov = document.getElementById('pagar-deuda-overlay');
        if (ov) { ov.classList.remove('visible'); setTimeout(() => ov.remove(), 250); }
    }

    let pagandoDeuda = false;
    async function confirmarPagoDeuda(ventaId, metodo) {
        if (pagandoDeuda) return;
        const d = cajaState.deudaById[ventaId];
        if (!d || typeof DeudasService === 'undefined') return;
        pagandoDeuda = true;
        const user = getCurrentUser();
        const id = await DeudasService.pagar({
            ventaId,
            clienteId: d.clienteId || null,
            clienteNombre: d.clienteNombre,
            sedeId: cajaState.sedeId,
            monto: d.total,
            metodoPago: metodo,
            fecha: todayISO(),
            registradoPor: user?.uid || null,
            registradoPorNombre: user?.displayName || ''
        });
        pagandoDeuda = false;
        if (id === 'YA_PAGADA') {
            if (typeof window.showToast === 'function') window.showToast('Esa deuda ya estaba pagada', 'info');
            closePagarDeuda();
            init();
            return;
        }
        if (!id) {
            if (typeof window.showToast === 'function') window.showToast('No se pudo registrar el pago', 'error');
            return;
        }
        const etiqueta = metodo === 'admin' ? 'pagada al admin' : `pagada (${metodo})`;
        if (typeof window.showToast === 'function') window.showToast(`Deuda de ${d.clienteNombre} ${etiqueta} ✓`, 'success');
        closePagarDeuda();
        init();
    }

    // ============================================
    // RETIRO DE CAJA (modal)
    // ============================================

    /** Efectivo que debería haber en caja ahora (efectivo vendido − retiros). */
    function efectivoEsperado() {
        const agg = VentasService.aggregarPorMetodo(cajaState.ventas);
        const efectivo = (agg.efectivo && agg.efectivo.total) || 0;
        const retiros = (typeof RetirosService !== 'undefined') ? RetirosService.sumTotal(cajaState.retiros) : 0;
        return efectivo - retiros;
    }

    let retiroConfirmado = false;

    function openRetiro() {
        if (!cajaState.sedeId) {
            if (typeof window.showToast === 'function') window.showToast('Sin sede asignada', 'error');
            return;
        }
        retiroConfirmado = false;
        const existing = document.getElementById('retiro-overlay');
        if (existing) existing.remove();
        const html = `
        <div id="retiro-overlay" class="barber-modal-overlay" style="z-index:160">
            <div class="barber-modal">
                <div class="barber-modal-header">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-red-400 text-xl" style="font-variation-settings: 'FILL' 1">account_balance_wallet</span>
                        </div>
                        <div class="min-w-0">
                            <h2 class="text-lg font-black text-white truncate">Retiro de caja</h2>
                            <p class="text-white/40 text-xs truncate">${cajaState.sedeNombre || 'Tu sede'} · ${fechaLargaHoy()}</p>
                        </div>
                    </div>
                    <button onclick="closeRetiroModal()" class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/20 transition-all active:scale-90">
                        <span class="material-symbols-outlined text-white/60 text-lg">close</span>
                    </button>
                </div>
                <div class="barber-modal-body">
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">payments</span>
                            <span>Monto a retirar</span>
                        </div>
                        <input type="number" id="retiro-monto" inputmode="numeric" min="1" placeholder="0"
                            class="w-full px-3 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-lg font-black tabular-nums placeholder-white/25 focus:outline-none focus:border-primary/50">
                        <p class="text-white/40 text-[11px] mt-1.5">En caja debería haber <span class="text-primary font-bold">${fmtCOP(efectivoEsperado())}</span></p>
                    </div>
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">edit_note</span>
                            <span>Nota (quién se lleva la plata / motivo)</span>
                        </div>
                        <input type="text" id="retiro-nota" maxlength="200" placeholder="Ej: Entrega al admin"
                            class="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm font-bold placeholder-white/25 focus:outline-none focus:border-primary/50">
                    </div>
                </div>
                <div class="barber-modal-footer">
                    <button onclick="closeRetiroModal()" class="flex-1 px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Cancelar
                    </button>
                    <button id="retiro-submit" onclick="submitRetiro()" class="flex-[2] px-5 py-3.5 rounded-xl bg-red-500 text-white text-sm font-black uppercase tracking-wider hover:bg-red-400 transition-all active:scale-[0.97]">
                        Registrar retiro
                    </button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => document.getElementById('retiro-overlay')?.classList.add('visible'));
        setTimeout(() => document.getElementById('retiro-monto')?.focus(), 100);
    }

    function closeRetiro() {
        const overlay = document.getElementById('retiro-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 250);
        }
    }

    async function submitRetiro() {
        const monto = Number(document.getElementById('retiro-monto')?.value) || 0;
        const nota = (document.getElementById('retiro-nota')?.value || '').trim();
        if (monto <= 0) {
            if (typeof window.showToast === 'function') window.showToast('Escribí un monto válido', 'error');
            return;
        }
        // H6: avisar (no bloquear) si el retiro supera el efectivo en caja.
        const esperado = efectivoEsperado();
        if (monto > esperado && !retiroConfirmado) {
            retiroConfirmado = true;
            if (typeof window.showToast === 'function') window.showToast(`Ojo: supera el efectivo en caja (${fmtCOP(esperado)}). Tocá de nuevo para confirmar.`, 'info');
            const b = document.getElementById('retiro-submit');
            if (b) b.textContent = 'Sí, retirar igual';
            return;
        }
        const user = getCurrentUser();
        const btn = document.getElementById('retiro-submit');
        const orig = btn?.innerHTML;
        if (btn) { btn.disabled = true; btn.innerHTML = '<div class="auth-checking-spinner" style="width:1.2rem;height:1.2rem;border-width:2px;margin:0 auto"></div>'; }

        const id = await RetirosService.create({
            sedeId: cajaState.sedeId,
            fecha: todayISO(),
            monto,
            nota,
            hechoPor: user?.uid || null,
            hechoPorNombre: user?.displayName || ''
        });

        if (!id) {
            if (btn) { btn.disabled = false; btn.innerHTML = orig; }
            if (typeof window.showToast === 'function') window.showToast('No se pudo registrar el retiro', 'error');
            return;
        }
        if (typeof window.showToast === 'function') window.showToast(`Retiro de ${fmtCOP(monto)} registrado ✓`, 'success');
        closeRetiro();
        init(); // refrescar cuadre y lista
    }

    // ============================================
    // GASTOS (P8)
    // ============================================

    function renderGastos() {
        const container = document.getElementById('caja-gastos-list');
        if (!container) return;
        if (!cajaState.gastos.length) {
            container.innerHTML = `
                <div class="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <p class="text-white/35 text-xs text-center">Sin gastos hoy</p>
                </div>`;
            return;
        }
        container.innerHTML = cajaState.gastos.map(g => {
            const hora = g.fechaHora?.toDate
                ? g.fechaHora.toDate().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
                : (g.fechaHora?.seconds ? new Date(g.fechaHora.seconds * 1000).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--');
            return `
            <div class="flex items-center gap-3 p-2.5 rounded-xl bg-orange-500/[0.04] border border-orange-500/15">
                <div class="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-orange-400 text-sm" style="font-variation-settings: 'FILL' 1">receipt_long</span>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-white text-sm font-bold truncate">${esc(g.concepto)}</p>
                    <p class="text-white/40 text-[11px] truncate">${hora}${g.registradoPorNombre ? ` · ${esc(g.registradoPorNombre)}` : ''}</p>
                </div>
                <span class="text-orange-400 text-sm font-black tabular-nums shrink-0">− ${fmtCOP(g.monto)}</span>
            </div>`;
        }).join('');
    }

    function openGasto() {
        if (!cajaState.sedeId) {
            if (typeof window.showToast === 'function') window.showToast('Sin sede asignada', 'error');
            return;
        }
        const existing = document.getElementById('gasto-overlay');
        if (existing) existing.remove();
        const html = `
        <div id="gasto-overlay" class="barber-modal-overlay" style="z-index:160">
            <div class="barber-modal">
                <div class="barber-modal-header">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-orange-400 text-xl" style="font-variation-settings: 'FILL' 1">receipt_long</span>
                        </div>
                        <div class="min-w-0">
                            <h2 class="text-lg font-black text-white truncate">Registrar gasto</h2>
                            <p class="text-white/40 text-xs truncate">${cajaState.sedeNombre || 'Tu sede'} · sale del efectivo</p>
                        </div>
                    </div>
                    <button onclick="cajaCerrarGasto()" class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/20 transition-all active:scale-90">
                        <span class="material-symbols-outlined text-white/60 text-lg">close</span>
                    </button>
                </div>
                <div class="barber-modal-body">
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">edit_note</span>
                            <span>¿En qué fue el gasto?</span>
                        </div>
                        <input type="text" id="gasto-concepto" maxlength="120" placeholder="Ej: Insumos, aseo, domicilio..."
                            class="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm font-bold placeholder-white/25 focus:outline-none focus:border-primary/50">
                    </div>
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">payments</span>
                            <span>Monto</span>
                        </div>
                        <input type="number" id="gasto-monto" inputmode="numeric" min="1" placeholder="0"
                            class="w-full px-3 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-lg font-black tabular-nums placeholder-white/25 focus:outline-none focus:border-primary/50">
                    </div>
                </div>
                <div class="barber-modal-footer">
                    <button onclick="cajaCerrarGasto()" class="flex-1 px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Cancelar
                    </button>
                    <button id="gasto-submit" onclick="cajaSubmitGasto()" class="flex-[2] px-5 py-3.5 rounded-xl bg-orange-500 text-black text-sm font-black uppercase tracking-wider hover:bg-orange-400 transition-all active:scale-[0.97]">
                        Registrar gasto
                    </button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => document.getElementById('gasto-overlay')?.classList.add('visible'));
        setTimeout(() => document.getElementById('gasto-concepto')?.focus(), 100);
    }

    function closeGasto() {
        const ov = document.getElementById('gasto-overlay');
        if (ov) { ov.classList.remove('visible'); setTimeout(() => ov.remove(), 250); }
    }

    let registrandoGasto = false;
    async function submitGasto() {
        if (registrandoGasto) return;
        const concepto = (document.getElementById('gasto-concepto')?.value || '').trim();
        const monto = Number(document.getElementById('gasto-monto')?.value) || 0;
        if (!concepto) {
            if (typeof window.showToast === 'function') window.showToast('Escribí en qué fue el gasto', 'error');
            return;
        }
        if (monto <= 0) {
            if (typeof window.showToast === 'function') window.showToast('Escribí un monto válido', 'error');
            return;
        }
        registrandoGasto = true;
        const btn = document.getElementById('gasto-submit');
        const orig = btn?.innerHTML;
        if (btn) { btn.disabled = true; btn.innerHTML = '<div class="auth-checking-spinner" style="width:1.2rem;height:1.2rem;border-width:2px;margin:0 auto"></div>'; }
        const user = getCurrentUser();
        const id = await GastosService.create({
            sedeId: cajaState.sedeId,
            fecha: todayISO(),
            concepto,
            monto,
            registradoPor: user?.uid || null,
            registradoPorNombre: user?.displayName || ''
        });
        registrandoGasto = false;
        if (!id) {
            if (btn) { btn.disabled = false; btn.innerHTML = orig; }
            if (typeof window.showToast === 'function') window.showToast('No se pudo registrar el gasto', 'error');
            return;
        }
        if (typeof window.showToast === 'function') window.showToast(`Gasto de ${fmtCOP(monto)} registrado ✓`, 'success');
        closeGasto();
        init();
    }

    // Hook: al crearse una venta, refrescamos
    function onVentaCreada() {
        // Solo si estamos en el tab caja
        const tab = document.getElementById('recepcionista-caja-tab');
        if (tab && tab.classList.contains('active')) {
            init();
        }
    }

    window.initRecepcionistaCaja = init;
    window.reloadRecepcionistaCaja = init;
    window.onRecepVentaCreada = onVentaCreada;
    window.openRetiroModal = openRetiro;
    window.closeRetiroModal = closeRetiro;
    window.submitRetiro = submitRetiro;
    window.cajaPagarDeuda = openPagarDeuda;
    window.cajaCerrarPagarDeuda = closePagarDeuda;
    window.cajaConfirmarPagoDeuda = confirmarPagoDeuda;
    window.cajaSwitchSede = switchSede;
    window.openGastoModal = openGasto;
    window.cajaCerrarGasto = closeGasto;
    window.cajaSubmitGasto = submitGasto;

    console.log('✓ RecepcionistaCajaUI (F3) loaded');
})();
