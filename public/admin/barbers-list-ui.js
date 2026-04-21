/**
 * LEGENDS BARBERIA - ADMIN: BARBERS LIST UI
 * Renderiza la lista de barberos y cada tarjeta individual.
 * Extiende BarberManager.prototype para mantener acceso al estado (`this.barbers`).
 */

(function () {
    'use strict';

    if (typeof BarberManager === 'undefined') {
        console.error('❌ barbers-list-ui: BarberManager no está definido. Revisa el orden de scripts.');
        return;
    }

    const NIVEL_COLORS = {
        'Experto':      { bg: 'bg-blue-500/15',   text: 'text-blue-400',   border: 'border-blue-500/30',   icon: 'workspace_premium', rgb: '59,130,246' },
        'Profesional':  { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', icon: 'military_tech',     rgb: '168,85,247' },
        'Leyenda':      { bg: 'bg-primary/15',    text: 'text-primary',    border: 'border-primary/30',    icon: 'emoji_events',      rgb: '201,167,74' },
    };

    const DIAS_LABELS = { lunes: 'L', martes: 'M', miercoles: 'X', jueves: 'J', viernes: 'V', sabado: 'S', domingo: 'D' };
    const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

    BarberManager.prototype.renderBarbersList = function () {
        const listContainer = document.getElementById('admin-barbers-list');
        if (!listContainer) return;

        if (this.barbers.length === 0) {
            listContainer.innerHTML = `
                <div class="barber-empty-state">
                    <div class="barber-empty-icon">
                        <span class="material-symbols-outlined text-primary/30 text-6xl">content_cut</span>
                    </div>
                    <p class="text-white/50 text-base font-bold mt-4">Sin barberos registrados</p>
                    <p class="text-white/30 text-xs mt-1">Agrega tu primer barbero con el botón de arriba</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = this.barbers.map((barber, index) =>
            this.renderBarberCard(barber, index)
        ).join('');
    };

    BarberManager.prototype.renderBarberCard = function (barber, index) {
        const nivel = NIVEL_COLORS[barber.nivel] || NIVEL_COLORS['Experto'];

        const horarioHTML = DIAS_ORDEN.map(dia => {
            const config = barber.horario?.[dia];
            const activo = config?.activo;
            return `<div class="flex flex-col items-center gap-0.5">
                <span class="text-[9px] font-black uppercase ${activo ? 'text-primary' : 'text-white/20'}">${DIAS_LABELS[dia]}</span>
                <div class="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold
                    ${activo ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-white/5 text-white/15 border border-white/5'}">
                    ${activo ? '✓' : '—'}
                </div>
            </div>`;
        }).join('');

        const primerDiaActivo = DIAS_ORDEN.find(d => barber.horario?.[d]?.activo);
        const horarioTexto = primerDiaActivo
            ? `${barber.horario[primerDiaActivo].desde} - ${barber.horario[primerDiaActivo].hasta}`
            : 'Sin horario';

        const photoSrc = barber.userPhoto
            ? barber.userPhoto
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(barber.userName || 'B')}&background=c9a74a&color=000&bold=true`;

        const safeName = (barber.userName || '').replace(/'/g, "\\'");

        return `
        <div class="barber-card" data-nivel="${barber.nivel || 'Experto'}" style="animation-delay: ${index * 0.08}s; --nivel-rgb: ${nivel.rgb};">
            <div class="barber-card-inner">
                <div class="flex items-center gap-4 mb-4">
                    <div class="relative">
                        <div class="w-16 h-16 rounded-2xl overflow-hidden border-2 shadow-[0_0_15px_rgba(var(--nivel-rgb),0.25)]" style="border-color: rgba(var(--nivel-rgb), 0.45);">
                            <img src="${photoSrc}" alt="${barber.userName}" class="w-full h-full object-cover">
                        </div>
                        <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${nivel.bg} ${nivel.border} border flex items-center justify-center">
                            <span class="material-symbols-outlined ${nivel.text} text-[10px]" style="font-variation-settings: 'FILL' 1">${nivel.icon}</span>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="text-white font-black text-base leading-tight truncate">${barber.userName || 'Sin nombre'}</h3>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${nivel.bg} ${nivel.text} ${nivel.border} border">
                                <span class="material-symbols-outlined text-[10px]" style="font-variation-settings: 'FILL' 1">${nivel.icon}</span>
                                ${barber.nivel || 'Experto'}
                            </span>
                        </div>
                    </div>
                    <div class="flex gap-1.5">
                        <button onclick="barberManager.openEditBarberModal('${barber.id}')"
                            class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:border-primary/40 hover:bg-primary/10 transition-all active:scale-90" title="Editar">
                            <span class="material-symbols-outlined text-white/60 text-lg hover:text-primary">edit</span>
                        </button>
                        <button onclick="barberManager.confirmDeleteBarber('${barber.id}', '${safeName}')"
                            class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:border-red-500/40 hover:bg-red-500/10 transition-all active:scale-90" title="Eliminar">
                            <span class="material-symbols-outlined text-white/60 text-lg hover:text-red-400">delete</span>
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2.5 mb-4">
                    <div class="barber-info-chip">
                        <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">content_cut</span>
                        <div>
                            <p class="text-[9px] text-white/40 font-bold uppercase tracking-wider">Corte</p>
                            <p class="text-sm font-black text-primary">${typeof window.formatCOP === 'function' ? window.formatCOP(barber.corte?.precio || 0) : '$' + (barber.corte?.precio || 0)}</p>
                        </div>
                    </div>
                    <div class="barber-info-chip">
                        <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">schedule</span>
                        <div>
                            <p class="text-[9px] text-white/40 font-bold uppercase tracking-wider">Horario</p>
                            <p class="text-xs font-bold text-white/80">${horarioTexto}</p>
                        </div>
                    </div>
                </div>

                <div class="flex items-center justify-between px-1 pt-3 border-t border-white/5">
                    ${horarioHTML}
                </div>
            </div>
        </div>
        `;
    };

    console.log('✓ admin/barbers-list-ui loaded');
})();
