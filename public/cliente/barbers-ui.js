/**
 * LEGENDS BARBERIA - BARBEROS UI (CLIENTE)
 * Vitrina de barberos tirada de Firestore.
 * Al tocar "Reservar", preselecciona ese barbero y abre el tab de booking.
 */

(function () {
    'use strict';

    function renderCard(barbero) {
        const nombre = barbero.nombre || barbero.displayName || 'Barbero';
        const foto = barbero.photoURL || barbero.foto
            || `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=c9a74a&color=000&size=400`;
        const nivel = barbero.nivel || 'Barbero Profesional';

        // Etiqueta secundaria: muestra nivel si existe, si no "Disponible"
        const nivelColor = {
            Leyenda: 'text-primary',
            Profesional: 'text-purple-400',
            Experto: 'text-blue-400'
        }[barbero.nivel] || 'text-green-400';

        const nivelDot = {
            Leyenda: 'bg-primary shadow-[0_0_12px_rgba(201,167,74,0.8)]',
            Profesional: 'bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.8)]',
            Experto: 'bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]'
        }[barbero.nivel] || 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.8)]';

        return `
            <article class="group relative flex flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-card-dark to-surface-dark border border-white/10 shadow-2xl hover:border-primary/40 transition-all duration-500 transform hover:-translate-y-2">
                <div class="absolute -inset-[2px] bg-gradient-to-br from-primary/20 via-primary/10 to-transparent opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 rounded-3xl"></div>

                <div class="relative h-96 w-full overflow-hidden">
                    <img alt="${nombre}"
                        class="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-110"
                        src="${foto}" />

                    <div class="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
                    <div class="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/40"></div>

                    <!-- Content overlay -->
                    <div class="absolute bottom-0 left-0 right-0 p-6">
                        <div class="flex items-center gap-2 mb-3">
                            <div class="h-2.5 w-2.5 rounded-full ${nivelDot} animate-pulse"></div>
                            <span class="text-xs font-black uppercase tracking-widest ${nivelColor}">${nivel}</span>
                        </div>
                        <h3 class="text-[28px] font-black text-white leading-none mb-2 drop-shadow-2xl">${nombre}</h3>
                        <p class="text-sm font-semibold text-slate-200 leading-relaxed">Parte del equipo Legends</p>
                    </div>
                </div>

                <!-- Footer con botón reservar -->
                <div class="relative flex items-center justify-between p-5 bg-gradient-to-br from-surface-dark to-card-dark border-t border-white/5">
                    <div class="flex flex-col">
                        <span class="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Disponible para</span>
                        <span class="text-sm font-black text-white">Reservar contigo</span>
                    </div>
                    <button data-barbero-id="${barbero.id}"
                        class="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-light px-6 py-3 text-sm font-black text-black transition-all hover:shadow-[0_0_20px_rgba(201,167,74,0.5)] transform hover:scale-105 active:scale-95 uppercase tracking-wide">
                        <span>Reservar</span>
                        <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1">calendar_add_on</span>
                    </button>
                </div>
            </article>
        `;
    }

    async function initBarbersPage() {
        const container = document.getElementById('barbers-list-container');
        if (!container) return;

        container.innerHTML = `
            <div class="flex flex-col items-center gap-3 py-12">
                <div class="auth-checking-spinner"></div>
                <p class="text-white/50 text-sm">Cargando barberos...</p>
            </div>
        `;

        try {
            const barberos = await BarbersService.list();

            if (barberos.length === 0) {
                container.innerHTML = `
                    <div class="flex flex-col items-center gap-3 py-16 px-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                        <span class="material-symbols-outlined text-white/20 text-6xl" style="font-variation-settings: 'FILL' 1">person_off</span>
                        <p class="text-white/50 text-sm font-medium text-center">Aún no hay barberos disponibles</p>
                        <p class="text-white/30 text-xs text-center">Pronto sumaremos a los mejores profesionales</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = barberos.map(renderCard).join('');

            // Listener de "Reservar": preselecciona el barbero y cambia al tab booking
            container.querySelectorAll('[data-barbero-id]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const barbero = barberos.find(b => b.id === btn.dataset.barberoId);
                    if (!barbero) return;
                    reservarConBarbero(barbero);
                });
            });

            console.log(`✓ ${barberos.length} barberos renderizados`);

        } catch (error) {
            console.error('❌ Error cargando barberos:', error);
            container.innerHTML = `
                <div class="text-center py-12">
                    <span class="material-symbols-outlined text-red-400 text-5xl mb-2">error</span>
                    <p class="text-red-400 text-sm">Error al cargar barberos</p>
                    <button onclick="initBarbersPage()" class="mt-3 px-4 py-2 bg-primary/20 text-primary text-xs font-bold rounded-lg border border-primary/30">
                        Reintentar
                    </button>
                </div>
            `;
        }
    }

    function reservarConBarbero(barbero) {
        const nombre = barbero.nombre || barbero.displayName || 'Barbero';
        const preselection = {
            id: barbero.userId || barbero.id,
            nombre,
            photoURL: barbero.photoURL || barbero.foto || null
        };

        if (typeof window.preselectBooking === 'function') {
            window.preselectBooking({ barbero: preselection });
        }
        switchTab('booking');
    }

    window.initBarbersPage = initBarbersPage;
    console.log('✓ BarbersUI loaded');
})();
