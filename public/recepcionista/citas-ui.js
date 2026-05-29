/**
 * LEGENDS BARBERIA - RECEPCIONISTA: CITAS HOY (READ-ONLY)
 *
 * F1: la recepcionista solo VE las citas de hoy de su sede asignada.
 * Las acciones (confirmar/cancelar/reagendar/walk-in) llegan en F2.
 *
 * Datos:
 *   - sedeId se lee del user doc (users/{uid}.sedeId) vía roleManager.currentUser.
 *   - Citas: CitasService.listBySedeRange(sedeId, hoy, hoy)
 *   - Nombre de sede: SedesService.list() + nombreById
 */
(function () {
    'use strict';

    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    function todayISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function fechaLargaHoy() {
        const d = new Date();
        return `${DIAS_SEMANA[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
    }

    function getCurrentUser() {
        return (typeof roleManager !== 'undefined' && roleManager.currentUser) ? roleManager.currentUser : null;
    }

    /** Color/label de estado para la card. */
    const ESTADO_STYLE = {
        pendiente:  { dot: 'bg-amber-400',  label: 'Sin confirmar', cls: 'text-amber-400'  },
        confirmada: { dot: 'bg-green-400',  label: 'Confirmada',    cls: 'text-green-400'  },
        completada: { dot: 'bg-blue-400',   label: 'Completada',    cls: 'text-blue-400'   },
        cancelada:  { dot: 'bg-white/25',   label: 'Cancelada',     cls: 'text-white/40'   },
        no_show:    { dot: 'bg-white/40',   label: 'No llegó',      cls: 'text-white/50'   }
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

        const initial = (cliente.trim().charAt(0) || 'C').toUpperCase();
        const photo = cita.clientePhotoURL || '';
        const photoEl = photo
            ? `<img src="${photo.replace(/=s\d+(-c)?/g, '=s96-c')}" alt="" referrerpolicy="no-referrer"
                  class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300"
                  onload="this.style.opacity=1" onerror="this.remove()">`
            : '';

        return `
        <div class="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div class="flex items-center gap-3">
                <div class="text-center shrink-0">
                    <p class="text-primary text-lg font-black leading-none tabular-nums">${hora}</p>
                </div>
                <div class="relative w-11 h-11 rounded-full border-2 border-white/10 overflow-hidden bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center shrink-0">
                    <span class="text-black text-sm font-black">${initial}</span>
                    ${photoEl}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-white font-bold text-sm truncate">${cliente}</p>
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
        </div>`;
    }

    function renderEmpty() {
        return `
            <div class="flex flex-col items-center gap-3 py-12 px-6 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span class="material-symbols-outlined text-white/20 text-5xl" style="font-variation-settings: 'FILL' 1">event_busy</span>
                <p class="text-white/50 text-sm font-bold text-center">Sin citas para hoy</p>
                <p class="text-white/25 text-[11px] text-center">Cuando un cliente reserve, aparecerá acá</p>
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

    async function initRecepcionistaCitas() {
        const sedeLabel = document.getElementById('recep-sede-label');
        const content = document.getElementById('recep-citas-content');
        if (!content) return;

        const user = getCurrentUser();
        if (!user || !user.uid) {
            content.innerHTML = renderError('No hay sesión activa');
            return;
        }
        if (user.role !== 'recepcionista') {
            content.innerHTML = renderError('Esta pantalla es solo para recepcionistas');
            return;
        }
        const sedeId = user.sedeId;
        if (!sedeId) {
            content.innerHTML = renderError('No tenés sede asignada. Pedile al admin que te la asigne.');
            if (sedeLabel) sedeLabel.textContent = fechaLargaHoy();
            return;
        }

        content.innerHTML = `
            <div class="flex flex-col items-center gap-3 py-12">
                <div class="auth-checking-spinner"></div>
                <p class="text-white/50 text-xs">Cargando citas...</p>
            </div>`;

        try {
            const [citas, sedes] = await Promise.all([
                CitasService.listBySedeRange(sedeId, todayISO(), todayISO()),
                (typeof SedesService !== 'undefined') ? SedesService.list() : Promise.resolve([])
            ]);

            const sedeNombre = (typeof SedesService !== 'undefined')
                ? SedesService.nombreById(sedes, sedeId)
                : '';
            if (sedeLabel) {
                sedeLabel.textContent = sedeNombre
                    ? `${fechaLargaHoy()} · ${sedeNombre}`
                    : fechaLargaHoy();
            }

            if (!citas || citas.length === 0) {
                content.innerHTML = renderEmpty();
                return;
            }

            // Mostrar en orden de hora (ya viene sortAsc desde el service)
            content.innerHTML = citas.map(citaCard).join('');
        } catch (error) {
            console.error('❌ Error cargando citas recepcionista:', error);
            content.innerHTML = renderError('No se pudieron cargar las citas');
        }
    }

    window.initRecepcionistaCitas = initRecepcionistaCitas;
    console.log('✓ RecepcionistaCitasUI loaded');
})();
