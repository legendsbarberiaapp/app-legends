/**
 * LEGENDS BARBERIA - PROFILE UI (CLIENTE)
 * Muestra al cliente sus datos reales: tier según visitas completadas,
 * stats (visitas, próximas, gasto total) y sus reservas agrupadas por estado.
 * Permite cancelar citas pendientes o confirmadas.
 */

(function () {
    'use strict';

    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    /**
     * Tier basado en citas completadas. Arranca en "Nuevo Miembro" (0),
     * sube a Bronce, Plata, Oro, Platino según vas visitando.
     */
    function calcularTier(completadas) {
        if (completadas >= 25) return { nombre: 'Platino', icon: 'diamond' };
        if (completadas >= 10) return { nombre: 'Oro', icon: 'workspace_premium' };
        if (completadas >= 3) return { nombre: 'Plata', icon: 'military_tech' };
        if (completadas >= 1) return { nombre: 'Bronce', icon: 'emoji_events' };
        return { nombre: 'Nuevo Miembro', icon: 'verified' };
    }

    function formatearFecha(iso) {
        if (!iso) return '';
        const [y, m, d] = iso.split('-').map(Number);
        const fecha = new Date(y, m - 1, d);
        return `${DIAS_SEMANA[fecha.getDay()]} ${fecha.getDate()} ${MESES[fecha.getMonth()]}`;
    }

    function renderTierBadge(tier) {
        const badge = document.getElementById('profile-tier-badge');
        if (!badge) return;
        badge.innerHTML = `
            <span class="material-symbols-outlined text-primary text-base mr-2" style="font-variation-settings: 'FILL' 1" aria-hidden="true">${tier.icon}</span>
            <span class="text-sm font-black text-primary tracking-wider uppercase">${tier.nombre}</span>
        `;
    }

    function renderStats(citas) {
        const completadas = citas.filter(c => c.estado === 'completada');
        // "Próximas" = lo que el usuario tiene por delante: confirmadas Y
        // pendientes (las pendientes también aparecen listadas abajo, así que
        // el contador debe incluirlas para no mostrar 0 con una reserva activa).
        const proximas = citas.filter(c => c.estado === 'confirmada' || c.estado === 'pendiente');
        // Si la recepcionista agregó productos al cobrar, totalCobrado refleja
        // el monto real (corte + productos). Fallback al precio agendado para
        // citas viejas pre-F3 que no tienen el campo.
        const gasto = completadas.reduce((sum, c) => sum + (Number(c.totalCobrado || c.servicioPrecio) || 0), 0);

        const vEl = document.getElementById('stat-visitas');
        const pEl = document.getElementById('stat-proximas');
        const gEl = document.getElementById('stat-gasto');

        if (vEl) vEl.textContent = completadas.length;
        if (pEl) pEl.textContent = proximas.length;
        if (gEl) gEl.textContent = window.formatCOP(gasto);

        return completadas.length;
    }

    function renderReservaCard(cita, opts = {}) {
        const { showCancelBtn = false, muted = false, labelEstado = '', colorEstado = 'primary', staggerIndex = 0 } = opts;

        const colorMap = {
            primary: { bg: 'bg-primary/20', border: 'border-primary/30', text: 'text-primary' },
            green: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400' },
            red: { bg: 'bg-red-500/15', border: 'border-red-500/25', text: 'text-red-400' },
            white: { bg: 'bg-white/10', border: 'border-white/15', text: 'text-white/75' }
        };
        const c = colorMap[colorEstado] || colorMap.primary;

        const opacity = muted ? 'opacity-75' : '';

        const cancelBtn = showCancelBtn ? `
            <button onclick="cancelarMiReserva('${cita.id}')" aria-label="Cancelar reserva del ${formatearFecha(cita.fecha)} a las ${cita.hora || ''}"
                class="mt-3 w-full px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400/85 text-[11px] font-black uppercase tracking-wide hover:bg-red-500/20 transition-all active:scale-95">
                <span class="material-symbols-outlined text-xs align-middle mr-1" aria-hidden="true">close</span>
                Cancelar reserva
            </button>
        ` : '';

        // F6: botón Calificar visible en citas completadas que el cliente aún
        // no calificó. Tras enviar la reseña, onReseniaCreada actualiza la cita
        // en memoria a reviewed=true y la card se re-renderiza sin el botón.
        const rateBtn = (cita.estado === 'completada' && !cita.reviewed)
            ? `<button onclick="abrirReseniaParaCita('${cita.id}')"
                  class="mt-3 w-full px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-black uppercase tracking-wide hover:bg-amber-500/25 transition-all active:scale-95 flex items-center justify-center gap-1.5">
                  <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1">star</span>
                  Calificar tu corte
              </button>`
            : (cita.estado === 'completada' && cita.reviewed)
                ? `<p class="mt-3 text-center text-white/35 text-[10px] font-bold uppercase tracking-wider">
                      <span class="material-symbols-outlined text-amber-400/70 text-xs align-middle mr-1" style="font-variation-settings: 'FILL' 1">star</span>
                      Ya calificada
                   </p>`
                : '';

        const theme = (typeof window.nivelTheme === 'function') ? window.nivelTheme(cita.barberoNivel) : { textCls: 'text-primary/85', borderLeft: '' };

        return `
            <div class="stagger-item p-4 rounded-2xl bg-gradient-to-br from-surface-dark to-card-dark border border-white/10 ${opacity}" style="--stagger-index: ${staggerIndex}; ${theme.borderLeft}">
                <div class="flex items-start gap-4">
                    <div class="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-lg shrink-0">
                        <span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' 0, 'wght' 300" aria-hidden="true">content_cut</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-2">
                            <p class="text-sm font-bold text-white leading-tight truncate">${cita.servicioNombre || 'Servicio'}</p>
                            <span class="text-primary font-black text-sm shrink-0 tabular-nums">${window.formatCOP(cita.totalCobrado || cita.servicioPrecio || 0)}</span>
                        </div>
                        <div class="flex items-center gap-2 text-xs text-white/65 mt-1 flex-wrap">
                            <span class="font-semibold ${theme.textCls}">${cita.barberoNombre || 'Barbero'}</span>
                            <span class="w-1 h-1 rounded-full bg-white/35"></span>
                            <span class="font-medium">${formatearFecha(cita.fecha)} · ${cita.hora || ''}</span>
                        </div>
                        ${labelEstado ? `
                            <div class="inline-flex items-center gap-1 mt-2 px-2 py-0.5 ${c.bg} border ${c.border} rounded-md">
                                <span class="${c.text} text-[10px] font-bold uppercase tracking-wide">${labelEstado}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                ${cancelBtn}
                ${rateBtn}
            </div>
        `;
    }

    function renderSeccion(titulo, icon, colorClass, citas, opts = {}, startIndex = 0) {
        if (citas.length === 0) return '';
        return `
            <div class="mb-6">
                <div class="flex items-center gap-2 mb-3">
                    <span class="material-symbols-outlined ${colorClass} text-base" style="font-variation-settings: 'FILL' 1" aria-hidden="true">${icon}</span>
                    <h4 class="text-white font-black text-xs uppercase tracking-wider">${titulo}</h4>
                    <span class="px-2 py-0.5 rounded-full bg-white/10 text-white/75 text-[10px] font-black border border-white/10 tabular-nums">${citas.length}</span>
                </div>
                <div class="space-y-2">
                    ${citas.map((cita, i) => renderReservaCard(cita, { ...opts, staggerIndex: startIndex + i })).join('')}
                </div>
            </div>
        `;
    }

    function renderReservas(citas) {
        const container = document.getElementById('profile-reservas-container');
        if (!container) return;

        if (citas.length === 0) {
            container.innerHTML = `
                <div class="empty-state-premium fade-in-soft">
                    <div class="relative">
                        <div class="absolute inset-0 bg-primary/10 rounded-full blur-xl"></div>
                        <div class="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                            <span class="material-symbols-outlined text-primary/60 text-4xl" style="font-variation-settings: 'FILL' 1" aria-hidden="true">event_available</span>
                        </div>
                    </div>
                    <div class="text-center">
                        <p class="text-white/85 text-sm font-bold mb-1">Aún no has reservado ninguna cita</p>
                        <p class="text-white/50 text-xs">Tu próxima cita aparecerá aquí</p>
                    </div>
                </div>
            `;
            return;
        }

        // Filtro citas pasadas de 'confirmadas' no completadas: las muestro como próximas igual
        const proximas = citas.filter(c => c.estado === 'confirmada');
        const pendientes = citas.filter(c => c.estado === 'pendiente');
        const completadas = citas.filter(c => c.estado === 'completada');
        const canceladas = citas.filter(c => c.estado === 'cancelada');

        let html = '';
        let idx = 0;
        html += renderSeccion('Próximas', 'event_available', 'text-green-400', proximas, {
            showCancelBtn: true,
            labelEstado: 'Confirmada',
            colorEstado: 'green'
        }, idx);
        idx += proximas.length;
        html += renderSeccion('Esperando Confirmación', 'schedule', 'text-primary', pendientes, {
            showCancelBtn: true,
            labelEstado: 'Pendiente',
            colorEstado: 'primary'
        }, idx);
        idx += pendientes.length;
        html += renderSeccion('Historial', 'task_alt', 'text-white/50', completadas, {
            muted: true,
            labelEstado: 'Completada',
            colorEstado: 'white'
        }, idx);
        idx += completadas.length;
        html += renderSeccion('Canceladas', 'cancel', 'text-red-400/70', canceladas, {
            muted: true,
            labelEstado: 'Cancelada',
            colorEstado: 'red'
        }, idx);

        container.innerHTML = html;
    }

    /**
     * Muestra el botón "Activar notificaciones" solo si el permiso del
     * navegador está en 'default' (el usuario aún no decidió).
     */
    function toggleNotificationsButton() {
        const btn = document.getElementById('profile-enable-notifications');
        if (!btn) return;
        if (!window.Notifications) { btn.classList.add('hidden'); return; }
        const permission = window.Notifications.getPermission();
        if (permission === 'default') {
            btn.classList.remove('hidden');
            btn.classList.add('flex');
        } else {
            btn.classList.add('hidden');
            btn.classList.remove('flex');
        }
    }

    // F6: cache local de las citas del cliente, para que el modal de reseña
    // pueda encontrar una cita por id sin re-fetch.
    let citasCache = [];

    async function initProfile() {
        const user = roleManager && roleManager.currentUser;
        if (!user || !user.uid) return;

        // El partial de profile acaba de inyectarse en el DOM, así que
        // ahora sí podemos sincronizar foto/nombre/email con los datos
        // del usuario. roleManager lo intentó antes del partial pero los
        // elementos no existían todavía.
        if (typeof roleManager.updateProfileUI === 'function') {
            roleManager.updateProfileUI();
        }

        toggleNotificationsButton();

        try {
            const citas = await CitasService.listByCliente(user.uid);
            citasCache = citas;
            const completadasCount = renderStats(citas);
            renderTierBadge(calcularTier(completadasCount));
            renderReservas(citas);
        } catch (error) {
            console.error('❌ Error cargando profile:', error);
            const container = document.getElementById('profile-reservas-container');
            if (container) {
                container.innerHTML = `
                    <div class="empty-state-premium fade-in-soft" style="border-color: rgba(239,68,68,0.2);">
                        <div class="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center">
                            <span class="material-symbols-outlined text-red-400 text-3xl" aria-hidden="true">error</span>
                        </div>
                        <p class="text-red-400 text-sm font-bold">Error al cargar tus reservas</p>
                        <button onclick="initProfile()" aria-label="Reintentar carga de reservas"
                            class="flex items-center gap-2 px-5 py-2.5 bg-primary/15 text-primary text-xs font-black uppercase tracking-wider rounded-xl border border-primary/30 hover:bg-primary/25 transition-all active:scale-95">
                            <span class="material-symbols-outlined text-base" aria-hidden="true">refresh</span>
                            <span>Reintentar</span>
                        </button>
                    </div>
                `;
            }
        }
    }

    /**
     * Modal de confirmación on-brand (reemplaza el confirm() nativo).
     * Devuelve Promise<boolean>: true si el usuario confirma.
     */
    function pedirConfirmacion({ title, message, confirmText = 'Confirmar', danger = false }) {
        return new Promise((resolve) => {
            const existing = document.getElementById('profile-confirm-overlay');
            if (existing) existing.remove();

            const accent = danger ? 'red' : 'primary';
            const confirmCls = danger
                ? 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30'
                : 'bg-gradient-to-r from-primary to-primary-light text-black';

            const overlay = document.createElement('div');
            overlay.id = 'profile-confirm-overlay';
            overlay.className = 'fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]';
            overlay.innerHTML = `
                <div class="w-full max-w-md bg-gradient-to-br from-surface-dark to-card-dark border border-${accent}/30 rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                    <div class="w-14 h-14 rounded-2xl bg-${accent}-500/15 border border-${accent}-500/30 flex items-center justify-center mx-auto mb-4">
                        <span class="material-symbols-outlined text-${accent === 'red' ? 'red-400' : 'primary'} text-3xl" style="font-variation-settings: 'FILL' 1" aria-hidden="true">${danger ? 'event_busy' : 'help'}</span>
                    </div>
                    <h3 class="text-white font-black text-lg text-center mb-2">${title}</h3>
                    <p class="text-white/60 text-sm text-center mb-6 leading-relaxed">${message}</p>
                    <div class="flex gap-3">
                        <button id="profile-confirm-cancel" class="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                            Volver
                        </button>
                        <button id="profile-confirm-ok" class="flex-1 px-4 py-3 rounded-xl ${confirmCls} text-sm font-black uppercase tracking-wide transition-all active:scale-[0.97]">
                            ${confirmText}
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const close = (val) => { overlay.remove(); resolve(val); };
            overlay.querySelector('#profile-confirm-cancel').addEventListener('click', () => close(false));
            overlay.querySelector('#profile-confirm-ok').addEventListener('click', () => close(true));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
        });
    }

    async function cancelarMiReserva(citaId) {
        const ok = await pedirConfirmacion({
            title: '¿Cancelar esta reserva?',
            message: 'No podrás deshacer esta acción.',
            confirmText: 'Sí, cancelar',
            danger: true
        });
        if (!ok) return;
        const exito = await CitasService.cancelar(citaId);
        if (exito) {
            if (typeof window.showToast === 'function') {
                window.showToast('Reserva cancelada', 'success');
            }
            await initProfile();
        } else {
            if (typeof window.showToast === 'function') {
                window.showToast('No se pudo cancelar. Intenta de nuevo.', 'error');
            }
        }
    }

    async function activarNotificaciones() {
        if (!window.Notifications) return;
        const result = await window.Notifications.request();
        if (result === 'granted') {
            window.showToast && window.showToast('Notificaciones activadas ✓', 'success');
        } else if (result === 'denied') {
            window.showToast && window.showToast('Las notificaciones quedaron bloqueadas. Actívalas desde la configuración del navegador.', 'info');
        }
        toggleNotificationsButton();
    }

    // F6: handlers para el flujo de reseñas
    function abrirReseniaParaCita(citaId) {
        const cita = citasCache.find(c => c.id === citaId);
        if (!cita) return;
        if (typeof window.openReseniaModal === 'function') {
            window.openReseniaModal(cita);
        }
    }

    function onReseniaCreada(citaId) {
        const cita = citasCache.find(c => c.id === citaId);
        if (cita) cita.reviewed = true;
        // Re-render solo la sección de reservas (stats no cambian)
        renderReservas(citasCache);
    }

    window.initProfile = initProfile;
    window.cancelarMiReserva = cancelarMiReserva;
    window.activarNotificaciones = activarNotificaciones;
    window.abrirReseniaParaCita = abrirReseniaParaCita;
    window.onReseniaCreada = onReseniaCreada;
    console.log('✓ ProfileUI loaded');
})();
