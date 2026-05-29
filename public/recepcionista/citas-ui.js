/**
 * LEGENDS BARBERIA - RECEPCIONISTA: CITAS (F2)
 *
 * La recepcionista ve las citas de su sede y puede:
 *   - Confirmar pendientes
 *   - Cancelar
 *   - Marcar completada
 *   - Marcar no llegó
 *   - Reagendar (overlay con nueva fecha/hora — definido en reagendar-ui.js)
 *   - Crear walk-ins (FAB → modal definido en walkin-ui.js)
 *
 * Carga 1 sola query del rango [hoy-30d, hoy+30d] y navega in-memory.
 *
 * Estado se expone en window.recepState para que walkin-ui.js y reagendar-ui.js
 * (modales separados) puedan leer la sede actual, los barberos cacheados, etc.
 */
(function () {
    'use strict';

    const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    // Estado compartido (lo leen walkin-ui y reagendar-ui)
    const state = {
        sedeId: null,
        sedeNombre: '',
        sedes: [],
        barberos: [],            // todos los barberos de la sede
        citasRango: [],          // dataset cacheado
        citasPorFecha: new Map(),// "YYYY-MM-DD" -> citas[]
        fechaActual: null,       // "YYYY-MM-DD" del día visible
        loaded: false
    };
    window.recepState = state;

    // ============================================
    // UTILS DE FECHA
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
    function parseFechaHora(fecha, hora) {
        const [y, m, d] = fecha.split('-').map(Number);
        const [hh, mm] = (hora || '00:00').split(':').map(Number);
        return new Date(y, m - 1, d, hh, mm);
    }
    function formatearFechaLarga(iso) {
        const [y, m, d] = iso.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        return `${DIAS_SEMANA[date.getDay()]} ${date.getDate()} de ${MESES[date.getMonth()]}`;
    }
    function diasDesdeHoy(iso) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const [y, m, d] = iso.split('-').map(Number);
        const date = new Date(y, m - 1, d); date.setHours(0, 0, 0, 0);
        return Math.round((date - today) / 86400000);
    }
    function esHoy(iso) { return iso === todayISO(); }

    function getCurrentUser() {
        return (typeof roleManager !== 'undefined' && roleManager.currentUser) ? roleManager.currentUser : null;
    }

    // ============================================
    // CARGA INICIAL
    // ============================================

    async function init() {
        const sedeLabel = document.getElementById('recep-sede-label');
        const content = document.getElementById('recep-citas-content');
        if (!content) return;

        const user = getCurrentUser();
        if (!user || !user.uid) return renderFatal('No hay sesión activa');
        if (user.role !== 'recepcionista') return renderFatal('Esta pantalla es solo para recepcionistas');

        state.sedeId = user.sedeId || null;
        if (!state.sedeId) {
            if (sedeLabel) sedeLabel.textContent = 'Sin sede asignada';
            return renderFatal('No tenés sede asignada. Pedile al admin que te la asigne.');
        }

        // Skeleton inicial
        content.innerHTML = `
            <div class="flex flex-col items-center gap-3 py-12">
                <div class="auth-checking-spinner"></div>
                <p class="text-white/50 text-xs">Cargando citas...</p>
            </div>`;

        try {
            const desde = offsetISO(-30);
            const hasta = offsetISO(30);

            const [citas, sedes, barberos] = await Promise.all([
                CitasService.listBySedeRange(state.sedeId, desde, hasta),
                (typeof SedesService !== 'undefined') ? SedesService.list() : Promise.resolve([]),
                (typeof BarbersService !== 'undefined') ? BarbersService.list() : Promise.resolve([])
            ]);

            state.sedes = sedes;
            state.sedeNombre = (typeof SedesService !== 'undefined')
                ? SedesService.nombreById(sedes, state.sedeId)
                : '';
            state.citasRango = citas || [];
            // Solo barberos de SU sede (con fallback de migración: sin sedeId → primera sede)
            state.barberos = (barberos || []).filter(b => {
                if (b.sedeId === state.sedeId) return true;
                if (!b.sedeId && sedes.length > 0 && sedes[0].id === state.sedeId) return true;
                return false;
            });

            recomputarAgrupacion();
            if (!state.fechaActual) state.fechaActual = todayISO();
            state.loaded = true;

            render();
        } catch (error) {
            console.error('❌ Error cargando citas recepcionista:', error);
            content.innerHTML = renderError('No se pudieron cargar las citas');
        }
    }

    function recomputarAgrupacion() {
        state.citasPorFecha = new Map();
        state.citasRango.forEach(c => {
            if (!c.fecha) return;
            if (!state.citasPorFecha.has(c.fecha)) state.citasPorFecha.set(c.fecha, []);
            state.citasPorFecha.get(c.fecha).push(c);
        });
        state.citasPorFecha.forEach(arr => arr.sort((a, b) => (a.hora || '').localeCompare(b.hora || '')));
    }

    // ============================================
    // RENDER
    // ============================================

    function render() {
        renderHeader();
        renderBody();
    }

    function renderHeader() {
        const sedeLabel = document.getElementById('recep-sede-label');
        const dateLabel = document.getElementById('recep-date-label');
        const dateSub = document.getElementById('recep-date-sub');
        const todayBtn = document.getElementById('recep-today-btn');

        if (sedeLabel) {
            sedeLabel.textContent = state.sedeNombre ? `Sede ${state.sedeNombre}` : 'Sin sede';
        }
        if (dateLabel) dateLabel.textContent = formatearFechaLarga(state.fechaActual);

        const delta = diasDesdeHoy(state.fechaActual);
        let sub;
        if (delta === 0) sub = 'Hoy';
        else if (delta === 1) sub = 'Mañana';
        else if (delta === -1) sub = 'Ayer';
        else if (delta > 0) sub = `En ${delta} días`;
        else sub = `Hace ${Math.abs(delta)} días`;
        const citasDia = state.citasPorFecha.get(state.fechaActual) || [];
        const totalTxt = citasDia.length > 0 ? ` · ${citasDia.length} cita${citasDia.length === 1 ? '' : 's'}` : '';
        if (dateSub) dateSub.textContent = `${sub}${totalTxt}`;

        if (todayBtn) todayBtn.classList.toggle('hidden', esHoy(state.fechaActual));
    }

    function renderBody() {
        const content = document.getElementById('recep-citas-content');
        if (!content) return;
        const citasDia = state.citasPorFecha.get(state.fechaActual) || [];
        if (citasDia.length === 0) {
            content.innerHTML = renderEmpty();
            return;
        }
        content.innerHTML = citasDia.map(citaCard).join('');
    }

    function renderEmpty() {
        return `
            <div class="flex flex-col items-center gap-3 py-12 px-6 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span class="material-symbols-outlined text-white/20 text-5xl" style="font-variation-settings: 'FILL' 1">event_busy</span>
                <p class="text-white/50 text-sm font-bold text-center">Sin citas en este día</p>
                <p class="text-white/25 text-[11px] text-center">Usá las flechas para navegar o registrá un walk-in</p>
            </div>
        `;
    }

    function renderError(msg) {
        return `
            <div class="text-center py-10 px-6 rounded-xl bg-red-500/5 border border-red-500/15">
                <span class="material-symbols-outlined text-red-400 text-4xl mb-2">error</span>
                <p class="text-red-400 text-sm font-bold">${msg}</p>
                <button onclick="initRecepcionistaCitas()" class="mt-4 px-4 py-2 bg-primary/20 text-primary text-xs font-black rounded-lg border border-primary/30">
                    Reintentar
                </button>
            </div>`;
    }

    function renderFatal(msg) {
        const content = document.getElementById('recep-citas-content');
        if (content) content.innerHTML = renderError(msg);
    }

    // ============================================
    // CARD DE CITA + ACCIONES
    // ============================================

    const ESTADO_STYLE = {
        pendiente:  { dot: 'bg-amber-400',  label: 'Sin confirmar', cls: 'text-amber-400', border: 'border-amber-500/30' },
        confirmada: { dot: 'bg-green-400',  label: 'Confirmada',    cls: 'text-green-400', border: 'border-green-500/20' },
        completada: { dot: 'bg-blue-400',   label: 'Completada',    cls: 'text-blue-400',  border: 'border-blue-500/20' },
        cancelada:  { dot: 'bg-white/25',   label: 'Cancelada',     cls: 'text-white/40',  border: 'border-white/5' },
        no_show:    { dot: 'bg-white/40',   label: 'No llegó',      cls: 'text-white/50',  border: 'border-white/5' }
    };

    function citaCard(cita) {
        const estado = ESTADO_STYLE[cita.estado] || ESTADO_STYLE.pendiente;
        const cliente = cita.clienteNombre || 'Cliente';
        const barbero = cita.barberoNombre || 'Barbero';
        const servicio = cita.servicioNombre || 'Corte';
        const precio = (typeof window.formatCOP === 'function')
            ? window.formatCOP(cita.servicioPrecio || cita.total || 0)
            : `$${cita.servicioPrecio || 0}`;
        const hora = cita.hora || '--:--';
        const walkinBadge = cita.walkin
            ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/15 text-primary text-[9px] font-black uppercase tracking-wider border border-primary/25">
                  <span class="material-symbols-outlined text-[10px]">store</span>Walk-in
               </span>`
            : '';

        const initial = (cliente.trim().charAt(0) || 'C').toUpperCase();
        const photo = cita.clientePhotoURL || '';
        const photoEl = photo
            ? `<img src="${photo.replace(/=s\d+(-c)?/g, '=s96-c')}" alt="" referrerpolicy="no-referrer"
                  class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300"
                  onload="this.style.opacity=1" onerror="this.remove()">`
            : '';

        const actions = renderActions(cita);

        return `
        <div class="p-4 rounded-2xl bg-white/[0.03] border ${estado.border}" data-cita-id="${cita.id}">
            <div class="flex items-center gap-3">
                <div class="text-center shrink-0">
                    <p class="text-primary text-lg font-black leading-none tabular-nums">${hora}</p>
                </div>
                <div class="relative w-11 h-11 rounded-full border-2 border-white/10 overflow-hidden bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center shrink-0">
                    <span class="text-black text-sm font-black">${initial}</span>
                    ${photoEl}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                        <p class="text-white font-bold text-sm truncate">${cliente}</p>
                        ${walkinBadge}
                    </div>
                    <p class="text-white/45 text-[11px] truncate">${servicio} · con ${barbero}</p>
                </div>
                <div class="flex flex-col items-end gap-1 shrink-0">
                    <span class="text-primary text-sm font-black tabular-nums">${precio}</span>
                    <span class="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider ${estado.cls}">
                        <span class="w-1.5 h-1.5 rounded-full ${estado.dot}"></span>
                        ${estado.label}
                    </span>
                </div>
            </div>
            ${actions}
        </div>`;
    }

    /**
     * Botones según el estado de la cita:
     *   pendiente  → Confirmar + Cancelar
     *   confirmada → Completar + No llegó + Reagendar + Cancelar
     *   completada → (read-only)
     *   cancelada  → (read-only)
     *   no_show    → (read-only)
     */
    function renderActions(cita) {
        const estado = cita.estado;
        const id = cita.id;

        if (estado === 'pendiente') {
            return `
                <div class="mt-3 grid grid-cols-2 gap-2">
                    <button onclick="recepConfirmar('${id}')"
                        class="px-3 py-2.5 rounded-xl bg-green-500/20 border border-green-500/35 text-green-400 text-[11px] font-black uppercase tracking-wide hover:bg-green-500/30 transition-all active:scale-95 flex items-center justify-center gap-1.5">
                        <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1">check_circle</span>
                        Confirmar
                    </button>
                    <button onclick="recepCancelar('${id}')"
                        class="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 text-[11px] font-black uppercase tracking-wide hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/25 transition-all active:scale-95 flex items-center justify-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">cancel</span>
                        Cancelar
                    </button>
                </div>`;
        }

        if (estado === 'confirmada') {
            return `
                <div class="mt-3 grid grid-cols-2 gap-2">
                    <button onclick="recepCompletar('${id}')"
                        class="px-3 py-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[11px] font-black uppercase tracking-wide hover:bg-blue-500/30 transition-all active:scale-95 flex items-center justify-center gap-1.5">
                        <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1">check</span>
                        Completar
                    </button>
                    <button onclick="recepNoShow('${id}')"
                        class="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 text-[11px] font-black uppercase tracking-wide hover:bg-white/[0.08] transition-all active:scale-95 flex items-center justify-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">person_off</span>
                        No llegó
                    </button>
                    <button onclick="if(typeof openReagendarOverlay==='function')openReagendarOverlay('${id}')"
                        class="px-3 py-2.5 rounded-xl bg-primary/15 border border-primary/25 text-primary text-[11px] font-black uppercase tracking-wide hover:bg-primary/25 transition-all active:scale-95 flex items-center justify-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">edit_calendar</span>
                        Reagendar
                    </button>
                    <button onclick="recepCancelar('${id}')"
                        class="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 text-[11px] font-black uppercase tracking-wide hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/25 transition-all active:scale-95 flex items-center justify-center gap-1.5">
                        <span class="material-symbols-outlined text-sm">cancel</span>
                        Cancelar
                    </button>
                </div>`;
        }

        // completada / cancelada / no_show → sin acciones
        return '';
    }

    // ============================================
    // ACCIONES
    // ============================================

    function localUpdate(citaId, fields) {
        const c = state.citasRango.find(x => x.id === citaId);
        if (c) Object.assign(c, fields);
        recomputarAgrupacion();
        render();
    }

    function toast(msg, type) {
        if (typeof window.showToast === 'function') window.showToast(msg, type || 'success');
    }

    async function recepConfirmar(citaId) {
        if (!window.confirm('¿Confirmar esta cita?')) return;
        const user = getCurrentUser();
        const ok = await CitasService.confirmar(citaId, user?.uid || 'recepcionista');
        if (ok) {
            localUpdate(citaId, { estado: 'confirmada' });
            toast('Cita confirmada ✓', 'success');
        } else {
            toast('No se pudo confirmar', 'error');
        }
    }

    async function recepCancelar(citaId) {
        if (!window.confirm('¿Cancelar esta cita?')) return;
        const ok = await CitasService.cancelar(citaId);
        if (ok) {
            localUpdate(citaId, { estado: 'cancelada' });
            toast('Cita cancelada', 'info');
        } else {
            toast('No se pudo cancelar', 'error');
        }
    }

    /**
     * F3: completar pasa por COBRAR. El overlay de cobro crea la venta y, si
     * sale OK, marca la cita completada con totalCobrado + metodoPago
     * denormalizados (para que el cliente vea su recibo en perfil).
     *
     * Si por alguna razón no se quiere cobrar (cortesía, prueba), el flujo
     * cancela el overlay y la cita queda en confirmada.
     */
    function recepCompletar(citaId) {
        const cita = state.citasRango.find(c => c.id === citaId);
        if (!cita) return;
        if (typeof window.openCobrarParaCita !== 'function') {
            toast('Módulo de cobro no cargado', 'error');
            return;
        }
        window.openCobrarParaCita(cita);
    }

    /**
     * Hook llamado por cobrar-ui.js cuando una venta de cita se concretó:
     * marca la cita completada en el cache local y re-renderiza.
     */
    function onCobroCita(citaId, { total, metodoPago }) {
        localUpdate(citaId, {
            estado: 'completada',
            totalCobrado: total,
            metodoPago
        });
    }

    async function recepNoShow(citaId) {
        if (!window.confirm('¿Marcar que el cliente no llegó?')) return;
        const ok = await CitasService.markNoShow(citaId);
        if (ok) {
            localUpdate(citaId, { estado: 'no_show' });
            toast('Marcada como no llegó', 'info');
        } else {
            toast('No se pudo marcar', 'error');
        }
    }

    // ============================================
    // NAVEGACIÓN
    // ============================================

    /**
     * Avanza/retrocede un día desde un ISO "YYYY-MM-DD". Parsea la fecha
     * MANUALMENTE (no `new Date(iso)`) porque `new Date(iso)` la interpreta
     * como UTC y en Colombia (UTC-5) saltea un día. Misma pista que agenda admin.
     */
    function shiftISO(iso, deltaDays) {
        const [y, m, d] = iso.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        date.setDate(date.getDate() + deltaDays);
        return toISO(date);
    }

    function recepGoPrev() {
        const fechas = [...state.citasPorFecha.keys()].sort();
        const prev = fechas.reverse().find(f => f < state.fechaActual);
        if (prev) { state.fechaActual = prev; render(); }
        else {
            state.fechaActual = shiftISO(state.fechaActual, -1);
            render();
        }
    }

    function recepGoNext() {
        const fechas = [...state.citasPorFecha.keys()].sort();
        const next = fechas.find(f => f > state.fechaActual);
        if (next) { state.fechaActual = next; render(); }
        else {
            state.fechaActual = shiftISO(state.fechaActual, 1);
            render();
        }
    }

    function recepGoToday() {
        state.fechaActual = todayISO();
        render();
    }

    // ============================================
    // HOOK PARA WALK-IN / REAGENDAR (los modales viven en otros archivos)
    // ============================================

    /**
     * Llamado por walkin-ui.js tras crear la cita. Recarga datos.
     */
    function onWalkinCreated() {
        init();
    }

    /**
     * Llamado por reagendar-ui.js tras actualizar fecha/hora.
     */
    function onCitaReagendada(citaId, nuevaFecha, nuevaHora) {
        localUpdate(citaId, { fecha: nuevaFecha, hora: nuevaHora });
        // Si la cita ya no está en el día visible, navegamos al nuevo día
        if (!state.citasPorFecha.get(state.fechaActual)?.find(c => c.id === citaId)) {
            state.fechaActual = nuevaFecha;
            render();
        }
    }

    // ============================================
    // EXPONER GLOBALES
    // ============================================

    window.initRecepcionistaCitas = init;
    window.reloadRecepcionistaCitas = init;
    window.recepGoPrev = recepGoPrev;
    window.recepGoNext = recepGoNext;
    window.recepGoToday = recepGoToday;
    window.recepConfirmar = recepConfirmar;
    window.recepCancelar = recepCancelar;
    window.recepCompletar = recepCompletar;
    window.recepNoShow = recepNoShow;
    window.onRecepWalkinCreated = onWalkinCreated;
    window.onRecepCitaReagendada = onCitaReagendada;
    window.onRecepCobroCita = onCobroCita;

    console.log('✓ RecepcionistaCitasUI (F2) loaded');
})();
