/**
 * LEGENDS BARBERIA - BARBERO: CITAS UI
 * Lista las citas asignadas al barbero logueado agrupadas por estado:
 * confirmadas (próximas a trabajar), pendientes (esperando admin), historial.
 * Acción del barbero: marcar cita como completada al terminar el servicio.
 */

(function () {
    'use strict';

    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    function formatearFecha(isoDate) {
        if (!isoDate) return '';
        const [y, m, d] = isoDate.split('-').map(Number);
        const fecha = new Date(y, m - 1, d);
        return `${DIAS_SEMANA[fecha.getDay()]} ${fecha.getDate()} ${MESES[fecha.getMonth()]}`;
    }

    function renderCardCita(cita, opts = {}) {
        const { showCompletarBtn = false, muted = false } = opts;
        const fotoCliente = cita.clientePhotoURL
            || `https://ui-avatars.com/api/?name=${encodeURIComponent(cita.clienteNombre || 'Cliente')}&background=c9a74a&color=000`;

        const opacity = muted ? 'opacity-60' : '';

        const accionesHtml = showCompletarBtn ? `
            <div class="flex gap-2 mt-3">
                <button onclick="completarCita('${cita.id}')"
                    class="flex-1 px-4 py-2.5 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-black uppercase tracking-wide hover:bg-green-500/25 transition-all active:scale-95">
                    <span class="material-symbols-outlined text-sm align-middle mr-1" style="font-variation-settings: 'FILL' 1">check_circle</span>
                    Marcar completada
                </button>
            </div>
        ` : '';

        return `
            <div class="p-4 rounded-2xl bg-gradient-to-br from-surface-dark to-card-dark border border-white/10 ${opacity}">
                <div class="flex items-start gap-3">
                    <img src="${fotoCliente}" alt="" class="w-12 h-12 rounded-full object-cover border-2 border-primary/30 shrink-0">
                    <div class="flex-1 min-w-0">
                        <p class="text-white font-bold text-sm truncate">${cita.clienteNombre || 'Cliente'}</p>
                        <p class="text-white/50 text-xs mt-0.5">${cita.servicioNombre || 'Servicio'} • $${cita.servicioPrecio || 0}</p>
                        <div class="flex items-center gap-2 mt-2">
                            <span class="material-symbols-outlined text-primary text-sm">event</span>
                            <span class="text-white/80 text-xs font-semibold">${formatearFecha(cita.fecha)} • ${cita.hora || ''}</span>
                        </div>
                    </div>
                </div>
                ${accionesHtml}
            </div>
        `;
    }

    function renderSeccion(titulo, icon, colorClass, citas, opts = {}) {
        if (citas.length === 0) return '';
        return `
            <div class="mb-6">
                <div class="flex items-center gap-2 mb-3">
                    <span class="material-symbols-outlined ${colorClass} text-lg" style="font-variation-settings: 'FILL' 1">${icon}</span>
                    <h3 class="text-white font-black text-sm uppercase tracking-wider">${titulo}</h3>
                    <span class="px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-[10px] font-black border border-white/10">${citas.length}</span>
                </div>
                <div class="space-y-2">
                    ${citas.map(c => renderCardCita(c, opts)).join('')}
                </div>
            </div>
        `;
    }

    async function initBarberoCitas() {
        const container = document.getElementById('barbero-citas-container');
        if (!container) return;

        const user = roleManager && roleManager.currentUser;
        if (!user || !user.uid) {
            container.innerHTML = `<p class="text-white/50 text-sm text-center py-8">Inicia sesión para ver tus citas.</p>`;
            return;
        }

        container.innerHTML = `
            <div class="flex flex-col items-center gap-3 py-12">
                <div class="auth-checking-spinner"></div>
                <p class="text-white/50 text-sm">Cargando citas...</p>
            </div>
        `;

        try {
            const todas = await CitasService.listByBarbero(user.uid);

            if (todas.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-16">
                        <span class="material-symbols-outlined text-white/20 text-6xl mb-3">event_busy</span>
                        <p class="text-white/50 text-sm font-medium">Aún no tienes citas asignadas</p>
                        <p class="text-white/30 text-xs mt-1">Las reservas aparecerán aquí cuando un cliente te elija</p>
                    </div>
                `;
                return;
            }

            const confirmadas = todas.filter(c => c.estado === 'confirmada');
            const pendientes = todas.filter(c => c.estado === 'pendiente');
            const completadas = todas.filter(c => c.estado === 'completada');
            const canceladas = todas.filter(c => c.estado === 'cancelada');

            let html = '';
            html += renderSeccion('Próximas', 'event_available', 'text-green-400', confirmadas, { showCompletarBtn: true });
            html += renderSeccion('Por confirmar', 'schedule', 'text-primary', pendientes);
            html += renderSeccion('Completadas', 'task_alt', 'text-white/40', completadas, { muted: true });
            html += renderSeccion('Canceladas', 'cancel', 'text-red-400/60', canceladas, { muted: true });

            container.innerHTML = html;

        } catch (error) {
            console.error('❌ Error cargando citas del barbero:', error);
            container.innerHTML = `
                <div class="text-center py-12">
                    <span class="material-symbols-outlined text-red-400 text-5xl mb-2">error</span>
                    <p class="text-red-400 text-sm">Error al cargar tus citas</p>
                    <button onclick="initBarberoCitas()" class="mt-3 px-4 py-2 bg-primary/20 text-primary text-xs font-bold rounded-lg border border-primary/30">
                        Reintentar
                    </button>
                </div>
            `;
        }
    }

    async function completarCita(citaId) {
        if (!confirm('¿Marcar esta cita como completada?')) return;
        const ok = await CitasService.completar(citaId);
        if (ok) {
            if (typeof window.showToast === 'function') {
                window.showToast('Cita completada', 'success');
            }
            await initBarberoCitas();
        } else {
            alert('No se pudo marcar como completada. Intenta de nuevo.');
        }
    }

    window.initBarberoCitas = initBarberoCitas;
    window.completarCita = completarCita;
    console.log('✓ BarberoCitasUI loaded');
})();
