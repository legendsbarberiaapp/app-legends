/**
 * LEGENDS BARBERIA - ADMIN: REPORTES (F5)
 *
 * Pantalla de métricas del negocio. Filtros: sede + período.
 *
 * Bloques:
 *   1. Métricas top (ingresos, citas, walk-ins, ventas directas, ticket prom.)
 *   2. Métodos de pago (barras horizontales con % y monto)
 *   3. Top 5 barberos del período
 *   4. Top 5 productos del período
 *   5. Ingresos por día (barras simples — últimos 7 o 30 días según período)
 *
 * Datos: TODO desde `ventas` (única fuente financiera). Filtro client-side
 * por sede / barbero / producto.
 */
(function () {
    'use strict';

    // ============================================
    // CONSTANTES
    // ============================================

    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const DIAS_SEMANA_LBL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    // FIX F5-#5: dejamos solo 3 períodos sin overlap conceptual.
    // "Mes" cubre el caso de "Últimos 30 días" para el dueño (visión de cierre
    // mensual). Si en algún momento se necesita rolling 30, se agrega de nuevo.
    const PERIODOS = [
        { id: 'hoy',     label: 'Hoy',           days: 1  },
        { id: 'semana',  label: 'Esta semana',   days: 7  },
        { id: 'mes',     label: 'Este mes',      days: 30 }
    ];

    const METODO_META = {
        efectivo:      { label: 'Efectivo',      icon: 'payments',        color: '#22c55e', cls: 'text-green-400' },
        transferencia: { label: 'Transferencia', icon: 'account_balance', color: '#a855f7', cls: 'text-purple-400' },
        deuda:         { label: 'Deuda',         icon: 'schedule',        color: '#f59e0b', cls: 'text-amber-400'  }
    };
    const METODOS_ORDEN = ['efectivo', 'transferencia', 'deuda'];

    // ============================================
    // ESTADO
    // ============================================

    const state = {
        sedes: [],
        sedeFilter: 'all',         // 'all' | sedeId
        periodoFilter: 'mes',      // PERIODOS[].id
        ventas: [],
        retiros: [],               // F-caja: retiros del período (para el cuadre de efectivo)
        pagosComision: [],         // P5: pagos de comisión del período
        comisionesCalc: {},        // P5: barberoId → {nombre, sedeId, pendiente} (para el botón Pagar)
        deudores: [],              // P7: deudas pendientes de la sede (solo con sede específica)
        gastos: [],                // P8: gastos del período (solo con sede específica)
        barberos: [],              // para resolver nombres + fotos
        productos: [],             // catálogo (todos) para resolver nombres
        loading: false,
        // FIX F5-#1: counter de secuencia para evitar race condition entre
        // taps rápidos de filtros. Cada llamada a init() incrementa el token;
        // al volver del fetch, comparamos contra el token actual — si cambió
        // (otro init más nuevo arrancó), descartamos el resultado.
        fetchToken: 0
    };

    // ============================================
    // UTILS
    // ============================================

    function toISO(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function todayISO() { return toISO(new Date()); }
    function offsetISO(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return toISO(d);
    }

    /** Devuelve {desde, hasta} ISO según el período seleccionado. */
    function rangoActual() {
        const periodo = PERIODOS.find(p => p.id === state.periodoFilter) || PERIODOS[0];
        const hasta = todayISO();
        if (periodo.id === 'hoy') return { desde: hasta, hasta };
        if (periodo.id === 'semana') {
            // Lunes de la semana actual
            const d = new Date();
            const dow = d.getDay(); // 0=dom .. 6=sab
            const diffAlLunes = dow === 0 ? -6 : (1 - dow);
            d.setDate(d.getDate() + diffAlLunes);
            return { desde: toISO(d), hasta };
        }
        // mes: primer día del mes actual
        const d = new Date();
        d.setDate(1);
        return { desde: toISO(d), hasta };
    }

    /**
     * Abrevia montos COP para que entren arriba de barras chicas.
     *   500 → $500   ·   15000 → $15K   ·   1_250_000 → $1.2M
     * Usado solo en etiquetas visuales; los totales formales siguen con fmtCOP.
     */
    function fmtAbbrev(n) {
        const v = Number(n) || 0;
        if (v === 0) return '';
        if (v >= 1_000_000) {
            const m = v / 1_000_000;
            return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
        }
        if (v >= 1000) {
            return `$${Math.round(v / 1000)}K`;
        }
        return `$${v}`;
    }

    function fmtCOP(n) {
        return (typeof window.formatCOP === 'function') ? window.formatCOP(n || 0) : `$${n || 0}`;
    }

    /** Escapa texto libre (notas de retiro) para evitar inyección HTML. */
    function esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sedeNombrePorId(sedeId) {
        if (sedeId === 'all') return 'Todas las sedes';
        if (typeof SedesService !== 'undefined') return SedesService.nombreById(state.sedes, sedeId);
        return '';
    }

    // ============================================
    // INIT
    // ============================================

    async function init() {
        const content = document.getElementById('rep-content');
        if (!content) return;

        // FIX F5-#1: token de secuencia anti-race. Si el usuario tap rápido
        // entre filtros, los fetches anteriores se descartan sin renderizar.
        const myToken = ++state.fetchToken;
        const isCurrent = () => state.fetchToken === myToken;

        renderFiltros();

        state.loading = true;
        content.innerHTML = `
            <div class="flex flex-col items-center gap-3 py-12">
                <div class="auth-checking-spinner"></div>
                <p class="text-white/50 text-xs">Cargando reportes...</p>
            </div>`;

        try {
            const { desde, hasta } = rangoActual();
            const sedesPrevias = state.sedes.length;

            // Carga en paralelo: sedes (para filtro), barberos (para nombres),
            // productos (para resolver nombres), y ventas según filtro de sede.
            const [sedes, barberos, productos, ventas, retiros, pagosComision, deudores, gastos] = await Promise.all([
                (typeof SedesService !== 'undefined') ? SedesService.list() : Promise.resolve([]),
                (typeof BarbersService !== 'undefined') ? BarbersService.list() : Promise.resolve([]),
                (typeof ProductosService !== 'undefined') ? ProductosService.list() : Promise.resolve([]),
                state.sedeFilter === 'all'
                    ? VentasService.listByRange(desde, hasta)
                    : VentasService.listBySedeRange(state.sedeFilter, desde, hasta),
                (typeof RetirosService === 'undefined')
                    ? Promise.resolve([])
                    : (state.sedeFilter === 'all'
                        ? RetirosService.listByRange(desde, hasta)
                        : RetirosService.listBySedeRange(state.sedeFilter, desde, hasta)),
                (typeof ComisionesService === 'undefined')
                    ? Promise.resolve([])
                    : ComisionesService.listByRange(desde, hasta),
                (typeof DeudasService === 'undefined' || state.sedeFilter === 'all')
                    ? Promise.resolve([])
                    : DeudasService.listPendientesBySede(state.sedeFilter),
                (typeof GastosService === 'undefined' || state.sedeFilter === 'all')
                    ? Promise.resolve([])
                    : GastosService.listBySedeRange(state.sedeFilter, desde, hasta)
            ]);

            // Si mientras estábamos esperando llegó otro init() más nuevo,
            // descartamos este resultado: el otro fetch va a renderizar.
            if (!isCurrent()) return;

            state.sedes = sedes;
            state.barberos = barberos;
            state.productos = productos;
            state.ventas = ventas || [];
            state.retiros = retiros || [];
            state.pagosComision = pagosComision || [];
            state.deudores = deudores || [];
            state.gastos = gastos || [];

            // FIX F5-#3: re-render de filtros SOLO si cambió la cantidad de
            // sedes (típicamente solo la primera vez). En navegaciones
            // posteriores con sedes ya cacheadas, evitamos el doble work.
            if (sedes.length !== sedesPrevias) {
                renderFiltros();
            }
            renderContenido();
        } catch (e) {
            console.error('❌ Error cargando reportes:', e);
            if (!isCurrent()) return;
            content.innerHTML = `
                <div class="text-center py-10 px-6 rounded-xl bg-red-500/5 border border-red-500/15">
                    <span class="material-symbols-outlined text-red-400 text-4xl mb-2">error</span>
                    <p class="text-red-400 text-sm font-bold">No se pudieron cargar los reportes</p>
                    <button onclick="initReportes()" class="mt-4 px-4 py-2 bg-primary/20 text-primary text-xs font-black rounded-lg border border-primary/30">
                        Reintentar
                    </button>
                </div>`;
        } finally {
            if (isCurrent()) state.loading = false;
        }
    }

    // ============================================
    // FILTROS
    // ============================================

    function renderFiltros() {
        // Sede
        const sedeContainer = document.getElementById('rep-sede-filter');
        if (sedeContainer) {
            const pill = (label, value, icon) => {
                const active = state.sedeFilter === value;
                return `
                    <button onclick="setReportesSede('${value}')" aria-pressed="${active}"
                        class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-[0.97]
                            ${active ? 'bg-primary text-black shadow-[0_4px_15px_rgba(201,167,74,0.25)]' : 'bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-white/[0.07]'}">
                        <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1" aria-hidden="true">${icon}</span>
                        <span class="truncate">${label}</span>
                    </button>`;
            };
            const pills = [pill('Todas', 'all', 'select_all')]
                .concat((state.sedes || []).map(s => pill(s.nombre, s.id, 'storefront')))
                .join('');
            sedeContainer.innerHTML = pills;
        }

        // Período
        const periodoContainer = document.getElementById('rep-periodo-filter');
        if (periodoContainer) {
            periodoContainer.innerHTML = PERIODOS.map(p => {
                const active = state.periodoFilter === p.id;
                return `
                    <button onclick="setReportesPeriodo('${p.id}')" aria-pressed="${active}"
                        class="shrink-0 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-[0.97]
                            ${active ? 'bg-primary text-black shadow-[0_4px_15px_rgba(201,167,74,0.25)]' : 'bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-white/[0.07]'}">
                        ${p.label}
                    </button>`;
            }).join('');
        }
    }

    function setSede(value) {
        if (state.sedeFilter === value) return;
        state.sedeFilter = value;
        init();
    }
    function setPeriodo(value) {
        if (state.periodoFilter === value) return;
        state.periodoFilter = value;
        init();
    }

    // ============================================
    // CONTENIDO (cálculos + render)
    // ============================================

    function renderContenido() {
        const content = document.getElementById('rep-content');
        if (!content) return;
        const ventas = state.ventas || [];

        // Tarjeta de caja (efectivo + retiros) — solo con una sede específica,
        // porque el retiro se registra sobre una sede concreta.
        const cajaBlock = state.sedeFilter !== 'all' ? renderCajaEfectivo(ventas) : '';
        const deudoresBlock = state.sedeFilter !== 'all' ? renderDeudoresAdmin() : '';
        const gastosBlock = state.sedeFilter !== 'all' ? renderGastosAdmin() : '';

        if (ventas.length === 0) {
            content.innerHTML = cajaBlock + gastosBlock + deudoresBlock + `
                <div class="flex flex-col items-center gap-3 py-12 px-6 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <span class="material-symbols-outlined text-white/20 text-5xl" style="font-variation-settings: 'FILL' 1">query_stats</span>
                    <p class="text-white/50 text-sm font-bold text-center">Sin ventas en este período</p>
                    <p class="text-white/25 text-[11px] text-center">Probá cambiando sede o período</p>
                </div>`;
            return;
        }

        content.innerHTML = [
            cajaBlock,
            gastosBlock,
            deudoresBlock,
            renderMetricasTop(ventas),
            renderMetodosPago(ventas),
            renderComisiones(ventas),
            renderTopBarberos(ventas),
            renderTopProductos(ventas),
            renderIngresosPorDia(ventas)
        ].join('');
    }

    // ---- Bloque: Deudores (P7, read-only, por sede) ----

    function renderDeudoresAdmin() {
        const deudores = state.deudores || [];
        const totalDeuda = deudores.reduce((s, g) => s + (Number(g.total) || 0), 0);
        if (deudores.length === 0) {
            return `
            <div class="mb-5">
                <p class="text-white/45 text-[10px] font-black uppercase tracking-[0.3em] mb-2 pl-1">Deudores</p>
                <div class="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <p class="text-white/40 text-xs text-center">Sin deudores pendientes en esta sede</p>
                </div>
            </div>`;
        }
        const items = deudores.map(g => `
            <div class="flex items-center gap-3 p-3 rounded-xl bg-amber-500/[0.04] border border-amber-500/15">
                <div class="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-amber-400 text-sm" style="font-variation-settings: 'FILL' 1">person</span>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-white text-sm font-bold truncate">${esc(g.clienteNombre)}</p>
                    <p class="text-white/40 text-[11px]">${g.deudas.length} deuda${g.deudas.length === 1 ? '' : 's'}</p>
                </div>
                <span class="text-amber-400 text-sm font-black tabular-nums shrink-0">${fmtCOP(g.total)}</span>
            </div>`).join('');
        return `
        <div class="mb-5">
            <p class="text-white/45 text-[10px] font-black uppercase tracking-[0.3em] mb-1 pl-1">Deudores</p>
            <p class="text-white/30 text-[10px] mb-2 pl-1">Total por cobrar: <span class="text-amber-400 font-bold">${fmtCOP(totalDeuda)}</span>. Se cobran desde Caja (recepción).</p>
            <div class="space-y-2">${items}</div>
        </div>`;
    }

    // ---- Bloque: Gastos (P8, por sede) ----

    function renderGastosAdmin() {
        const gastos = state.gastos || [];
        const total = (typeof GastosService !== 'undefined') ? GastosService.sumTotal(gastos) : 0;
        const periodoLbl = (PERIODOS.find(p => p.id === state.periodoFilter) || {}).label || '';
        const items = gastos.length
            ? gastos.slice(0, 12).map(g => `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-orange-500/[0.04] border border-orange-500/15">
                    <div class="min-w-0">
                        <p class="text-white text-sm font-bold truncate">${esc(g.concepto)}</p>
                        <p class="text-white/40 text-[11px] truncate">${(g.fecha || '')}${g.registradoPorNombre ? ` · ${esc(g.registradoPorNombre)}` : ''}</p>
                    </div>
                    <span class="text-orange-400 text-sm font-black tabular-nums shrink-0">− ${fmtCOP(g.monto)}</span>
                </div>`).join('')
            : `<div class="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"><p class="text-white/40 text-xs text-center">Sin gastos en este período</p></div>`;
        return `
        <div class="mb-5">
            <p class="text-white/45 text-[10px] font-black uppercase tracking-[0.3em] mb-1 pl-1">Gastos · ${periodoLbl}</p>
            <p class="text-white/30 text-[10px] mb-2 pl-1">Total: <span class="text-orange-400 font-bold">${fmtCOP(total)}</span> (salen del efectivo de caja)</p>
            <div class="space-y-2">${items}</div>
            <button onclick="openGastoReportes()"
                class="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/25 text-orange-300 text-xs font-black uppercase tracking-wider hover:bg-orange-500/20 transition-all active:scale-[0.98]">
                <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1">receipt_long</span>
                Registrar gasto
            </button>
        </div>`;
    }

    let registrandoGastoRep = false;
    function openGastoModalRep() {
        if (state.sedeFilter === 'all') {
            if (typeof window.showToast === 'function') window.showToast('Elegí una sede primero', 'error');
            return;
        }
        const existing = document.getElementById('gasto-rep-overlay');
        if (existing) existing.remove();
        const html = `
        <div id="gasto-rep-overlay" class="barber-modal-overlay" style="z-index:160">
            <div class="barber-modal">
                <div class="barber-modal-header">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-orange-400 text-xl" style="font-variation-settings: 'FILL' 1">receipt_long</span>
                        </div>
                        <div class="min-w-0">
                            <h2 class="text-lg font-black text-white truncate">Registrar gasto</h2>
                            <p class="text-white/40 text-xs truncate">${sedeNombrePorId(state.sedeFilter)} · sale del efectivo</p>
                        </div>
                    </div>
                    <button onclick="closeGastoReportes()" class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/20 transition-all active:scale-90">
                        <span class="material-symbols-outlined text-white/60 text-lg">close</span>
                    </button>
                </div>
                <div class="barber-modal-body">
                    <div class="barber-form-section">
                        <div class="barber-form-label"><span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">edit_note</span><span>¿En qué fue el gasto?</span></div>
                        <input type="text" id="gasto-rep-concepto" maxlength="120" placeholder="Ej: Insumos, aseo..." class="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm font-bold placeholder-white/25 focus:outline-none focus:border-primary/50">
                    </div>
                    <div class="barber-form-section">
                        <div class="barber-form-label"><span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">payments</span><span>Monto</span></div>
                        <input type="number" id="gasto-rep-monto" inputmode="numeric" min="1" placeholder="0" class="w-full px-3 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-lg font-black tabular-nums placeholder-white/25 focus:outline-none focus:border-primary/50">
                    </div>
                </div>
                <div class="barber-modal-footer">
                    <button onclick="closeGastoReportes()" class="flex-1 px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">Cancelar</button>
                    <button id="gasto-rep-submit" onclick="submitGastoReportes()" class="flex-[2] px-5 py-3.5 rounded-xl bg-orange-500 text-black text-sm font-black uppercase tracking-wider hover:bg-orange-400 transition-all active:scale-[0.97]">Registrar gasto</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => document.getElementById('gasto-rep-overlay')?.classList.add('visible'));
        setTimeout(() => document.getElementById('gasto-rep-concepto')?.focus(), 100);
    }
    function closeGastoModalRep() {
        const ov = document.getElementById('gasto-rep-overlay');
        if (ov) { ov.classList.remove('visible'); setTimeout(() => ov.remove(), 250); }
    }
    async function submitGastoModalRep() {
        if (registrandoGastoRep) return;
        const concepto = (document.getElementById('gasto-rep-concepto')?.value || '').trim();
        const monto = Number(document.getElementById('gasto-rep-monto')?.value) || 0;
        if (!concepto) { if (typeof window.showToast === 'function') window.showToast('Escribí en qué fue el gasto', 'error'); return; }
        if (monto <= 0) { if (typeof window.showToast === 'function') window.showToast('Escribí un monto válido', 'error'); return; }
        registrandoGastoRep = true;
        const user = (typeof roleManager !== 'undefined') ? roleManager.currentUser : null;
        const id = await GastosService.create({
            sedeId: state.sedeFilter, fecha: todayISO(), concepto, monto,
            registradoPor: user?.uid || null, registradoPorNombre: user?.displayName || ''
        });
        registrandoGastoRep = false;
        if (!id) { if (typeof window.showToast === 'function') window.showToast('No se pudo registrar el gasto', 'error'); return; }
        if (typeof window.showToast === 'function') window.showToast(`Gasto de ${fmtCOP(monto)} registrado ✓`, 'success');
        closeGastoModalRep();
        init();
    }

    // ---- Bloque: Comisiones por barbero (generada − pagada = pendiente) ----

    function renderComisiones(ventas) {
        const pagos = (state.pagosComision || []).filter(p =>
            state.sedeFilter === 'all' ? true : p.sedeId === state.sedeFilter);

        // Comisión generada por barbero (de las ventas del período). Modelo
        // multi-barbero: cada venta trae `comisionPorBarbero` {barberoId: monto}.
        // (Fallback al modelo viejo barberoId/comisionMonto por si hubiera ventas
        // antiguas, aunque en producción se arrancó con 0 ventas.)
        const nombreDe = (id) => {
            const b = (state.barberos || []).find(x => x.userId === id);
            return (b && (b.userName || b.nombre)) || 'Barbero';
        };
        const agg = {};
        ventas.forEach(v => {
            const cpb = (v.comisionPorBarbero && Object.keys(v.comisionPorBarbero).length)
                ? v.comisionPorBarbero
                : (v.barberoId && Number(v.comisionMonto) > 0 ? { [v.barberoId]: Number(v.comisionMonto) } : {});
            Object.entries(cpb).forEach(([id, monto]) => {
                if (!(Number(monto) > 0)) return;
                if (!agg[id]) agg[id] = { id, nombre: nombreDe(id), sedeId: v.sedeId || null, generada: 0 };
                agg[id].generada += Number(monto) || 0;
            });
        });
        // Pagada por barbero (en el período)
        const pagadaPorBarbero = {};
        pagos.forEach(p => { pagadaPorBarbero[p.barberoId] = (pagadaPorBarbero[p.barberoId] || 0) + (Number(p.monto) || 0); });

        const lista = Object.values(agg).map(b => {
            const pagada = pagadaPorBarbero[b.id] || 0;
            return { ...b, pagada, pendiente: Math.max(0, b.generada - pagada) };
        }).sort((a, b) => b.pendiente - a.pendiente);

        // Guardar para el botón Pagar
        state.comisionesCalc = {};
        lista.forEach(b => { state.comisionesCalc[b.id] = { nombre: b.nombre, sedeId: b.sedeId, pendiente: b.pendiente }; });

        const periodoLbl = (PERIODOS.find(p => p.id === state.periodoFilter) || {}).label || '';

        if (lista.length === 0) {
            return `
            <div class="mb-5">
                <p class="text-white/45 text-[10px] font-black uppercase tracking-[0.3em] mb-2 pl-1">Comisiones · ${periodoLbl}</p>
                <div class="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <p class="text-white/40 text-xs text-center">Sin comisiones en este período</p>
                </div>
            </div>`;
        }

        const items = lista.map(b => {
            const barbero = state.barberos.find(x => x.userId === b.id);
            const nombre = barbero?.userName || b.nombre;
            const puedesPagar = b.pendiente > 0;
            return `
            <div class="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div class="flex items-center justify-between gap-2">
                    <p class="text-white text-sm font-bold truncate">${esc(nombre)}</p>
                    <button onclick="pagarComisionBarbero('${b.id}')" ${puedesPagar ? '' : 'disabled'}
                        class="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all active:scale-95
                            ${puedesPagar ? 'bg-green-500 text-black hover:bg-green-400' : 'bg-white/5 text-white/30 cursor-not-allowed'}">
                        ${puedesPagar ? 'Pagar' : 'Pagado'}
                    </button>
                </div>
                <div class="flex items-center gap-4 mt-1.5 text-[11px]">
                    <span class="text-white/45">Generada <span class="text-white/80 font-bold tabular-nums">${fmtCOP(b.generada)}</span></span>
                    <span class="text-white/45">Pagada <span class="text-white/80 font-bold tabular-nums">${fmtCOP(b.pagada)}</span></span>
                    <span class="ml-auto text-primary font-black tabular-nums">Pendiente ${fmtCOP(b.pendiente)}</span>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="mb-5">
            <p class="text-white/45 text-[10px] font-black uppercase tracking-[0.3em] mb-1 pl-1">Comisiones · ${periodoLbl}</p>
            <p class="text-white/30 text-[10px] mb-2 pl-1">Generada y pagada dentro del período seleccionado. Para liquidar el mes, mira "Este mes".</p>
            <div class="space-y-2">${items}</div>
        </div>`;
    }

    let pagandoComision = false;

    async function pagarComision(barberoId) {
        if (pagandoComision) return; // H1: evita pago doble por doble clic
        const c = state.comisionesCalc[barberoId];
        if (!c || c.pendiente <= 0) return;
        if (typeof ComisionesService === 'undefined') return;
        pagandoComision = true;
        // Deshabilita visualmente todos los botones de pago mientras se procesa.
        document.querySelectorAll('#rep-content button').forEach(b => {
            if (b.textContent.trim() === 'Pagar') b.disabled = true;
        });
        const user = (typeof roleManager !== 'undefined') ? roleManager.currentUser : null;
        const id = await ComisionesService.create({
            barberoId,
            barberoNombre: c.nombre,
            sedeId: c.sedeId,
            monto: c.pendiente,
            fecha: todayISO(),
            pagadoPor: user?.uid || null,
            pagadoPorNombre: user?.displayName || ''
        });
        if (!id) {
            pagandoComision = false;
            document.querySelectorAll('#rep-content button').forEach(b => {
                if (b.textContent.trim() === 'Pagar') b.disabled = false;
            });
            if (typeof window.showToast === 'function') window.showToast('No se pudo registrar el pago', 'error');
            return;
        }
        if (typeof window.showToast === 'function') window.showToast(`Comisión pagada a ${c.nombre}: ${fmtCOP(c.pendiente)} ✓`, 'success');
        pagandoComision = false;
        init(); // refrescar (re-render deja el botón en "Pagado")
    }

    // ---- Bloque caja: efectivo esperado + retiros (admin, por sede) ----

    function renderCajaEfectivo(ventas) {
        const agg = VentasService.aggregarPorMetodo(ventas);
        const efectivoVendido = (agg.efectivo && agg.efectivo.total) || 0;
        const retirosTotal = (typeof RetirosService !== 'undefined')
            ? RetirosService.sumTotal(state.retiros)
            : 0;
        const neto = efectivoVendido - retirosTotal;
        const periodoLbl = (PERIODOS.find(p => p.id === state.periodoFilter) || {}).label || '';

        const retirosList = (state.retiros || []).length
            ? `<div class="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                ${[...state.retiros].reverse().slice(0, 8).map(r => `
                    <div class="flex items-center justify-between text-[11px]">
                        <span class="text-white/45 truncate pr-2">${esc(r.nota) || 'Retiro'}${r.hechoPorNombre ? ` · ${esc(r.hechoPorNombre)}` : ''}</span>
                        <span class="text-red-400 font-black tabular-nums shrink-0">− ${fmtCOP(r.monto)}</span>
                    </div>`).join('')}
               </div>`
            : '';

        return `
        <div class="mb-5">
            <p class="text-white/45 text-[10px] font-black uppercase tracking-[0.3em] mb-2 pl-1">Caja · ${periodoLbl}</p>
            <div class="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div class="flex items-center justify-between">
                    <span class="text-white/55 text-xs font-bold">Efectivo vendido</span>
                    <span class="text-green-400 text-sm font-black tabular-nums">${fmtCOP(efectivoVendido)}</span>
                </div>
                <div class="flex items-center justify-between mt-1">
                    <span class="text-white/55 text-xs font-bold">Retiros</span>
                    <span class="text-red-400 text-sm font-black tabular-nums">${retirosTotal > 0 ? '− ' : ''}${fmtCOP(retirosTotal)}</span>
                </div>
                <div class="pt-2 mt-1 border-t border-white/10 flex items-center justify-between">
                    <span class="text-white text-xs font-black uppercase tracking-wider">Efectivo neto</span>
                    <span class="text-primary text-lg font-black tabular-nums">${fmtCOP(neto)}</span>
                </div>
                ${retirosList}
                <button onclick="openRetiroReportes()"
                    class="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs font-black uppercase tracking-wider hover:bg-red-500/20 transition-all active:scale-[0.98]">
                    <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1">account_balance_wallet</span>
                    Registrar retiro de caja
                </button>
            </div>
        </div>`;
    }

    // ---- Modal de retiro (admin desde reportes) ----

    let retiroRepConfirmado = false;

    function efectivoNetoSede() {
        const agg = VentasService.aggregarPorMetodo(state.ventas);
        const efectivo = (agg.efectivo && agg.efectivo.total) || 0;
        const retiros = (typeof RetirosService !== 'undefined') ? RetirosService.sumTotal(state.retiros) : 0;
        return efectivo - retiros;
    }

    function openRetiroModal() {
        if (state.sedeFilter === 'all') {
            if (typeof window.showToast === 'function') window.showToast('Elegí una sede primero', 'error');
            return;
        }
        retiroRepConfirmado = false;
        const existing = document.getElementById('retiro-rep-overlay');
        if (existing) existing.remove();
        const sedeNombre = sedeNombrePorId(state.sedeFilter);
        const html = `
        <div id="retiro-rep-overlay" class="barber-modal-overlay" style="z-index:160">
            <div class="barber-modal">
                <div class="barber-modal-header">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-red-400 text-xl" style="font-variation-settings: 'FILL' 1">account_balance_wallet</span>
                        </div>
                        <div class="min-w-0">
                            <h2 class="text-lg font-black text-white truncate">Retiro de caja</h2>
                            <p class="text-white/40 text-xs truncate">${sedeNombre}</p>
                        </div>
                    </div>
                    <button onclick="closeRetiroReportes()" class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/20 transition-all active:scale-90">
                        <span class="material-symbols-outlined text-white/60 text-lg">close</span>
                    </button>
                </div>
                <div class="barber-modal-body">
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">payments</span>
                            <span>Monto a retirar</span>
                        </div>
                        <input type="number" id="retiro-rep-monto" inputmode="numeric" min="1" placeholder="0"
                            class="w-full px-3 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-lg font-black tabular-nums placeholder-white/25 focus:outline-none focus:border-primary/50">
                        <p class="text-white/40 text-[11px] mt-1.5">Efectivo neto del período: <span class="text-primary font-bold">${fmtCOP(efectivoNetoSede())}</span></p>
                    </div>
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">edit_note</span>
                            <span>Nota (motivo)</span>
                        </div>
                        <input type="text" id="retiro-rep-nota" maxlength="200" placeholder="Ej: Retiro del dueño"
                            class="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm font-bold placeholder-white/25 focus:outline-none focus:border-primary/50">
                    </div>
                </div>
                <div class="barber-modal-footer">
                    <button onclick="closeRetiroReportes()" class="flex-1 px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Cancelar
                    </button>
                    <button id="retiro-rep-submit" onclick="submitRetiroReportes()" class="flex-[2] px-5 py-3.5 rounded-xl bg-red-500 text-white text-sm font-black uppercase tracking-wider hover:bg-red-400 transition-all active:scale-[0.97]">
                        Registrar retiro
                    </button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => document.getElementById('retiro-rep-overlay')?.classList.add('visible'));
        setTimeout(() => document.getElementById('retiro-rep-monto')?.focus(), 100);
    }

    function closeRetiroModal() {
        const overlay = document.getElementById('retiro-rep-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 250);
        }
    }

    async function submitRetiroModal() {
        const monto = Number(document.getElementById('retiro-rep-monto')?.value) || 0;
        const nota = (document.getElementById('retiro-rep-nota')?.value || '').trim();
        if (monto <= 0) {
            if (typeof window.showToast === 'function') window.showToast('Escribí un monto válido', 'error');
            return;
        }
        // H6: avisar (no bloquear) si supera el efectivo neto.
        const esperado = efectivoNetoSede();
        if (monto > esperado && !retiroRepConfirmado) {
            retiroRepConfirmado = true;
            if (typeof window.showToast === 'function') window.showToast(`Ojo: supera el efectivo neto (${fmtCOP(esperado)}). Tocá de nuevo para confirmar.`, 'info');
            const b = document.getElementById('retiro-rep-submit');
            if (b) b.textContent = 'Sí, retirar igual';
            return;
        }
        const user = (typeof roleManager !== 'undefined') ? roleManager.currentUser : null;
        const btn = document.getElementById('retiro-rep-submit');
        const orig = btn?.innerHTML;
        if (btn) { btn.disabled = true; btn.innerHTML = '<div class="auth-checking-spinner" style="width:1.2rem;height:1.2rem;border-width:2px;margin:0 auto"></div>'; }

        const id = await RetirosService.create({
            sedeId: state.sedeFilter,
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
        closeRetiroModal();
        init(); // refrescar
    }

    // ---- Bloque 1: Métricas top ----

    function renderMetricasTop(ventas) {
        // La deuda es plata facturada pero NO cobrada: no entra en "Ingresos".
        const cobradas = ventas.filter(v => v.metodoPago !== 'deuda');
        const totalIngresos = cobradas.reduce((s, v) => s + (Number(v.total) || 0), 0);
        const deudaTotal = ventas.filter(v => v.metodoPago === 'deuda').reduce((s, v) => s + (Number(v.total) || 0), 0);
        const citas = ventas.filter(v => v.tipo === 'cita');
        const walkins = citas.filter(v => v.walkin === true);
        const reservadas = citas.length - walkins.length;
        const directas = ventas.filter(v => v.tipo === 'venta_directa');
        const cortes = ventas.filter(v => v.barberoId).length; // P4: un corte = venta con barbero
        const ticketProm = cobradas.length > 0 ? totalIngresos / cobradas.length : 0;

        const card = (icon, color, label, value, sub = '') => `
            <div class="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div class="flex items-center gap-2 mb-2">
                    <span class="material-symbols-outlined ${color} text-base" style="font-variation-settings: 'FILL' 1">${icon}</span>
                    <p class="${color} text-[9px] font-black uppercase tracking-[0.2em]">${label}</p>
                </div>
                <p class="text-white text-xl font-black tabular-nums leading-none">${value}</p>
                ${sub ? `<p class="text-white/35 text-[10px] mt-1">${sub}</p>` : ''}
            </div>`;

        return `
        <div class="mb-5">
            <p class="text-white/45 text-[10px] font-black uppercase tracking-[0.3em] mb-2 pl-1">${sedeNombrePorId(state.sedeFilter)}</p>
            <!-- Ingresos full-width -->
            <div class="mb-2 p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
                <p class="text-primary text-[10px] font-black uppercase tracking-[0.3em] mb-1.5">Ingresos cobrados del período</p>
                <p class="text-primary text-3xl font-black tabular-nums leading-none">${fmtCOP(totalIngresos)}</p>
                <p class="text-white/45 text-[11px] mt-2">${ventas.length} venta${ventas.length === 1 ? '' : 's'} · Ticket promedio ${fmtCOP(ticketProm)}</p>
                ${deudaTotal > 0 ? `<p class="text-amber-400/90 text-[11px] font-bold mt-1">+ ${fmtCOP(deudaTotal)} en deuda (sin cobrar)</p>` : ''}
            </div>
            <!-- 4 cards grid -->
            <div class="grid grid-cols-2 gap-2">
                ${card('event_available', 'text-green-400', 'Citas reservadas', reservadas, reservadas > 0 ? fmtCOP(citas.filter(v => !v.walkin).reduce((s,v) => s + (Number(v.total)||0), 0)) : '')}
                ${card('store', 'text-amber-400', 'Walk-ins', walkins.length, walkins.length > 0 ? fmtCOP(walkins.reduce((s,v) => s + (Number(v.total)||0), 0)) : '')}
                ${card('shopping_bag', 'text-purple-400', 'Ventas directas', directas.length, directas.length > 0 ? fmtCOP(directas.reduce((s,v) => s + (Number(v.total)||0), 0)) : '')}
                ${card('content_cut', 'text-blue-400', 'Cortes', cortes, 'Servicios realizados')}
            </div>
        </div>`;
    }

    // ---- Bloque 2: Métodos de pago ----

    function renderMetodosPago(ventas) {
        const agg = VentasService.aggregarPorMetodo(ventas);
        const totalGeneral = Object.values(agg).reduce((s, x) => s + x.total, 0);

        const items = METODOS_ORDEN.map(m => {
            const meta = METODO_META[m];
            const data = agg[m] || { count: 0, total: 0 };
            const pct = totalGeneral > 0 ? Math.round((data.total / totalGeneral) * 100) : 0;
            return `
            <div>
                <div class="flex items-center justify-between mb-1.5">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined ${meta.cls} text-sm" style="font-variation-settings: 'FILL' 1">${meta.icon}</span>
                        <span class="text-white text-xs font-black uppercase tracking-wider">${meta.label}</span>
                        <span class="${meta.cls} text-[10px] font-bold">${pct}%</span>
                    </div>
                    <span class="${meta.cls} text-sm font-black tabular-nums">${fmtCOP(data.total)}</span>
                </div>
                <div class="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                    <div class="h-full rounded-full transition-all" style="width: ${pct}%; background-color: ${meta.color};"></div>
                </div>
                <p class="text-white/35 text-[10px] mt-1">${data.count} venta${data.count === 1 ? '' : 's'}</p>
            </div>`;
        }).join('');

        return `
        <div class="mb-5">
            <p class="text-white/45 text-[10px] font-black uppercase tracking-[0.3em] mb-2 pl-1">Métodos de pago</p>
            <div class="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-4">
                ${items}
            </div>
        </div>`;
    }

    // ---- Bloque 3: Top 5 barberos ----

    function renderTopBarberos(ventas) {
        // Solo ventas con barbero (citas)
        const conBarbero = ventas.filter(v => v.barberoId);
        const agg = {};
        conBarbero.forEach(v => {
            const id = v.barberoId;
            if (!agg[id]) agg[id] = { id, nombre: v.barberoNombre || 'Barbero', total: 0, count: 0 };
            agg[id].total += Number(v.total) || 0;
            agg[id].count += 1;
        });
        const top = Object.values(agg).sort((a, b) => b.total - a.total).slice(0, 5);

        if (top.length === 0) {
            return `
            <div class="mb-5">
                <p class="text-white/45 text-[10px] font-black uppercase tracking-[0.3em] mb-2 pl-1">Top barberos</p>
                <div class="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <p class="text-white/40 text-xs text-center">Sin citas cobradas en este período</p>
                </div>
            </div>`;
        }

        const maxTotal = top[0].total || 1;

        const items = top.map((b, i) => {
            const barbero = state.barberos.find(x => x.userId === b.id);
            const nombre = barbero?.userName || b.nombre;
            const fallbackFoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=c9a74a&color=000&size=80&bold=true`;
            const foto = barbero?.userPhoto || fallbackFoto;
            const pct = Math.round((b.total / maxTotal) * 100);

            return `
            <div class="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span class="w-5 text-center text-primary text-xs font-black tabular-nums">${i + 1}</span>
                <img src="${foto}" alt="" loading="lazy" referrerpolicy="no-referrer"
                    onerror="this.onerror=null;this.src='${fallbackFoto}';"
                    class="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0">
                <div class="flex-1 min-w-0">
                    <p class="text-white text-sm font-bold truncate">${esc(nombre)}</p>
                    <div class="h-1.5 mt-1 rounded-full bg-white/[0.05] overflow-hidden">
                        <div class="h-full bg-primary/70 rounded-full" style="width:${pct}%"></div>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <p class="text-primary text-sm font-black tabular-nums">${fmtCOP(b.total)}</p>
                    <p class="text-white/40 text-[10px]">${b.count} cita${b.count === 1 ? '' : 's'}</p>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="mb-5">
            <p class="text-white/45 text-[10px] font-black uppercase tracking-[0.3em] mb-2 pl-1">Top barberos</p>
            <div class="space-y-2">${items}</div>
        </div>`;
    }

    // ---- Bloque 4: Top 5 productos ----

    function renderTopProductos(ventas) {
        const agg = {};
        ventas.forEach(v => {
            (v.items || []).forEach(it => {
                if (it.tipo !== 'producto') return;
                const id = it.productoId || it.nombre; // fallback si productoId faltara
                if (!agg[id]) agg[id] = { id, nombre: it.nombre, cantidad: 0, ingresos: 0 };
                agg[id].cantidad += Number(it.cantidad) || 1;
                agg[id].ingresos += Number(it.subtotal) || 0;
            });
        });
        const top = Object.values(agg).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);

        if (top.length === 0) {
            return `
            <div class="mb-5">
                <p class="text-white/45 text-[10px] font-black uppercase tracking-[0.3em] mb-2 pl-1">Top productos</p>
                <div class="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <p class="text-white/40 text-xs text-center">No se vendieron productos en este período</p>
                </div>
            </div>`;
        }

        const maxCant = top[0].cantidad || 1;
        const items = top.map((p, i) => {
            const pct = Math.round((p.cantidad / maxCant) * 100);
            // Resolver nombre actual del catálogo (cobre desactivados también)
            const cat = state.productos.find(x => x.id === p.id);
            const nombre = cat?.nombre || p.nombre;
            return `
            <div class="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span class="w-5 text-center text-primary text-xs font-black tabular-nums">${i + 1}</span>
                <div class="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1">shopping_bag</span>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-white text-sm font-bold truncate">${esc(nombre)}</p>
                    <div class="h-1.5 mt-1 rounded-full bg-white/[0.05] overflow-hidden">
                        <div class="h-full bg-primary/70 rounded-full" style="width:${pct}%"></div>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <p class="text-white text-sm font-black tabular-nums">${p.cantidad}</p>
                    <p class="text-primary text-[10px] font-bold tabular-nums">${fmtCOP(p.ingresos)}</p>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="mb-5">
            <p class="text-white/45 text-[10px] font-black uppercase tracking-[0.3em] mb-2 pl-1">Top productos</p>
            <div class="space-y-2">${items}</div>
        </div>`;
    }

    // ---- Bloque 5: Ingresos por día ----

    function renderIngresosPorDia(ventas) {
        const { desde, hasta } = rangoActual();
        // Construir lista de días del rango
        const fechas = [];
        const [yD, mD, dD] = desde.split('-').map(Number);
        const [yH, mH, dH] = hasta.split('-').map(Number);
        const start = new Date(yD, mD - 1, dD);
        const end = new Date(yH, mH - 1, dH);
        const cur = new Date(start);
        while (cur <= end) {
            fechas.push(toISO(cur));
            cur.setDate(cur.getDate() + 1);
        }

        // Agregar ventas por fecha
        const totals = {};
        fechas.forEach(f => { totals[f] = 0; });
        ventas.forEach(v => {
            if (totals[v.fecha] !== undefined) {
                totals[v.fecha] += Number(v.total) || 0;
            }
        });

        const max = Math.max(...Object.values(totals), 1);
        // FIX F5-#4: etiquetas visibles arriba de barras no-cero (no solo en
        // hover). Funciona en móvil táctil. Usamos fmtAbbrev para que entre.
        const bars = fechas.map(f => {
            const total = totals[f];
            const pct = max > 0 ? Math.round((total / max) * 100) : 0;
            const [y, m, d] = f.split('-').map(Number);
            const date = new Date(y, m - 1, d);
            const isHoy = f === todayISO();
            const valorLabel = total > 0
                ? `<span class="text-primary text-[8px] font-black tabular-nums leading-none">${fmtAbbrev(total)}</span>`
                : `<span class="text-white/15 text-[8px] font-black leading-none">·</span>`;
            return `
            <div class="flex flex-col items-center gap-1 min-w-[36px]">
                ${valorLabel}
                <div class="relative w-6 h-28 bg-white/[0.03] rounded-md overflow-hidden flex items-end" title="${fmtCOP(total)} el ${date.getDate()} ${MESES[date.getMonth()]}">
                    <div class="w-full ${isHoy ? 'bg-primary' : 'bg-primary/40'} transition-all" style="height: ${pct}%"></div>
                </div>
                <span class="text-white/50 text-[9px] font-bold tabular-nums">${date.getDate()}</span>
                <span class="text-white/30 text-[8px] font-bold uppercase">${DIAS_SEMANA_LBL[date.getDay()][0]}</span>
            </div>`;
        }).join('');

        const totalRango = Object.values(totals).reduce((s, v) => s + v, 0);
        const promDiario = fechas.length > 0 ? totalRango / fechas.length : 0;

        return `
        <div class="mb-5">
            <p class="text-white/45 text-[10px] font-black uppercase tracking-[0.3em] mb-2 pl-1">Ingresos por día</p>
            <div class="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div class="flex items-end gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                    ${bars}
                </div>
                <div class="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                    <span class="text-white/45 text-[10px] font-bold uppercase tracking-wider">Promedio diario</span>
                    <span class="text-primary text-sm font-black tabular-nums">${fmtCOP(promDiario)}</span>
                </div>
            </div>
        </div>`;
    }

    // ============================================
    // EXPONER
    // ============================================

    window.initReportes = init;
    window.reloadReportes = init;
    window.setReportesSede = setSede;
    window.setReportesPeriodo = setPeriodo;
    window.openRetiroReportes = openRetiroModal;
    window.closeRetiroReportes = closeRetiroModal;
    window.submitRetiroReportes = submitRetiroModal;
    window.pagarComisionBarbero = pagarComision;
    window.openGastoReportes = openGastoModalRep;
    window.closeGastoReportes = closeGastoModalRep;
    window.submitGastoReportes = submitGastoModalRep;

    console.log('✓ admin/reportes-ui (F5) loaded');
})();
