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
        tarjeta:       { label: 'Tarjeta',       icon: 'credit_card',      color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
        transferencia: { label: 'Transfer.',     icon: 'account_balance',  color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' }
    };

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

    const cajaState = {
        sedeId: null,
        sedeNombre: '',
        ventas: []
    };

    async function init() {
        const sub = document.getElementById('caja-sub-label');
        const list = document.getElementById('caja-ventas-list');

        const user = getCurrentUser();
        if (!user || user.role !== 'recepcionista') {
            if (list) list.innerHTML = renderError('Pantalla solo para recepcionistas');
            return;
        }
        cajaState.sedeId = user.sedeId || null;
        if (!cajaState.sedeId) {
            if (sub) sub.textContent = 'Sin sede asignada';
            if (list) list.innerHTML = renderError('No tenés sede asignada');
            return;
        }

        // Skeleton
        if (list) list.innerHTML = `
            <div class="flex flex-col items-center gap-3 py-12">
                <div class="auth-checking-spinner"></div>
                <p class="text-white/50 text-xs">Cargando ventas...</p>
            </div>`;
        renderTotalesSkeleton();

        try {
            const sedes = (typeof SedesService !== 'undefined') ? await SedesService.list() : [];
            cajaState.sedeNombre = (typeof SedesService !== 'undefined')
                ? SedesService.nombreById(sedes, cajaState.sedeId)
                : '';
            cajaState.ventas = await VentasService.listBySedeRange(cajaState.sedeId, todayISO(), todayISO());

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
        renderVentas();
    }

    function renderTotalesSkeleton() {
        const grid = document.getElementById('caja-totales');
        if (grid) {
            grid.innerHTML = ['efectivo', 'tarjeta', 'transferencia'].map(m => {
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
            grid.innerHTML = ['efectivo', 'tarjeta', 'transferencia'].map(m => {
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
        const cliente = v.clienteNombre || 'Cliente';
        const tipo = v.tipo === 'venta_directa' ? 'Venta directa' : (v.barberoNombre ? `con ${v.barberoNombre}` : 'Cita');
        const itemsCount = (v.items || []).length;
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

    console.log('✓ RecepcionistaCajaUI (F3) loaded');
})();
