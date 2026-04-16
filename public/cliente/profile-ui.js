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
            <span class="material-symbols-outlined text-primary text-base mr-2" style="font-variation-settings: 'FILL' 1">${tier.icon}</span>
            <span class="text-sm font-black text-primary tracking-wider uppercase">${tier.nombre}</span>
        `;
    }

    function renderStats(citas) {
        const completadas = citas.filter(c => c.estado === 'completada');
        const proximas = citas.filter(c => c.estado === 'confirmada');
        const gasto = completadas.reduce((sum, c) => sum + (Number(c.servicioPrecio) || 0), 0);

        const vEl = document.getElementById('stat-visitas');
        const pEl = document.getElementById('stat-proximas');
        const gEl = document.getElementById('stat-gasto');

        if (vEl) vEl.textContent = completadas.length;
        if (pEl) pEl.textContent = proximas.length;
        if (gEl) gEl.textContent = `$${gasto}`;

        return completadas.length;
    }

    function renderReservaCard(cita, opts = {}) {
        const { showCancelBtn = false, muted = false, labelEstado = '', colorEstado = 'primary' } = opts;

        const colorMap = {
            primary: { bg: 'bg-primary/20', border: 'border-primary/30', text: 'text-primary' },
            green: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400' },
            red: { bg: 'bg-red-500/15', border: 'border-red-500/25', text: 'text-red-400' },
            white: { bg: 'bg-white/10', border: 'border-white/15', text: 'text-white/70' }
        };
        const c = colorMap[colorEstado] || colorMap.primary;

        const opacity = muted ? 'opacity-70' : '';

        const cancelBtn = showCancelBtn ? `
            <button onclick="cancelarMiReserva('${cita.id}')"
                class="mt-3 w-full px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400/80 text-[11px] font-black uppercase tracking-wide hover:bg-red-500/20 transition-all active:scale-95">
                <span class="material-symbols-outlined text-xs align-middle mr-1">close</span>
                Cancelar reserva
            </button>
        ` : '';

        return `
            <div class="p-4 rounded-2xl bg-gradient-to-br from-surface-dark to-card-dark border border-white/10 ${opacity}">
                <div class="flex items-start gap-4">
                    <div class="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-lg shrink-0">
                        <span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' 0, 'wght' 300">content_cut</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-2">
                            <p class="text-sm font-bold text-white leading-tight truncate">${cita.servicioNombre || 'Servicio'}</p>
                            <span class="text-primary font-black text-sm shrink-0">$${cita.servicioPrecio || 0}</span>
                        </div>
                        <div class="flex items-center gap-2 text-xs text-white/50 mt-1">
                            <span class="font-semibold text-primary/80">${cita.barberoNombre || 'Barbero'}</span>
                            <span class="w-1 h-1 rounded-full bg-white/30"></span>
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
            </div>
        `;
    }

    function renderSeccion(titulo, icon, colorClass, citas, opts = {}) {
        if (citas.length === 0) return '';
        return `
            <div class="mb-6">
                <div class="flex items-center gap-2 mb-3">
                    <span class="material-symbols-outlined ${colorClass} text-base" style="font-variation-settings: 'FILL' 1">${icon}</span>
                    <h4 class="text-white font-black text-xs uppercase tracking-wider">${titulo}</h4>
                    <span class="px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-[10px] font-black border border-white/10">${citas.length}</span>
                </div>
                <div class="space-y-2">
                    ${citas.map(cita => renderReservaCard(cita, opts)).join('')}
                </div>
            </div>
        `;
    }

    function renderReservas(citas) {
        const container = document.getElementById('profile-reservas-container');
        if (!container) return;

        if (citas.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center gap-3 py-10 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                    <span class="material-symbols-outlined text-white/20 text-5xl" style="font-variation-settings: 'FILL' 1">event_available</span>
                    <p class="text-white/50 text-sm font-medium text-center">Aún no has reservado ninguna cita</p>
                    <p class="text-white/30 text-xs text-center">Tu próxima cita aparecerá aquí</p>
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
        html += renderSeccion('Próximas', 'event_available', 'text-green-400', proximas, {
            showCancelBtn: true,
            labelEstado: 'Confirmada',
            colorEstado: 'green'
        });
        html += renderSeccion('Esperando Confirmación', 'schedule', 'text-primary', pendientes, {
            showCancelBtn: true,
            labelEstado: 'Pendiente',
            colorEstado: 'primary'
        });
        html += renderSeccion('Historial', 'task_alt', 'text-white/40', completadas, {
            muted: true,
            labelEstado: 'Completada',
            colorEstado: 'white'
        });
        html += renderSeccion('Canceladas', 'cancel', 'text-red-400/60', canceladas, {
            muted: true,
            labelEstado: 'Cancelada',
            colorEstado: 'red'
        });

        container.innerHTML = html;
    }

    async function initProfile() {
        const user = roleManager && roleManager.currentUser;
        if (!user || !user.uid) return;

        try {
            const citas = await CitasService.listByCliente(user.uid);
            const completadasCount = renderStats(citas);
            renderTierBadge(calcularTier(completadasCount));
            renderReservas(citas);
        } catch (error) {
            console.error('❌ Error cargando profile:', error);
            const container = document.getElementById('profile-reservas-container');
            if (container) {
                container.innerHTML = `
                    <div class="text-center py-8">
                        <p class="text-red-400 text-xs">Error al cargar tus reservas</p>
                        <button onclick="initProfile()" class="mt-3 px-4 py-2 bg-primary/20 text-primary text-xs font-bold rounded-lg border border-primary/30">
                            Reintentar
                        </button>
                    </div>
                `;
            }
        }
    }

    async function cancelarMiReserva(citaId) {
        if (!confirm('¿Cancelar esta reserva? No podrás deshacer esta acción.')) return;
        const ok = await CitasService.cancelar(citaId);
        if (ok) {
            if (typeof window.showToast === 'function') {
                window.showToast('Reserva cancelada', 'success');
            }
            await initProfile();
        } else {
            alert('No se pudo cancelar. Intenta de nuevo.');
        }
    }

    window.initProfile = initProfile;
    window.cancelarMiReserva = cancelarMiReserva;
    console.log('✓ ProfileUI loaded');
})();
