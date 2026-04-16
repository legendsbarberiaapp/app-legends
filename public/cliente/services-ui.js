/**
 * LEGENDS BARBERIA - SERVICES UI (CLIENTE)
 * Catálogo visual de servicios premium.
 * Al tocar una tarjeta, preselecciona ese servicio en booking y cambia de tab.
 * Lee del catálogo compartido window.SERVICIOS_CATALOG.
 */

(function () {
    'use strict';

    function renderCard(servicio) {
        const popularBadge = servicio.popular ? `
            <div class="absolute top-3 right-3 px-2 py-1 bg-primary/20 border border-primary/40 rounded-full">
                <span class="text-primary text-[9px] font-black uppercase tracking-wider">Popular</span>
            </div>
        ` : '';

        return `
            <button data-servicio-id="${servicio.id}"
                class="relative bg-gradient-to-br from-card-dark to-surface-dark p-6 rounded-2xl border border-white/10 hover:border-primary/40 transition-all duration-300 group cursor-pointer transform hover:-translate-y-1 active:scale-95 overflow-hidden text-left w-full">
                <!-- Glow al hover -->
                <div class="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                ${popularBadge}

                <!-- Icono -->
                <div class="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center text-primary mb-5 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg">
                    <span class="material-symbols-outlined text-[28px]" style="font-variation-settings: 'FILL' 0, 'wght' 300">${servicio.icon || 'content_cut'}</span>
                </div>

                <!-- Info -->
                <div class="relative">
                    <h3 class="text-white font-bold text-base mb-2 leading-tight">${servicio.nombre}</h3>
                    <div class="flex items-center gap-2 mb-3">
                        <span class="material-symbols-outlined text-white/40 text-xs">schedule</span>
                        <p class="text-gray-400 text-xs font-medium">${servicio.duracionMin || 45} min</p>
                    </div>
                    <p class="text-primary font-black text-xl">$${servicio.precio}<span class="text-sm font-medium">.00</span></p>
                </div>

                <!-- Indicador "reservar" que aparece al hover -->
                <div class="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                    <span class="material-symbols-outlined text-primary text-lg">arrow_forward</span>
                </div>
            </button>
        `;
    }

    function initServicesPage() {
        const container = document.getElementById('services-list-container');
        if (!container) return;

        const servicios = window.SERVICIOS_CATALOG || [];

        if (servicios.length === 0) {
            container.innerHTML = `
                <div class="col-span-2 flex flex-col items-center gap-3 py-16 px-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                    <span class="material-symbols-outlined text-white/20 text-6xl" style="font-variation-settings: 'FILL' 1">content_cut</span>
                    <p class="text-white/50 text-sm font-medium text-center">Catálogo en preparación</p>
                </div>
            `;
            return;
        }

        container.innerHTML = servicios.map(renderCard).join('');

        // Al tocar una tarjeta: preselecciona y va a booking
        container.querySelectorAll('[data-servicio-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const servicio = servicios.find(s => s.id === btn.dataset.servicioId);
                if (!servicio) return;
                reservarConServicio(servicio);
            });
        });

        console.log(`✓ ${servicios.length} servicios renderizados`);
    }

    function reservarConServicio(servicio) {
        if (typeof window.preselectBooking === 'function') {
            window.preselectBooking({ servicio });
        }
        switchTab('booking');
    }

    window.initServicesPage = initServicesPage;
    console.log('✓ ServicesUI loaded');
})();
