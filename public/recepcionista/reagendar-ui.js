/**
 * LEGENDS BARBERIA - RECEPCIONISTA: REAGENDAR (F2)
 *
 * Overlay para cambiar fecha + hora de una cita confirmada.
 * Usa el horario y los slots ocupados del barbero asignado a esa cita.
 *
 * Flujo:
 *   1. Elegir nueva fecha (próximos 14 días, solo días activos del barbero)
 *   2. Elegir nueva hora (slots libres ese día)
 *   3. Confirmar → CitasService.reagendar → onRecepCitaReagendada
 */
(function () {
    'use strict';

    const DURACION_SLOT_MIN = 45;
    const DIAS_SEMANA_KEY = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const DIAS_SEMANA_LBL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    /** Escapa texto para HTML (clienteNombre llega de fuente no confiable). */
    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    const MESES_LBL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    function toISO(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function todayISO() { return toISO(new Date()); }
    function offsetISO(days) {
        const d = new Date(); d.setDate(d.getDate() + days); return toISO(d);
    }
    function diaKey(iso) {
        const [y, m, d] = iso.split('-').map(Number);
        return DIAS_SEMANA_KEY[new Date(y, m - 1, d).getDay()];
    }

    function generarSlots(horarioDia) {
        if (!horarioDia || !horarioDia.activo) return [];
        const [hD, mD] = (horarioDia.desde || '09:00').split(':').map(Number);
        const [hH, mH] = (horarioDia.hasta || '18:00').split(':').map(Number);
        const out = [];
        let cur = hD * 60 + mD;
        const end = hH * 60 + mH;
        while (cur + DURACION_SLOT_MIN <= end) {
            const h = Math.floor(cur / 60);
            const m = cur % 60;
            out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            cur += DURACION_SLOT_MIN;
        }
        return out;
    }

    function findBarberoByUserId(userId) {
        const recepState = window.recepState;
        if (!recepState) return null;
        return recepState.barberos.find(b => b.userId === userId) || null;
    }

    const ctx = {
        citaId: null,
        cita: null,
        barbero: null,
        fechaSel: null,
        horaSel: null
    };

    function open(citaId) {
        const recepState = window.recepState;
        if (!recepState) return;
        const cita = recepState.citasRango.find(c => c.id === citaId);
        if (!cita) return;
        const barbero = findBarberoByUserId(cita.barberoId);
        if (!barbero) {
            if (typeof window.showToast === 'function') window.showToast('No se encuentra el barbero', 'error');
            return;
        }

        ctx.citaId = citaId;
        ctx.cita = cita;
        ctx.barbero = barbero;
        ctx.fechaSel = cita.fecha;
        ctx.horaSel = null;

        const existing = document.getElementById('reagendar-overlay');
        if (existing) existing.remove();

        const html = `
        <div id="reagendar-overlay" class="barber-modal-overlay" style="z-index:155">
            <div class="barber-confirm-dialog" style="max-width:460px">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1">edit_calendar</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="text-white font-black text-base">Reagendar cita</h3>
                        <p class="text-white/40 text-[10px] uppercase tracking-wider font-bold truncate">${esc(cita.clienteNombre || 'Cliente')} · ${esc(barbero.userName || 'Barbero')}</p>
                    </div>
                </div>

                <!-- Cita actual -->
                <div class="p-3 mb-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1">Cita actual</p>
                    <p class="text-white text-sm font-bold">${formatFechaCorta(cita.fecha)} · ${cita.hora}</p>
                </div>

                <!-- Fechas -->
                <div class="mb-4">
                    <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-2 pl-1">Nueva fecha</p>
                    <div id="reagendar-fechas" class="flex gap-2 overflow-x-auto no-scrollbar pb-1"></div>
                </div>

                <!-- Horas -->
                <div class="mb-4">
                    <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-2 pl-1">Nueva hora</p>
                    <div id="reagendar-horas" class="grid grid-cols-4 gap-2"></div>
                </div>

                <div class="flex gap-2 mt-2">
                    <button onclick="closeReagendarOverlay()" class="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Cancelar
                    </button>
                    <button id="reagendar-submit" onclick="reagendarSubmit()" class="flex-1 px-4 py-3 rounded-xl bg-primary text-black text-sm font-black uppercase tracking-wider hover:bg-yellow-500 transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed" disabled>
                        Guardar
                    </button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => document.getElementById('reagendar-overlay')?.classList.add('visible'));

        renderFechas();
        renderHoras();
    }

    function close() {
        const overlay = document.getElementById('reagendar-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 250);
        }
    }

    function formatFechaCorta(iso) {
        const [y, m, d] = iso.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        return `${DIAS_SEMANA_LBL[date.getDay()]} ${date.getDate()} ${MESES_LBL[date.getMonth()]}`;
    }

    function renderFechas() {
        const container = document.getElementById('reagendar-fechas');
        if (!container) return;
        const horario = ctx.barbero.horario || {};
        const opciones = [];
        for (let i = 0; i < 14; i++) {
            const iso = offsetISO(i);
            const dia = diaKey(iso);
            const activo = !!horario[dia]?.activo;
            if (!activo) continue;
            opciones.push(iso);
        }
        if (opciones.length === 0) {
            container.innerHTML = '<p class="text-white/40 text-xs">El barbero no tiene días activos próximos.</p>';
            return;
        }
        container.innerHTML = opciones.map(iso => {
            const active = ctx.fechaSel === iso;
            const [y, m, d] = iso.split('-').map(Number);
            const date = new Date(y, m - 1, d);
            return `
                <button type="button" onclick="reagendarSelectFecha('${iso}')"
                    class="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl shrink-0 transition-all active:scale-95
                        ${active ? 'bg-primary text-black' : 'bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08]'}">
                    <span class="text-[9px] font-black uppercase tracking-wider">${DIAS_SEMANA_LBL[date.getDay()]}</span>
                    <span class="text-base font-black tabular-nums leading-none">${date.getDate()}</span>
                    <span class="text-[9px] font-bold uppercase">${MESES_LBL[date.getMonth()]}</span>
                </button>
            `;
        }).join('');
    }

    async function renderHoras() {
        const container = document.getElementById('reagendar-horas');
        if (!container) return;
        if (!ctx.fechaSel) { container.innerHTML = ''; return; }
        const dia = diaKey(ctx.fechaSel);
        const horarioDia = ctx.barbero.horario?.[dia];
        const slots = generarSlots(horarioDia);

        // Filtrar pasados si es hoy
        const ahora = new Date();
        const esHoy = ctx.fechaSel === todayISO();
        const futuros = esHoy
            ? slots.filter(s => {
                const [hh, mm] = s.split(':').map(Number);
                const d = new Date(); d.setHours(hh, mm, 0, 0);
                return d.getTime() > ahora.getTime() - 30 * 60000;
            })
            : slots;

        if (futuros.length === 0) {
            container.innerHTML = '<p class="col-span-4 text-white/40 text-xs text-center py-3">Sin horarios disponibles en este día.</p>';
            return;
        }

        // Restar ocupados (excluyendo la cita actual que estamos reagendando)
        let ocupados = [];
        try {
            ocupados = await CitasService.getOccupiedSlots(ctx.barbero.userId, ctx.fechaSel);
        } catch (e) {
            ocupados = [];
        }
        // La hora original de la cita actual no debe contar como ocupada para sí misma
        if (ctx.fechaSel === ctx.cita.fecha) {
            ocupados = ocupados.filter(h => h !== ctx.cita.hora);
        }
        const libres = futuros.filter(s => !ocupados.includes(s));
        if (libres.length === 0) {
            container.innerHTML = '<p class="col-span-4 text-white/40 text-xs text-center py-3">Todos los horarios están ocupados ese día.</p>';
            return;
        }
        container.innerHTML = libres.map(h => {
            const active = ctx.horaSel === h;
            return `
                <button type="button" onclick="reagendarSelectHora('${h}')"
                    class="px-3 py-2.5 rounded-xl text-xs font-black tabular-nums transition-all active:scale-95
                        ${active ? 'bg-primary text-black' : 'bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08]'}">
                    ${h}
                </button>
            `;
        }).join('');
        refreshSubmit();
    }

    function selectFecha(iso) {
        ctx.fechaSel = iso;
        ctx.horaSel = null;
        renderFechas();
        renderHoras();
        refreshSubmit();
    }

    function selectHora(h) {
        ctx.horaSel = h;
        renderHoras();
        refreshSubmit();
    }

    function refreshSubmit() {
        const btn = document.getElementById('reagendar-submit');
        if (!btn) return;
        const cambioReal = ctx.fechaSel && ctx.horaSel
            && (ctx.fechaSel !== ctx.cita.fecha || ctx.horaSel !== ctx.cita.hora);
        btn.disabled = !cambioReal;
    }

    async function submit() {
        if (!ctx.fechaSel || !ctx.horaSel) return;
        if (ctx.fechaSel === ctx.cita.fecha && ctx.horaSel === ctx.cita.hora) return;

        const btn = document.getElementById('reagendar-submit');
        if (btn) { btn.disabled = true; btn.textContent = '...'; }

        const ok = await CitasService.reagendar(ctx.citaId, ctx.fechaSel, ctx.horaSel);

        if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }

        if (!ok) {
            if (typeof window.showToast === 'function') window.showToast('No se pudo reagendar', 'error');
            return;
        }

        if (typeof window.showToast === 'function') {
            window.showToast(`Cita reagendada a ${formatFechaCorta(ctx.fechaSel)} ${ctx.horaSel}`, 'success');
        }
        close();
        if (typeof window.onRecepCitaReagendada === 'function') {
            window.onRecepCitaReagendada(ctx.citaId, ctx.fechaSel, ctx.horaSel);
        }
    }

    window.openReagendarOverlay = open;
    window.closeReagendarOverlay = close;
    window.reagendarSelectFecha = selectFecha;
    window.reagendarSelectHora = selectHora;
    window.reagendarSubmit = submit;

    console.log('✓ RecepcionistaReagendarUI (F2) loaded');
})();
