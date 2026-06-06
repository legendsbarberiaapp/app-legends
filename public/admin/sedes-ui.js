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
            const safeWa = (s.whatsapp || '').replace(/"/g, '&quot;');
            return `
            <div class="p-3 rounded-xl bg-white/3 border border-white/5 space-y-2">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1">storefront</span>
                    </div>
                    <input type="text" id="sede-name-input-${s.id}" data-sede-id="${s.id}" value="${safeName}"
                        maxlength="40" placeholder="Nombre de la sede"
                        class="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-bold outline-none focus:border-primary/50 transition-colors">
                </div>
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-green-400 text-base shrink-0" style="font-variation-settings: 'FILL' 1">chat</span>
                    <input type="tel" id="sede-wa-input-${s.id}" value="${safeWa}" maxlength="15" inputmode="tel"
                        placeholder="WhatsApp tienda (ej: 573001234567)"
                        class="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-white/20">
                    <button onclick="barberManager.saveSedeNombre('${s.id}', this)"
                        class="px-3 py-2 rounded-lg bg-primary/15 border border-primary/25 text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/25 transition-all active:scale-95">
                        Guardar
                    </button>
                </div>
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

        // P3: WhatsApp de la tienda (solo dígitos). Si viene de 10 dígitos sin
        // indicativo (Colombia), anteponemos 57 para que wa.me resuelva.
        const waInput = document.getElementById(`sede-wa-input-${sedeId}`);
        let nuevoWa = (waInput?.value || '').replace(/[^\d]/g, '');
        if (nuevoWa.length === 10) nuevoWa = '57' + nuevoWa;

        // No tocar Firestore si no cambió nada
        const sedeActual = this.sedes.find(s => s.id === sedeId);
        if (sedeActual && sedeActual.nombre === nuevoNombre && (sedeActual.whatsapp || '') === nuevoWa) {
            this.showToast('Sin cambios', 'info');
            return;
        }

        const originalText = btnEl?.innerHTML;
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '...';
        }

        const ok = await SedesService.update(sedeId, { nombre: nuevoNombre, whatsapp: nuevoWa });

        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = originalText;
        }

        if (!ok) {
            this.showToast('No se pudo guardar', 'error');
            return;
        }
        // Actualizar cache local
        if (sedeActual) { sedeActual.nombre = nuevoNombre; sedeActual.whatsapp = nuevoWa; }
        this.showToast(`Sede guardada ✓`, 'success');

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

    /**
     * Render de la pestaña "Sedes" (reemplaza al viejo botón/modal del header
     * de Barberos). Pinta una tarjeta por sede con nombre + WhatsApp editables,
     * reutilizando saveSedeNombre() que ya persiste ambos campos.
     */
    BarberManager.prototype.renderSedesTab = function () {
        const cont = document.getElementById('admin-sedes-list');
        if (!cont) return;
        const sedes = this.sedes || [];
        if (!sedes.length) {
            cont.innerHTML = `
                <div class="text-center py-12">
                    <span class="material-symbols-outlined text-primary/30 text-5xl">storefront</span>
                    <p class="text-white/40 text-sm mt-2">No hay sedes. Recargá la app.</p>
                </div>`;
            return;
        }
        cont.innerHTML = sedes.map(s => {
            const safeName = (s.nombre || '').replace(/"/g, '&quot;');
            const safeWa = (s.whatsapp || '').replace(/"/g, '&quot;');
            return `
            <div class="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1">storefront</span>
                    </div>
                    <div class="flex-1">
                        <label class="block text-[10px] font-black uppercase tracking-wider text-white/40 mb-1">Nombre de la sede</label>
                        <input type="text" id="sede-name-input-${s.id}" data-sede-id="${s.id}" value="${safeName}"
                            maxlength="40" placeholder="Nombre de la sede"
                            class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-bold outline-none focus:border-primary/50 transition-colors">
                    </div>
                </div>
                <div>
                    <label class="block text-[10px] font-black uppercase tracking-wider text-white/40 mb-1">WhatsApp de la tienda</label>
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-green-400 text-lg shrink-0" style="font-variation-settings: 'FILL' 1">chat</span>
                        <input type="tel" id="sede-wa-input-${s.id}" value="${safeWa}" maxlength="15" inputmode="tel"
                            placeholder="ej: 573001234567"
                            class="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-white/20">
                        <button onclick="barberManager.saveSedeNombre('${s.id}', this)"
                            class="px-4 py-2 rounded-lg bg-primary/15 border border-primary/25 text-primary text-[11px] font-black uppercase tracking-wider hover:bg-primary/25 transition-all active:scale-95">
                            Guardar
                        </button>
                    </div>
                </div>
                <button onclick="verCajaSede('${s.id}')"
                    class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/80 text-[12px] font-bold hover:bg-white/[0.08] hover:border-primary/30 transition-all active:scale-[0.98]">
                    <span class="material-symbols-outlined text-primary text-base">point_of_sale</span>
                    Ver caja de esta sede
                </button>
            </div>`;
        }).join('');
    };

    /** Abre la caja del admin enfocada en la sede elegida (desde la pestaña Sedes). */
    window.verCajaSede = function (sedeId) {
        window.__cajaPreferSede = sedeId || null;
        if (typeof window.switchTab === 'function') window.switchTab('recepcionista-caja');
    };

    // Init de la pestaña Sedes (lo llama switchTab al abrir admin-sedes).
    window.initAdminSedes = async function () {
        if (typeof barberManager === 'undefined' || !barberManager) return;
        const cont = document.getElementById('admin-sedes-list');
        try {
            await barberManager.loadSedes();
            barberManager.renderSedesTab();
        } catch (e) {
            console.error('❌ initAdminSedes:', e);
            if (cont) cont.innerHTML = `
                <div class="text-center py-12">
                    <span class="material-symbols-outlined text-red-400 text-5xl">error</span>
                    <p class="text-red-400 text-sm mt-2">No se pudieron cargar las sedes</p>
                </div>`;
        }
    };

    console.log('✓ admin/sedes-ui loaded');
})();
