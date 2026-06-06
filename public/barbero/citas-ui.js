/**
 * LEGENDS BARBERIA - BARBERO: CITAS UI
 * Lista las citas asignadas al barbero logueado agrupadas por estado:
 * confirmadas (próximas a trabajar), pendientes (esperando admin), historial.
 * Acción del barbero: marcar cita como completada al terminar el servicio.
 */

(function () {
    'use strict';

    /** Escapa texto para insertarlo seguro en HTML (evita XSS desde datos del
     *  cliente: clienteNombre/servicioNombre/photoURL llegan de fuentes no
     *  confiables — displayName del cliente o nombre de walk-in). */
    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    function formatearFecha(isoDate) {
        if (!isoDate) return '';
        const [y, m, d] = isoDate.split('-').map(Number);
        const fecha = new Date(y, m - 1, d);
        return `${DIAS_SEMANA[fecha.getDay()]} ${fecha.getDate()} ${MESES[fecha.getMonth()]}`;
    }

    /**
     * Avatar robusto para fotos de Google:
     *   - Inicial como fallback siempre visible por debajo
     *   - <img> con referrerpolicy="no-referrer" (requerido para googleusercontent)
     *   - Si la imagen carga, fade-in encima de la inicial
     *   - Si falla, se remueve y queda la inicial
     */
    function avatarHTML(name, photoURL, sizeCls = 'w-12 h-12', textCls = 'text-base') {
        const initial = ((name || 'C').trim().charAt(0) || 'C').toUpperCase();
        let src = photoURL || '';
        if (src && /googleusercontent\.com/.test(src)) {
            src = src.replace(/=s\d+(-c)?/g, '=s96-c').replace(/\/s\d+-c\//g, '/s96-c/');
        }
        const imgTag = src
            ? `<img src="${esc(src)}" alt="" referrerpolicy="no-referrer" loading="eager" decoding="async"
                 class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300"
                 onload="this.style.opacity=1" onerror="this.remove()">`
            : '';
        return `<div class="relative ${sizeCls} rounded-full border-2 border-primary/30 shrink-0 overflow-hidden bg-gradient-to-br from-primary/60 to-primary/20 flex items-center justify-center">
            <span class="text-black ${textCls} font-black">${esc(initial)}</span>
            ${imgTag}
        </div>`;
    }

    function renderCardCita(cita, opts = {}) {
        const { showCompletarBtn = false, muted = false } = opts;
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

        // Si la recepcionista cobró con productos extra, totalCobrado tiene
        // el monto final. Antes del cobro usamos cita.total (incluye adicionales
        // de la reserva online); fallback al precio base para citas pre-F3.
        const monto = cita.totalCobrado || cita.total || cita.servicioPrecio || 0;
        const precioStr = typeof window.formatCOP === 'function'
            ? window.formatCOP(monto)
            : `$${monto}`;

        return `
            <div class="p-4 rounded-2xl bg-gradient-to-br from-surface-dark to-card-dark border border-white/10 ${opacity}">
                <div class="flex items-start gap-3">
                    ${avatarHTML(cita.clienteNombre, cita.clientePhotoURL)}
                    <div class="flex-1 min-w-0">
                        <p class="text-white font-bold text-sm truncate">${esc(cita.clienteNombre || 'Cliente')}</p>
                        <p class="text-white/50 text-xs mt-0.5">${esc(cita.servicioNombre || 'Servicio')} • ${precioStr}</p>
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

    /**
     * Modal de confirmación on-brand (reemplaza el confirm() nativo).
     * Reusa las clases .barber-modal-overlay / .barber-confirm-dialog de la app.
     * Devuelve Promise<boolean>: true si el barbero confirma.
     */
    function pedirConfirmacion({ title, message, confirmText = 'Confirmar' }) {
        return new Promise((resolve) => {
            const existing = document.getElementById('barbero-citas-confirm');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'barbero-citas-confirm';
            overlay.className = 'barber-modal-overlay';
            overlay.innerHTML = `
                <div class="barber-confirm-dialog" style="max-width:400px">
                    <div class="w-16 h-16 rounded-2xl bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                        <span class="material-symbols-outlined text-green-400 text-3xl" style="font-variation-settings: 'FILL' 1">check_circle</span>
                    </div>
                    <h3 class="text-white font-black text-lg text-center mb-2">${esc(title)}</h3>
                    <p class="text-white/50 text-sm text-center mb-6">${esc(message)}</p>
                    <div class="flex gap-3">
                        <button data-act="cancel" class="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                            Volver
                        </button>
                        <button data-act="ok" class="flex-1 px-4 py-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-black uppercase tracking-wide hover:bg-green-500/30 transition-all active:scale-[0.97]">
                            ${esc(confirmText)}
                        </button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            // setTimeout (no requestAnimationFrame): la animación de entrada debe
            // dispararse aunque la pestaña esté en segundo plano (rAF se pausa).
            setTimeout(() => overlay.classList.add('visible'), 10);

            const close = (val) => {
                overlay.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
                resolve(val);
            };
            overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
            overlay.querySelector('[data-act="ok"]').addEventListener('click', () => close(true));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
        });
    }

    async function completarCita(citaId) {
        const confirmar = await pedirConfirmacion({
            title: '¿Marcar como completada?',
            message: 'Confirma que ya terminaste este servicio.',
            confirmText: 'Sí, completar'
        });
        if (!confirmar) return;
        const ok = await CitasService.completar(citaId);
        if (ok) {
            if (typeof window.showToast === 'function') {
                window.showToast('Cita completada', 'success');
            }
            await initBarberoCitas();
        } else if (typeof window.showToast === 'function') {
            window.showToast('No se pudo marcar como completada. Intenta de nuevo.', 'error');
        }
    }

    window.initBarberoCitas = initBarberoCitas;
    window.completarCita = completarCita;
    console.log('✓ BarberoCitasUI loaded');
})();
