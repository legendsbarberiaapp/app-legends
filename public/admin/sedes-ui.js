/**
 * LEGENDS BARBERIA - ADMIN: SEDES UI
 *
 * Overlay para que el admin renombre las sedes (sucursales).
 * En F1 trabajamos con 2 sedes fijas semilladas por SedesService — solo se
 * permite editar el nombre. Agregar/borrar quedó deliberadamente fuera para
 * evitar UI compleja y errores accidentales.
 *
 * Extiende BarberManager.prototype porque ya tenemos un BarberManager global
 * con su propio sistema de toasts y cache de sedes.
 */
(function () {
    'use strict';

    if (typeof BarberManager === 'undefined') {
        console.error('❌ sedes-ui: BarberManager no está definido. Revisa el orden de scripts.');
        return;
    }

    BarberManager.prototype.openGestionarSedes = async function () {
        // Refrescar cache antes de abrir
        await this.loadSedes();

        const existing = document.getElementById('sedes-manage-overlay');
        if (existing) existing.remove();

        const listHTML = (this.sedes || []).map(s => {
            const safeName = (s.nombre || '').replace(/"/g, '&quot;');
            return `
            <div class="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
                <div class="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1">storefront</span>
                </div>
                <input type="text" id="sede-name-input-${s.id}" data-sede-id="${s.id}" value="${safeName}"
                    maxlength="40" placeholder="Nombre de la sede"
                    class="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-bold outline-none focus:border-primary/50 transition-colors">
                <button onclick="barberManager.saveSedeNombre('${s.id}', this)"
                    class="px-3 py-2 rounded-lg bg-primary/15 border border-primary/25 text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/25 transition-all active:scale-95">
                    Guardar
                </button>
            </div>`;
        }).join('');

        const html = `
        <div id="sedes-manage-overlay" class="barber-modal-overlay" style="z-index:160">
            <div class="barber-confirm-dialog" style="max-width:460px">
                <div class="flex items-center gap-3 mb-5">
                    <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1">storefront</span>
                    </div>
                    <div>
                        <h3 class="text-white font-black text-base">Gestionar Sedes</h3>
                        <p class="text-white/40 text-[10px] uppercase tracking-wider font-bold">Renombrar las sucursales</p>
                    </div>
                </div>

                <div class="space-y-2 mb-4">
                    ${listHTML || '<p class="text-white/30 text-xs text-center py-4">No hay sedes (esto no debería pasar — recarga la app).</p>'}
                </div>

                <div class="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] mb-4">
                    <div class="flex items-start gap-2">
                        <span class="material-symbols-outlined text-amber-400/80 text-base shrink-0 mt-0.5" style="font-variation-settings: 'FILL' 1">info</span>
                        <p class="text-white/55 text-[11px] leading-relaxed">
                            El nombre cambia al instante en todas las pantallas (booking, agenda, recepcionista). Las citas viejas mostrarán el nombre nuevo automáticamente.
                        </p>
                    </div>
                </div>

                <button onclick="barberManager.closeGestionarSedes()"
                    class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                    Cerrar
                </button>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => {
            document.getElementById('sedes-manage-overlay')?.classList.add('visible');
        });
    };

    BarberManager.prototype.saveSedeNombre = async function (sedeId, btnEl) {
        const input = document.getElementById(`sede-name-input-${sedeId}`);
        if (!input) return;
        const nuevoNombre = (input.value || '').trim();
        if (!nuevoNombre) {
            this.showToast('El nombre no puede quedar vacío', 'error');
            input.focus();
            return;
        }
        if (nuevoNombre.length > 40) {
            this.showToast('Nombre demasiado largo (máx 40)', 'error');
            return;
        }

        // No tocar Firestore si no cambió
        const sedeActual = this.sedes.find(s => s.id === sedeId);
        if (sedeActual && sedeActual.nombre === nuevoNombre) {
            this.showToast('Sin cambios', 'info');
            return;
        }

        const originalText = btnEl?.innerHTML;
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '...';
        }

        const ok = await SedesService.update(sedeId, { nombre: nuevoNombre });

        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = originalText;
        }

        if (!ok) {
            this.showToast('No se pudo guardar', 'error');
            return;
        }
        // Actualizar cache local
        if (sedeActual) sedeActual.nombre = nuevoNombre;
        this.showToast(`Sede renombrada a "${nuevoNombre}" ✓`, 'success');

        // Refrescar lista de barberos para que los badges muestren el nombre nuevo
        if (typeof this.renderBarbersList === 'function') {
            this.renderBarbersList();
        }
    };

    BarberManager.prototype.closeGestionarSedes = function () {
        const overlay = document.getElementById('sedes-manage-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
    };

    console.log('✓ admin/sedes-ui loaded');
})();
