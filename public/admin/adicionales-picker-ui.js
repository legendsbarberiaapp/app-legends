/**
 * LEGENDS BARBERIA - ADMIN: ADICIONALES PICKER UI
 * Selector de adicionales (con precios) + gestor global de adicionales.
 * Extiende BarberManager.prototype.
 */

(function () {
    'use strict';

    if (typeof BarberManager === 'undefined') {
        console.error('❌ adicionales-picker-ui: BarberManager no está definido.');
        return;
    }

    BarberManager.prototype.renderAdicionalesInModal = function (barberAdicionales = []) {
        const container = document.getElementById('adicionales-list');
        if (!container) return;

        if (this.adicionalesGlobal.length === 0) {
            container.innerHTML = '<p class="text-white/30 text-xs text-center py-4">No hay adicionales configurados</p>';
            return;
        }

        container.innerHTML = this.adicionalesGlobal.map(adic => {
            const barberAdic = barberAdicionales.find(a => a.id === adic.id);
            const isSelected = !!barberAdic;
            const precioConCorte = barberAdic?.precioConCorte || '';
            const precioSolo = barberAdic?.precioSolo || '';
            const safeName = (adic.nombre || '').replace(/'/g, "\\'");

            return `
            <div class="adic-item ${isSelected ? 'active' : ''}" id="adic-item-${adic.id}">
                <div class="adic-item-header" onclick="barberManager.toggleAdicional('${adic.id}')">
                    <div class="svc-chip-check">
                        <span class="material-symbols-outlined text-[12px]" style="font-variation-settings: 'FILL' 1">check</span>
                    </div>
                    <span class="adic-item-name">${adic.nombre}</span>
                    ${adic.soloConCorte ? '<span class="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">Solo con corte</span>' : ''}
                    <button class="svc-chip-desc-btn" onclick="event.stopPropagation(); barberManager.openAdicDescEditor('${adic.id}', '${safeName}')">
                        <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' ${adic.descripcion ? 1 : 0}">${adic.descripcion ? 'description' : 'note_add'}</span>
                    </button>
                </div>
                <div class="adic-prices ${isSelected ? '' : 'hidden'}" id="adic-prices-${adic.id}">
                    <div class="adic-price-field">
                        <span class="text-[9px] font-black uppercase text-white/35 tracking-wider">Con corte</span>
                        <div class="relative">
                            <span class="absolute left-2 top-1/2 -translate-y-1/2 text-primary text-xs font-black pointer-events-none">$</span>
                            <input type="text" inputmode="numeric" autocomplete="off" placeholder="0" value="${precioConCorte}" id="adic-precio-corte-${adic.id}" class="adic-price-input price-input" onclick="event.stopPropagation()">
                        </div>
                    </div>
                    ${!adic.soloConCorte ? `
                    <div class="adic-price-field">
                        <span class="text-[9px] font-black uppercase text-white/35 tracking-wider">Solo</span>
                        <div class="relative">
                            <span class="absolute left-2 top-1/2 -translate-y-1/2 text-primary text-xs font-black pointer-events-none">$</span>
                            <input type="text" inputmode="numeric" autocomplete="off" placeholder="0" value="${precioSolo}" id="adic-precio-solo-${adic.id}" class="adic-price-input price-input" onclick="event.stopPropagation()">
                        </div>
                    </div>` : ''}
                </div>
            </div>`;
        }).join('');

        setTimeout(() => this.updateAdicCountBadge(), 50);

        // Formato COP para los inputs de precio recién renderizados
        if (typeof window.attachPriceInput === 'function') {
            container.querySelectorAll('.price-input').forEach(el => window.attachPriceInput(el));
        }

        if (barberAdicionales.length > 0) {
            setTimeout(() => {
                const panel = document.getElementById('adicionales-panel');
                const arrow = document.getElementById('adic-toggle-arrow');
                if (panel && panel.classList.contains('collapsed')) {
                    panel.classList.remove('collapsed');
                    panel.style.maxHeight = panel.scrollHeight + 'px';
                    if (arrow) arrow.style.transform = 'rotate(180deg)';
                }
            }, 100);
        }
    };

    BarberManager.prototype.toggleAdicional = function (adicId) {
        const item = document.getElementById(`adic-item-${adicId}`);
        const prices = document.getElementById(`adic-prices-${adicId}`);
        if (!item) return;

        if (item.classList.contains('active')) {
            item.classList.remove('active');
            prices?.classList.add('hidden');
        } else {
            item.classList.add('active');
            prices?.classList.remove('hidden');
        }
        this.updateAdicCountBadge();
        setTimeout(() => {
            const panel = document.getElementById('adicionales-panel');
            if (panel && !panel.classList.contains('collapsed')) {
                panel.style.maxHeight = panel.scrollHeight + 'px';
            }
        }, 50);
    };

    BarberManager.prototype.updateAdicCountBadge = function () {
        const count = document.querySelectorAll('.adic-item.active').length;
        const badge = document.getElementById('adic-count-badge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? '' : 'none';
        }
    };

    BarberManager.prototype.toggleAdicionalesPanel = function () {
        const panel = document.getElementById('adicionales-panel');
        const arrow = document.getElementById('adic-toggle-arrow');
        if (!panel) return;

        if (panel.classList.contains('collapsed')) {
            panel.classList.remove('collapsed');
            panel.style.maxHeight = panel.scrollHeight + 'px';
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        } else {
            panel.style.maxHeight = '0px';
            panel.classList.add('collapsed');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        }
    };

    BarberManager.prototype.getSelectedAdicionales = function () {
        const items = document.querySelectorAll('.adic-item.active');
        return Array.from(items).map(item => {
            const id = item.id.replace('adic-item-', '');
            const adic = this.adicionalesGlobal.find(a => a.id === id);
            if (!adic) return null;
            const elCorte = document.getElementById(`adic-precio-corte-${id}`);
            const elSolo  = document.getElementById(`adic-precio-solo-${id}`);
            const precioCorte = typeof window.parsePriceInput === 'function'
                ? window.parsePriceInput(elCorte)
                : (parseFloat(elCorte?.value) || 0);
            const precioSolo = typeof window.parsePriceInput === 'function'
                ? window.parsePriceInput(elSolo)
                : (parseFloat(elSolo?.value) || 0);
            return {
                id: adic.id,
                nombre: adic.nombre,
                soloConCorte: adic.soloConCorte || false,
                precioConCorte: precioCorte,
                precioSolo: adic.soloConCorte ? null : precioSolo,
            };
        }).filter(Boolean);
    };

    BarberManager.prototype.openAdicDescEditor = function (adicId, nombre) {
        const adic = this.adicionalesGlobal.find(a => a.id === adicId);
        const currentDesc = adic?.descripcion || '';

        const existing = document.getElementById('svc-desc-overlay');
        if (existing) existing.remove();

        const html = `
        <div id="svc-desc-overlay" class="barber-modal-overlay" style="z-index:160">
            <div class="barber-confirm-dialog" style="max-width:400px">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1">description</span>
                    </div>
                    <div>
                        <h3 class="text-white font-black text-sm">${nombre}</h3>
                        <p class="text-white/40 text-[10px] uppercase tracking-wider font-bold">Descripción del adicional</p>
                    </div>
                </div>
                <textarea id="svc-desc-textarea" class="w-full h-24 p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium resize-none outline-none focus:border-primary/50 transition-colors placeholder:text-white/20" placeholder="Describe en qué consiste...">${currentDesc}</textarea>
                <div class="flex gap-3 mt-4">
                    <button onclick="barberManager.closeDescEditor()" class="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-all active:scale-[0.97]">Cancelar</button>
                    <button onclick="barberManager.saveAdicDescripcion('${adicId}')" class="flex-1 px-4 py-2.5 rounded-xl bg-primary text-black text-xs font-black uppercase tracking-wider hover:bg-yellow-500 transition-all active:scale-[0.97]">Guardar</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => {
            document.getElementById('svc-desc-overlay')?.classList.add('visible');
            document.getElementById('svc-desc-textarea')?.focus();
        });
    };

    BarberManager.prototype.saveAdicDescripcion = async function (adicId) {
        const desc = document.getElementById('svc-desc-textarea')?.value || '';
        const success = await this.updateAdicionalDescripcion(adicId, desc);
        this.closeDescEditor();
        if (success) this.showToast('Descripción guardada ✓', 'success');
    };

    BarberManager.prototype.openGestionarAdicionales = function () {
        const existing = document.getElementById('svc-manage-overlay');
        if (existing) existing.remove();

        const listHTML = this.adicionalesGlobal.map(a => {
            const safeName = (a.nombre || '').replace(/'/g, "\\'");
            return `
            <div class="flex items-center gap-2 p-2.5 rounded-xl bg-white/3 hover:bg-white/5 transition-colors group">
                <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">spa</span>
                <span class="flex-1 text-white text-xs font-semibold truncate">${a.nombre}</span>
                <button onclick="barberManager.toggleAdicionalSoloConCorte('${a.id}'); barberManager.closeGestionarAdicionales(); setTimeout(()=>barberManager.openGestionarAdicionales(),350)"
                    class="text-[8px] font-black uppercase px-1.5 py-0.5 rounded border transition-all cursor-pointer ${a.soloConCorte ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' : 'bg-white/5 text-white/30 border-white/10 hover:border-primary/30'}">
                    ${a.soloConCorte ? '✓ Solo c/corte' : 'Individual'}
                </button>
                ${a.descripcion ? '<span class="material-symbols-outlined text-white/20 text-xs" style="font-variation-settings: \'FILL\' 1">description</span>' : ''}
                <button onclick="barberManager.confirmDeleteAdicional('${a.id}', '${safeName}')" class="w-6 h-6 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                    <span class="material-symbols-outlined text-red-400 text-sm">close</span>
                </button>
            </div>`;
        }).join('');

        const html = `
        <div id="svc-manage-overlay" class="barber-modal-overlay" style="z-index:160">
            <div class="barber-confirm-dialog" style="max-width:420px">
                <div class="flex items-center gap-3 mb-5">
                    <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1">spa</span>
                    </div>
                    <div>
                        <h3 class="text-white font-black text-base">Gestionar Adicionales</h3>
                        <p class="text-white/40 text-[10px] uppercase tracking-wider font-bold">Agregar, eliminar o configurar</p>
                    </div>
                </div>
                <div class="space-y-1 mb-4 max-h-52 overflow-y-auto" style="scrollbar-width:none">${listHTML}</div>
                <div class="flex gap-2 mb-4">
                    <input type="text" id="adic-new-name" class="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium outline-none focus:border-primary/50 placeholder:text-white/20" placeholder="Nombre del nuevo adicional...">
                    <button onclick="barberManager.handleAddAdicional()" class="px-4 py-2.5 rounded-xl bg-primary text-black text-xs font-black uppercase hover:bg-yellow-500 transition-all active:scale-[0.97]">
                        <span class="material-symbols-outlined text-base">add</span>
                    </button>
                </div>
                <button onclick="barberManager.closeGestionarAdicionales()" class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">Cerrar</button>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => document.getElementById('svc-manage-overlay')?.classList.add('visible'));
    };

    BarberManager.prototype.handleAddAdicional = async function () {
        const input = document.getElementById('adic-new-name');
        const nombre = input?.value?.trim();
        if (!nombre) { this.showToast('Escribe un nombre', 'error'); input?.focus(); return; }
        if (this.adicionalesGlobal.some(a => a.nombre.toLowerCase() === nombre.toLowerCase())) {
            this.showToast('Ya existe', 'error'); return;
        }
        const success = await this.addAdicional(nombre);
        if (success) {
            this.showToast(`"${nombre}" agregado ✓`, 'success');
            this.closeGestionarAdicionales();
            const barberAdic = this.getSelectedAdicionales();
            this.renderAdicionalesInModal(barberAdic);
            this.openGestionarAdicionales();
        }
    };

    BarberManager.prototype.confirmDeleteAdicional = async function (id, nombre) {
        if (confirm(`¿Eliminar "${nombre}"?`)) {
            const success = await this.deleteAdicional(id);
            if (success) {
                this.showToast(`"${nombre}" eliminado`, 'success');
                this.closeGestionarAdicionales();
                const barberAdic = this.getSelectedAdicionales();
                this.renderAdicionalesInModal(barberAdic);
                this.openGestionarAdicionales();
            }
        }
    };

    BarberManager.prototype.closeGestionarAdicionales = function () {
        const overlay = document.getElementById('svc-manage-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
    };

    console.log('✓ admin/adicionales-picker-ui loaded');
})();
