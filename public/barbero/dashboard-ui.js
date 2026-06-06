/**
 * LEGENDS BARBERIA - BARBERO: DASHBOARD (P4 + P10)
 *
 * Reemplaza el dashboard hardcodeado por datos REALES del barbero logueado:
 *   - Cortes de hoy, ingresos de hoy, citas próximas (confirmadas), rating.
 *   - Su nivel (asignado por el admin — solo se muestra, no se calcula).
 *   - Su comisión del mes: generada − pagada = pendiente.
 *   - Registro de cortes del mes (para que lleve su cuenta).
 *
 * Fuentes: BarbersService (nivel/rating/comisión), CitasService.listByBarbero,
 * VentasService.listByBarberoRange, ComisionesService.listByBarbero.
 */
(function () {
    'use strict';

    function getCurrentUser() {
        return (typeof roleManager !== 'undefined') ? roleManager.currentUser : null;
    }
    function fmtCOP(n) {
        return (typeof window.formatCOP === 'function') ? window.formatCOP(n || 0) : `$${n || 0}`;
    }
    function todayISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function monthStartISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    }
    function esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function setText(id, txt) {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
    }

    async function init() {
        const root = document.getElementById('bdash-root');
        if (!root) return;
        const user = getCurrentUser();
        if (!user || !user.uid) return;

        try {
            const hoy = todayISO();
            const desdeMes = monthStartISO();
            const [barberos, citas, ventasMes, pagos] = await Promise.all([
                (typeof BarbersService !== 'undefined') ? BarbersService.list() : Promise.resolve([]),
                (typeof CitasService !== 'undefined') ? CitasService.listByBarbero(user.uid) : Promise.resolve([]),
                (typeof VentasService !== 'undefined') ? VentasService.listByBarberoRange(user.uid, desdeMes, hoy) : Promise.resolve([]),
                (typeof ComisionesService !== 'undefined') ? ComisionesService.listByBarbero(user.uid) : Promise.resolve([])
            ]);

            const miBarbero = (barberos || []).find(b => b.userId === user.uid) || {};

            // --- Stats del día ---
            const ventasHoy = (ventasMes || []).filter(v => v.fecha === hoy);
            const cortesHoy = ventasHoy.length;
            const ingresosHoy = ventasHoy.reduce((s, v) => s + (Number(v.total) || 0), 0);
            // H2: solo confirmadas de hoy en adelante (no las viejas sin completar).
            const confirmadas = (citas || []).filter(c => c.estado === 'confirmada' && (c.fecha || '') >= hoy);

            setText('bdash-cortes-hoy', cortesHoy);
            setText('bdash-ingresos-hoy', fmtCOP(ingresosHoy));
            setText('bdash-citas-pendientes', confirmadas.length);

            // --- Rating ---
            const prom = Number(miBarbero.ratingPromedio) || 0;
            const cnt = Number(miBarbero.ratingCount) || 0;
            setText('bdash-rating', cnt > 0 ? prom.toFixed(1) : '—');
            setText('bdash-rating-count', cnt > 0 ? `${cnt} reseña${cnt === 1 ? '' : 's'}` : 'Sin reseñas');

            // --- Nivel (manual, solo mostrar) ---
            renderNivel(miBarbero.nivel || '');

            // --- Comisión del mes ---
            const comisionGenerada = (ventasMes || []).reduce((s, v) => s + (Number(v.comisionMonto) || 0), 0);
            const comisionPagada = (pagos || [])
                .filter(p => (p.fecha || '') >= desdeMes && (p.fecha || '') <= hoy)
                .reduce((s, p) => s + (Number(p.monto) || 0), 0);
            const comisionPendiente = Math.max(0, comisionGenerada - comisionPagada);
            setText('bdash-comision-generada', fmtCOP(comisionGenerada));
            setText('bdash-comision-pagada', fmtCOP(comisionPagada));
            setText('bdash-comision-pendiente', fmtCOP(comisionPendiente));

            // --- Registro de cortes del mes ---
            renderCortes(ventasMes || []);
        } catch (e) {
            console.error('❌ Error cargando dashboard del barbero:', e);
            const list = document.getElementById('bdash-cortes-list');
            if (list) {
                list.innerHTML = `
                    <div class="text-center py-10 px-6 rounded-xl bg-red-500/5 border border-red-500/15">
                        <span class="material-symbols-outlined text-red-400 text-4xl mb-2">error</span>
                        <p class="text-red-400 text-sm font-bold">No se pudo cargar tu dashboard</p>
                        <button onclick="initBarberoDashboard()" class="mt-4 px-4 py-2 bg-primary/20 text-primary text-xs font-black rounded-lg border border-primary/30">
                            Reintentar
                        </button>
                    </div>`;
            }
        }
    }

    function renderNivel(nivel) {
        const el = document.getElementById('bdash-nivel');
        if (!el) return;
        if (!nivel) { el.innerHTML = ''; return; }
        const theme = (typeof window.nivelTheme === 'function') ? window.nivelTheme(nivel) : null;
        const color = theme?.text || 'text-primary';
        const bg = theme?.bg || 'bg-primary/10';
        const border = theme?.border || 'border-primary/25';
        el.innerHTML = `
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${bg} ${color} ${border} border text-xs font-black uppercase tracking-wider">
                <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1">military_tech</span>
                Nivel ${esc(nivel)}
            </span>`;
    }

    function renderCortes(ventas) {
        const list = document.getElementById('bdash-cortes-list');
        if (!list) return;
        if (!ventas.length) {
            list.innerHTML = `
                <div class="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <p class="text-white/40 text-xs text-center">Aún no tienes cortes este mes</p>
                </div>`;
            return;
        }
        list.innerHTML = ventas.map(v => {
            const hora = v.fechaHora?.toDate
                ? v.fechaHora.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
                : (v.fechaHora?.seconds ? new Date(v.fechaHora.seconds * 1000).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : (v.fecha || ''));
            const comision = Number(v.comisionMonto) || 0;
            const deuda = v.metodoPago === 'deuda';
            return `
            <div class="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div class="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">content_cut</span>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-white text-sm font-bold truncate">${esc(v.clienteNombre || 'Cliente')}</p>
                    <p class="text-white/40 text-[11px]">${hora}${deuda ? ' · <span class="text-amber-400 font-bold">deuda</span>' : ''}</p>
                </div>
                <div class="text-right shrink-0">
                    <p class="text-white text-sm font-black tabular-nums">${fmtCOP(v.total)}</p>
                    <p class="text-primary text-[10px] font-bold tabular-nums">comisión ${fmtCOP(comision)}</p>
                </div>
            </div>`;
        }).join('');
    }

    window.initBarberoDashboard = init;
    window.reloadBarberoDashboard = init;
    console.log('✓ BarberoDashboardUI (P4+P10) loaded');
})();
