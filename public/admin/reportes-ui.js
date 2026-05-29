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

    const PERIODOS = [
        { id: 'hoy',     label: 'Hoy',      days: 1  },
        { id: 'semana',  label: 'Semana',   days: 7  },
        { id: 'mes',     label: 'Mes',      days: 30 },
        { id: '30dias',  label: '30 días',  days: 30 }
    ];

    const METODO_META = {
        efectivo:      { label: 'Efectivo',      icon: 'payments',        color: '#22c55e', cls: 'text-green-400' },
        tarjeta:       { label: 'Tarjeta',       icon: 'credit_card',     color: '#3b82f6', cls: 'text-blue-400'  },
        transferencia: { label: 'Transferencia', icon: 'account_balance', color: '#a855f7', cls: 'text-purple-400' }
    };

    // ============================================
    // ESTADO
    // ============================================

    const state = {
        sedes: [],
        sedeFilter: 'all',         // 'all' | sedeId
        periodoFilter: 'mes',      // PERIODOS[].id
        ventas: [],
        barberos: [],              // para resolver nombres + fotos
        productos: [],             // catálogo (todos) para resolver nombres
        loading: false
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
        if (periodo.id === 'mes') {
            // Primer día del mes actual
            const d = new Date();
            d.setDate(1);
            return { desde: toISO(d), hasta };
        }
        // 30dias
        return { desde: offsetISO(-29), hasta };
    }

    function fmtCOP(n) {
        return (typeof window.formatCOP === 'function') ? window.formatCOP(n || 0) : `$${n || 0}`;
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

        renderFiltros();

        if (!state.loading) state.loading = true;
        content.innerHTML = `
            <div class="flex flex-col items-center gap-3 py-12">
                <div class="auth-checking-spinner"></div>
                <p class="text-white/50 text-xs">Cargando reportes...</p>
            </div>`;

        try {
            const { desde, hasta } = rangoActual();

            // Carga en paralelo: sedes (para filtro), barberos (para nombres),
            // productos (para resolver nombres), y ventas según filtro de sede.
            const [sedes, barberos, productos, ventas] = await Promise.all([
                (typeof SedesService !== 'undefined') ? SedesService.list() : Promise.resolve([]),
                (typeof BarbersService !== 'undefined') ? BarbersService.list() : Promise.resolve([]),
                (typeof ProductosService !== 'undefined') ? ProductosService.list() : Promise.resolve([]),
                state.sedeFilter === 'all'
                    ? VentasService.listByRange(desde, hasta)
                    : VentasService.listBySedeRange(state.sedeFilter, desde, hasta)
            ]);

            state.sedes = sedes;
            state.barberos = barberos;
            state.productos = productos;
            state.ventas = ventas || [];

            renderFiltros(); // re-render con sedes ya cargadas
            renderContenido();
        } catch (e) {
            console.error('❌ Error cargando reportes:', e);
            content.innerHTML = `
                <div class="text-center py-10 px-6 rounded-xl bg-red-500/5 border border-red-500/15">
                    <span class="material-symbols-outlined text-red-400 text-4xl mb-2">error</span>
                    <p class="text-red-400 text-sm font-bold">No se pudieron cargar los reportes</p>
                    <button onclick="initReportes()" class="mt-4 px-4 py-2 bg-primary/20 text-primary text-xs font-black rounded-lg border border-primary/30">
                        Reintentar
                    </button>
                </div>`;
        } finally {
            state.loading = false;
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

        if (ventas.length === 0) {
            content.innerHTML = `
                <div class="flex flex-col items-center gap-3 py-12 px-6 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <span class="material-symbols-outlined text-white/20 text-5xl" style="font-variation-settings: 'FILL' 1">query_stats</span>
                    <p class="text-white/50 text-sm font-bold text-center">Sin ventas en este período</p>
                    <p class="text-white/25 text-[11px] text-center">Probá cambiando sede o período</p>
                </div>`;
            return;
        }

        content.innerHTML = [
            renderMetricasTop(ventas),
            renderMetodosPago(ventas),
            renderTopBarberos(ventas),
            renderTopProductos(ventas),
            renderIngresosPorDia(ventas)
        ].join('');
    }

    // ---- Bloque 1: Métricas top ----

    function renderMetricasTop(ventas) {
        const totalIngresos = ventas.reduce((s, v) => s + (Number(v.total) || 0), 0);
        const citas = ventas.filter(v => v.tipo === 'cita');
        const walkins = citas.filter(v => v.walkin === true);
        const reservadas = citas.length - walkins.length;
        const directas = ventas.filter(v => v.tipo === 'venta_directa');
        const ticketProm = ventas.length > 0 ? totalIngresos / ventas.length : 0;

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
                <p class="text-primary text-[10px] font-black uppercase tracking-[0.3em] mb-1.5">Ingresos del período</p>
                <p class="text-primary text-3xl font-black tabular-nums leading-none">${fmtCOP(totalIngresos)}</p>
                <p class="text-white/45 text-[11px] mt-2">${ventas.length} venta${ventas.length === 1 ? '' : 's'} · Ticket promedio ${fmtCOP(ticketProm)}</p>
            </div>
            <!-- 4 cards grid -->
            <div class="grid grid-cols-2 gap-2">
                ${card('event_available', 'text-green-400', 'Citas reservadas', reservadas, reservadas > 0 ? fmtCOP(citas.filter(v => !v.walkin).reduce((s,v) => s + (Number(v.total)||0), 0)) : '')}
                ${card('store', 'text-amber-400', 'Walk-ins', walkins.length, walkins.length > 0 ? fmtCOP(walkins.reduce((s,v) => s + (Number(v.total)||0), 0)) : '')}
                ${card('shopping_bag', 'text-purple-400', 'Ventas directas', directas.length, directas.length > 0 ? fmtCOP(directas.reduce((s,v) => s + (Number(v.total)||0), 0)) : '')}
                ${card('receipt_long', 'text-blue-400', 'Operaciones', ventas.length, 'Citas + ventas')}
            </div>
        </div>`;
    }

    // ---- Bloque 2: Métodos de pago ----

    function renderMetodosPago(ventas) {
        const agg = VentasService.aggregarPorMetodo(ventas);
        const totalGeneral = Object.values(agg).reduce((s, x) => s + x.total, 0);

        const items = ['efectivo', 'tarjeta', 'transferencia'].map(m => {
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
                    <p class="text-white text-sm font-bold truncate">${nombre}</p>
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
                    <p class="text-white text-sm font-bold truncate">${nombre}</p>
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
        const bars = fechas.map(f => {
            const total = totals[f];
            const pct = max > 0 ? Math.round((total / max) * 100) : 0;
            const [y, m, d] = f.split('-').map(Number);
            const date = new Date(y, m - 1, d);
            const isHoy = f === todayISO();
            return `
            <div class="flex flex-col items-center gap-1 min-w-[36px]">
                <div class="relative w-6 h-32 bg-white/[0.03] rounded-md overflow-hidden flex items-end" title="${fmtCOP(total)} el ${date.getDate()} ${MESES[date.getMonth()]}">
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

    console.log('✓ admin/reportes-ui (F5) loaded');
})();
