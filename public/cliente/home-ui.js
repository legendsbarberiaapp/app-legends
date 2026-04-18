/**
 * LEGENDS BARBERIA - HOME UI (CLIENTE)
 * Carga y muestra la próxima cita del cliente (confirmada o pendiente).
 * Si no tiene ninguna, muestra CTA amigable para reservar.
 */

(function () {
    'use strict';

    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    function formatearFechaLarga(iso) {
        if (!iso) return '';
        const [y, m, d] = iso.split('-').map(Number);
        const fecha = new Date(y, m - 1, d);
        return `${DIAS_SEMANA[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
    }

    /**
     * De todas las citas del cliente, devuelve la más próxima que aún
     * está activa (pendiente o confirmada). Ignora completadas/canceladas.
     */
    function elegirProxima(citas) {
        const activas = citas.filter(c => c.estado === 'pendiente' || c.estado === 'confirmada');
        if (activas.length === 0) return null;
        // `fechaHora` es un Timestamp de Firestore → comparable por .seconds
        activas.sort((a, b) => {
            const ta = a.fechaHora && a.fechaHora.seconds ? a.fechaHora.seconds : 0;
            const tb = b.fechaHora && b.fechaHora.seconds ? b.fechaHora.seconds : 0;
            return ta - tb;
        });
        return activas[0];
    }

    function renderProxima(cita) {
        const esConfirmada = cita.estado === 'confirmada';
        const theme = (typeof window.nivelTheme === 'function') ? window.nivelTheme(cita.barberoNivel) : { textCls: 'text-primary', borderLeft: '' };

        const badge = esConfirmada
            ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-500/15 border border-green-500/30">
                 <span class="material-symbols-outlined text-green-400 text-xs" style="font-variation-settings: 'FILL' 1" aria-hidden="true">check_circle</span>
                 <span class="text-green-400 text-[10px] font-black uppercase tracking-wider">Confirmada</span>
               </span>`
            : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/15 border border-primary/30">
                 <span class="material-symbols-outlined text-primary text-xs" style="font-variation-settings: 'FILL' 1" aria-hidden="true">schedule</span>
                 <span class="text-primary text-[10px] font-black uppercase tracking-wider">Esperando Confirmación</span>
               </span>`;

        return `
            <div class="fade-in-soft">
                <div class="flex items-center gap-2 mb-3">
                    <span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1" aria-hidden="true">event_available</span>
                    <h2 class="text-white/60 text-[10px] font-black uppercase tracking-widest">Tu Próxima Cita</h2>
                </div>

                <div class="relative group cursor-pointer tap-card" onclick="switchTab('profile')" role="button" tabindex="0" aria-label="Ver detalles de tu próxima cita">
                    <div class="absolute -inset-[1px] bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-2xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>

                    <div class="relative p-6 rounded-2xl bg-gradient-to-br from-surface-dark via-card-dark to-surface-dark border border-white/10 shadow-2xl transition-all duration-300 group-hover:border-primary/30" style="${theme.borderLeft}">
                        ${badge}

                        <div class="flex items-start justify-between gap-4 mt-4">
                            <div class="flex-1 min-w-0">
                                <h3 class="text-white text-xl font-black leading-tight tracking-tight">${cita.servicioNombre || 'Servicio'}</h3>
                                <p class="text-white/60 text-sm mt-1">con <span class="${theme.textCls} font-bold">${cita.barberoNombre || 'Barbero'}</span></p>
                            </div>
                            <div class="text-right shrink-0">
                                <p class="text-primary text-2xl font-black tabular-nums">${window.formatCOP(cita.servicioPrecio || 0)}</p>
                            </div>
                        </div>

                        <div class="flex items-center gap-3 mt-5 pt-4 border-t border-white/5">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-primary/80 text-base" aria-hidden="true">event</span>
                                <span class="text-white/85 text-sm font-semibold">${formatearFechaLarga(cita.fecha)}</span>
                            </div>
                            <span class="w-1 h-1 rounded-full bg-white/25"></span>
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-primary/80 text-base" aria-hidden="true">schedule</span>
                                <span class="text-white/85 text-sm font-semibold">${cita.hora || ''}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderSinCita() {
        return `
            <div class="flex flex-col items-center gap-4 py-10 px-6 rounded-2xl bg-gradient-to-br from-surface-dark to-card-dark border border-white/10 fade-in-soft">
                <div class="relative">
                    <div class="absolute inset-0 bg-primary/20 rounded-full blur-xl gold-pulse-soft"></div>
                    <div class="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-lg">
                        <span class="material-symbols-outlined text-[32px]" style="font-variation-settings: 'FILL' 0, 'wght' 300" aria-hidden="true">calendar_add_on</span>
                    </div>
                </div>
                <div class="text-center">
                    <p class="text-white font-bold text-base mb-1">Aún no tienes una cita</p>
                    <p class="text-white/60 text-xs">Agenda tu próximo corte en segundos</p>
                </div>
                <button onclick="switchTab('booking')" aria-label="Ir a reservar una cita ahora"
                    class="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-light text-black font-black text-sm uppercase tracking-wide shadow-[0_6px_20px_rgba(201,167,74,0.35)] hover:shadow-[0_10px_30px_rgba(201,167,74,0.5)] transition-all active:scale-[0.98]">
                    <span class="material-symbols-outlined text-lg" style="font-variation-settings: 'FILL' 1" aria-hidden="true">calendar_month</span>
                    <span>Reservar Ahora</span>
                </button>
            </div>
        `;
    }

    /**
     * Muestra un toast si el cliente tiene alguna cita recientemente
     * confirmada por el admin desde su última visita a home. Usa
     * localStorage para recordar el último momento en que se notificó.
     */
    function notificarConfirmacionesNuevas(user, citas) {
        const key = `legends_last_seen_conf_${user.uid}`;
        const lastSeenIso = localStorage.getItem(key);
        const lastSeen = lastSeenIso ? new Date(lastSeenIso) : new Date(0);

        const nuevas = citas.filter(c => {
            if (c.estado !== 'confirmada') return false;
            if (!c.confirmedAt || typeof c.confirmedAt.toDate !== 'function') return false;
            return c.confirmedAt.toDate() > lastSeen;
        });

        if (nuevas.length > 0 && typeof window.showToast === 'function') {
            const msg = nuevas.length === 1
                ? `¡Tu cita con ${nuevas[0].barberoNombre} fue confirmada!`
                : `${nuevas.length} de tus citas fueron confirmadas ✓`;
            // Pequeño delay para que el toast no coincida con transición de tab
            setTimeout(() => window.showToast(msg, 'success'), 400);
        }

        localStorage.setItem(key, new Date().toISOString());
    }

    /**
     * Renderiza la sección "Servicios Populares" en home.
     * Scroll horizontal con hasta 5 servicios. Al tocar uno: preselect
     * en booking y saltamos al tab booking (mismo flujo que antes tenía
     * el tab /services, que ahora está fusionado dentro de home).
     */
    function renderServiciosPreview() {
        const container = document.getElementById('home-servicios-preview');
        if (!container) return;

        const servicios = window.SERVICIOS_CATALOG || [];
        if (servicios.length === 0) {
            container.innerHTML = '';
            return;
        }

        // Priorizamos los marcados como `popular`; si no hay suficientes, completamos.
        const ordenados = [
            ...servicios.filter(s => s.popular),
            ...servicios.filter(s => !s.popular)
        ].slice(0, 6);

        container.innerHTML = ordenados.map((s, i) => `
            <button data-servicio-id="${s.id}" aria-label="Reservar ${s.nombre} por ${window.formatCOP(s.precio)}"
                style="--stagger-index: ${i};"
                class="stagger-item tap-card flex-shrink-0 w-40 p-4 rounded-2xl bg-gradient-to-br from-card-dark to-surface-dark border border-white/10 hover:border-primary/40 transition-all text-left overflow-hidden relative group">
                <div class="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                ${s.popular ? `
                    <div class="absolute top-2 right-2 px-1.5 py-0.5 bg-primary/25 border border-primary/45 rounded-full backdrop-blur-sm">
                        <span class="text-primary text-[8px] font-black uppercase tracking-wider">Popular</span>
                    </div>` : ''}
                <div class="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary/25 to-primary/10 border border-primary/25 flex items-center justify-center text-primary mb-3 group-hover:scale-110 transition-transform duration-300">
                    <span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' 0, 'wght' 300" aria-hidden="true">${s.icon || 'content_cut'}</span>
                </div>
                <p class="relative text-white text-sm font-bold mb-1 truncate">${s.nombre}</p>
                <div class="relative flex items-center gap-1 mb-2">
                    <span class="material-symbols-outlined text-white/45 text-[10px]" aria-hidden="true">schedule</span>
                    <p class="text-white/55 text-[10px] font-medium">${s.duracionMin || 45} min</p>
                </div>
                <p class="relative text-primary font-black text-base tabular-nums">${window.formatCOP(s.precio)}</p>
            </button>
        `).join('');

        container.querySelectorAll('[data-servicio-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const servicio = servicios.find(s => s.id === btn.dataset.servicioId);
                if (!servicio) return;
                if (typeof window.preselectBooking === 'function') {
                    window.preselectBooking({ servicio });
                }
                switchTab('booking');
            });
        });
    }

    /**
     * Renderiza la sección "Nuestros Barberos" en home.
     * Scroll horizontal con avatar + nombre + nivel. Al tocar uno:
     * preselect en booking y saltamos al tab booking.
     */
    async function renderBarberosPreview() {
        const container = document.getElementById('home-barberos-preview');
        if (!container) return;

        try {
            if (typeof BarbersService === 'undefined' || !BarbersService.list) {
                container.innerHTML = '';
                return;
            }
            const barberos = await BarbersService.list();
            if (!barberos || barberos.length === 0) {
                container.innerHTML = '';
                return;
            }

            const nivelDot = (nivel) => ({
                Leyenda: 'bg-primary',
                Profesional: 'bg-purple-500',
                Experto: 'bg-blue-500'
            }[nivel] || 'bg-green-500');

            container.innerHTML = barberos.slice(0, 10).map((b, i) => {
                const nombre = b.userName || b.nombre || b.displayName || 'Barbero';
                const fallbackFoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=c9a74a&color=000&size=200&bold=true`;
                const foto = b.userPhoto || b.photoURL || b.foto || fallbackFoto;
                const nivel = b.nivel || 'Profesional';
                return `
                    <button data-barbero-id="${b.id}" aria-label="Reservar con ${nombre}, ${nivel}"
                        style="--stagger-index: ${i};"
                        class="stagger-item tap-card flex-shrink-0 flex flex-col items-center gap-2.5 w-24 p-3 rounded-2xl bg-gradient-to-br from-card-dark to-surface-dark border border-white/10 hover:border-primary/40 transition-all">
                        <div class="relative">
                            <div class="w-16 h-16 rounded-full overflow-hidden ring-2 ring-primary/35 shadow-lg bg-gradient-to-br from-primary/20 to-card-dark">
                                <img src="${foto}" alt="" loading="lazy"
                                    referrerpolicy="no-referrer"
                                    onerror="this.onerror=null;this.src='${fallbackFoto}';"
                                    class="w-full h-full object-cover">
                            </div>
                            <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${nivelDot(nivel)} border-2 border-card-dark" aria-hidden="true"></span>
                        </div>
                        <div class="text-center w-full">
                            <p class="text-white text-xs font-bold leading-tight truncate">${nombre}</p>
                            <p class="text-primary/80 text-[9px] font-semibold mt-0.5 truncate uppercase tracking-wider">${nivel}</p>
                        </div>
                    </button>
                `;
            }).join('');

            container.querySelectorAll('[data-barbero-id]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const barbero = barberos.find(b => b.id === btn.dataset.barberoId);
                    if (!barbero) return;
                    const preselection = {
                        id: barbero.userId || barbero.id,
                        nombre: barbero.userName || barbero.nombre || barbero.displayName || 'Barbero',
                        photoURL: barbero.userPhoto || barbero.photoURL || barbero.foto || null
                    };
                    if (typeof window.preselectBooking === 'function') {
                        window.preselectBooking({ barbero: preselection });
                    }
                    switchTab('booking');
                });
            });
        } catch (error) {
            console.error('❌ Error cargando barberos preview:', error);
            container.innerHTML = '';
        }
    }

    async function initHome() {
        const container = document.getElementById('home-proxima-container');
        if (!container) return;

        const user = roleManager && roleManager.currentUser;
        if (!user || !user.uid) {
            container.innerHTML = renderSinCita();
            renderServiciosPreview();
            renderBarberosPreview();
            return;
        }

        try {
            const citas = await CitasService.listByCliente(user.uid);
            notificarConfirmacionesNuevas(user, citas);
            const proxima = elegirProxima(citas);
            container.innerHTML = proxima ? renderProxima(proxima) : renderSinCita();
        } catch (error) {
            console.error('❌ Error cargando home:', error);
            container.innerHTML = renderSinCita();
        }

        // Secciones de exploración (fusionan las ex-tabs Servicios y Barberos)
        renderServiciosPreview();
        renderBarberosPreview();
    }

    window.initHome = initHome;
    console.log('✓ HomeUI loaded');
})();
