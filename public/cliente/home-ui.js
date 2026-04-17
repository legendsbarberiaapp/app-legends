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
        const color = esConfirmada ? 'green' : 'primary';

        const badge = esConfirmada
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-green-500/15 border border-green-500/30">
                 <span class="material-symbols-outlined text-green-400 text-xs" style="font-variation-settings: 'FILL' 1">check_circle</span>
                 <span class="text-green-400 text-[10px] font-black uppercase tracking-wider">Confirmada</span>
               </span>`
            : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/15 border border-primary/30">
                 <span class="material-symbols-outlined text-primary text-xs" style="font-variation-settings: 'FILL' 1">schedule</span>
                 <span class="text-primary text-[10px] font-black uppercase tracking-wider">Esperando Confirmación</span>
               </span>`;

        return `
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1">event_available</span>
                <h2 class="text-white/40 text-[10px] font-black uppercase tracking-widest">Tu Próxima Cita</h2>
            </div>

            <div class="relative group cursor-pointer" onclick="switchTab('profile')">
                <div class="absolute -inset-[1px] bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-2xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>

                <div class="relative p-6 rounded-2xl bg-gradient-to-br from-surface-dark via-card-dark to-surface-dark border border-white/10 shadow-2xl">
                    ${badge}

                    <div class="flex items-start justify-between gap-4 mt-4">
                        <div class="flex-1 min-w-0">
                            <h3 class="text-white text-xl font-black leading-tight tracking-tight">${cita.servicioNombre || 'Servicio'}</h3>
                            <p class="text-white/50 text-sm mt-1">con <span class="text-primary font-bold">${cita.barberoNombre || 'Barbero'}</span></p>
                        </div>
                        <div class="text-right shrink-0">
                            <p class="text-primary text-2xl font-black tabular-nums">$${cita.servicioPrecio || 0}</p>
                        </div>
                    </div>

                    <div class="flex items-center gap-3 mt-5 pt-4 border-t border-white/5">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/70 text-base">event</span>
                            <span class="text-white/80 text-sm font-semibold">${formatearFechaLarga(cita.fecha)}</span>
                        </div>
                        <span class="w-1 h-1 rounded-full bg-white/20"></span>
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/70 text-base">schedule</span>
                            <span class="text-white/80 text-sm font-semibold">${cita.hora || ''}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderSinCita() {
        return `
            <div class="flex flex-col items-center gap-4 py-10 px-6 rounded-2xl bg-gradient-to-br from-surface-dark to-card-dark border border-white/10">
                <div class="relative">
                    <div class="absolute inset-0 bg-primary/20 rounded-full blur-xl"></div>
                    <div class="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-lg">
                        <span class="material-symbols-outlined text-[32px]" style="font-variation-settings: 'FILL' 0, 'wght' 300">calendar_add_on</span>
                    </div>
                </div>
                <div class="text-center">
                    <p class="text-white font-bold text-base mb-1">Aún no tienes una cita</p>
                    <p class="text-white/50 text-xs">Agenda tu próximo corte en segundos</p>
                </div>
                <button onclick="switchTab('booking')"
                    class="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-light text-black font-black text-sm uppercase tracking-wide shadow-[0_6px_20px_rgba(201,167,74,0.3)] hover:shadow-[0_8px_25px_rgba(201,167,74,0.5)] transition-all active:scale-[0.98]">
                    <span class="material-symbols-outlined text-lg" style="font-variation-settings: 'FILL' 1">calendar_month</span>
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

    async function initHome() {
        const container = document.getElementById('home-proxima-container');
        if (!container) return;

        const user = roleManager && roleManager.currentUser;
        if (!user || !user.uid) {
            container.innerHTML = renderSinCita();
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
    }

    window.initHome = initHome;
    console.log('✓ HomeUI loaded');
})();
