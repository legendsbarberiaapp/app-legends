/**
 * LEGENDS BARBERIA - ADMIN: SERVICIOS PICKER UI
 * Selector de servicios dentro del formulario de barbero + gestor global de servicios.
 * Extiende BarberManager.prototype.
 */

(function () {
    'use strict';

    if (typeof BarberManager === 'undefined') {
        console.error('❌ servicios-picker-ui: BarberManager no está definido.');
        return;
    }

    BarberManager.prototype.renderServiciosInModal = function (selectedIds = []) {
        const container = document.getElementById('servicios-corte-list');
        if (!container) return;

        if (this.serviciosCorte.length === 0) {
            container.innerHTML = '<p class="text-white/30 text-xs text-center py-4">No hay servicios configurados</p>';
            return;
        }

        container.innerHTML = this.serviciosCorte.map(svc => {
            const svcId = svc.id || svc.nombre;
            const isSelected = selectedIds.includes(svcId);
            const safeName = (svc.nombre || '').replace(/'/g, "\\'");
            return `
            <div class="svc-chip ${isSelected ? 'active' : ''}" id="svc-chip-${svcId}" onclick="barberManager.toggleServicio('${svcId}')">
                <div class="svc-chip-check">
                    <span class="material-symbols-outlined text-[12px]" style="font-variation-settings: 'FILL' 1">check</span>
                </div>
                <span class="svc-chip-name">${svc.nombre}</span>
                <button class="svc-chip-desc-btn" onclick="event.stopPropagation(); barberManager.openDescripcionEditor('${svcId}', '${safeName}')"
                    title="${svc.descripcion ? 'Editar descripción' : 'Agregar descripción'}">
                    <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' ${svc.descripcion ? 1 : 0}">
                        ${svc.descripcion ? 'description' : 'note_add'}
                    </span>
                </button>
            </div>`;
        }).join('');

        setTimeout(() => {
            this.updateSvcCountBadge();
            if (selectedIds.length > 0) {
                const panel = document.getElementById('servicios-corte-panel');
                const arrow = document.getElementById('svc-toggle-arrow');
                if (panel && panel.classList.contains('collapsed')) {
                    panel.classList.remove('collapsed');
                    panel.style.maxHeight = panel.scrollHeight + 'px';
                    if (arrow) arrow.style.transform = 'rotate(180deg)';
                }
            }
        }, 50);
    };

    BarberManager.prototype.toggleServicio = function (svcId) {
        const chip = document.getElementById(`svc-chip-${svcId}`);
        if (chip) chip.classList.toggle('active');
        this.updateSvcCountBadge();
    };

    BarberManager.prototype.updateSvcCountBadge = function () {
        const count = document.querySelectorAll('.svc-chip.active').length;
        const badge = document.getElementById('svc-count-badge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? '' : 'none';
        }
    };

    BarberManager.prototype.toggleServiciosPanel = function () {
        const panel = document.getElementById('servicios-corte-panel');
        const arrow = document.getElementById('svc-toggle-arrow');
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

    BarberManager.prototype.getSelectedServicios = function () {
        const chips = document.querySelectorAll('.svc-chip.active');
        return Array.from(chips).map(chip => {
            const id = chip.id.replace('svc-chip-', '');
            const svc = this.serviciosCorte.find(s => (s.id || s.nombre) === id);
            return svc ? { id: svc.id || svc.nombre, nombre: svc.nombre } : null;
        }).filter(Boolean);
    };

    BarberManager.prototype.openDescripcionEditor = function (svcId, nombre) {
        const svc = this.serviciosCorte.find(s => (s.id || s.nombre) === svcId);
        const currentDesc = svc?.descripcion || '';

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
                        <p class="text-white/40 text-[10px] uppercase tracking-wider font-bold">Descripción del servicio</p>
                    </div>
                </div>
                <textarea id="svc-desc-textarea"
                    class="w-full h-24 p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium resize-none outline-none focus:border-primary/50 transition-colors placeholder:text-white/20"
                    placeholder="Describe en qué consiste este servicio...">${currentDesc}</textarea>
                <div class="flex gap-3 mt-4">
                    <button onclick="barberManager.closeDescEditor()" class="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Cancelar
                    </button>
                    <button onclick="barberManager.saveDescripcion('${svcId}')" class="flex-1 px-4 py-2.5 rounded-xl bg-primary text-black text-xs font-black uppercase tracking-wider hover:bg-yellow-500 transition-all active:scale-[0.97]">
                        Guardar
                    </button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => {
            document.getElementById('svc-desc-overlay')?.classList.add('visible');
            document.getElementById('svc-desc-textarea')?.focus();
        });
    };

    BarberManager.prototype.closeDescEditor = function () {
        const overlay = document.getElementById('svc-desc-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
    };

    BarberManager.prototype.saveDescripcion = async function (svcId) {
        const textarea = document.getElementById('svc-desc-textarea');
        const desc = textarea?.value || '';
        const success = await this.updateServicioDescripcion(svcId, desc);
        this.closeDescEditor();
        if (success) {
            this.showToast('Descripción guardada ✓', 'success');
            const btn = document.querySelector(`#svc-chip-${svcId} .svc-chip-desc-btn .material-symbols-outlined`);
            if (btn) {
                btn.textContent = desc ? 'description' : 'note_add';
                btn.style.fontVariationSettings = `'FILL' ${desc ? 1 : 0}`;
            }
        }
    };

    /**
     * Íconos curados para servicios del corte. El admin escoge uno de estos
     * en el overlay "Gestionar Servicios" y se renderiza en la card del home
     * "Servicios Populares". Si no se setea, default 'content_cut'.
     */
    const SERVICIO_ICONOS = [
        'content_cut', 'face', 'waves', 'straighten',
        'brush', 'spa', 'mood', 'auto_fix_high'
    ];
    BarberManager.prototype.SERVICIO_ICONOS = SERVICIO_ICONOS;

    BarberManager.prototype.openGestionarServicios = function () {
        const existing = document.getElementById('svc-manage-overlay');
        if (existing) existing.remove();

        const listHTML = this.serviciosCorte.map(svc => {
            const safeName = (svc.nombre || '').replace(/'/g, "\\'");
            const icon = svc.icon || 'content_cut';
            const isPopular = !!svc.popular;
            return `
            <div class="flex items-center gap-3 p-2.5 rounded-xl bg-white/3 hover:bg-white/5 transition-colors group">
                <button onclick="barberManager.openIconPicker('${svc.id}', '${safeName}')"
                    title="Cambiar ícono"
                    class="w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 flex items-center justify-center transition-all active:scale-95">
                    <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1">${icon}</span>
                </button>
                <span class="flex-1 text-white text-sm font-semibold">${svc.nombre}</span>
                ${svc.descripcion ? '<span class="material-symbols-outlined text-white/20 text-sm" style="font-variation-settings: \'FILL\' 1">description</span>' : ''}
                <button onclick="barberManager.toggleServicioPopular('${svc.id}', this)"
                    title="${isPopular ? 'Quitar de Populares' : 'Marcar como Popular'}"
                    class="w-7 h-7 rounded-lg ${isPopular ? 'bg-primary/20' : 'bg-transparent hover:bg-white/5'} flex items-center justify-center transition-all active:scale-95">
                    <span class="material-symbols-outlined ${isPopular ? 'text-primary' : 'text-white/30'} text-base" style="font-variation-settings: 'FILL' ${isPopular ? 1 : 0}">star</span>
                </button>
                <button onclick="barberManager.confirmDeleteServicio('${svc.id}', '${safeName}')" class="w-7 h-7 rounded-lg bg-transparent hover:bg-red-500/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                    <span class="material-symbols-outlined text-red-400 text-sm">close</span>
                </button>
            </div>`;
        }).join('');

        const html = `
        <div id="svc-manage-overlay" class="barber-modal-overlay" style="z-index:160">
            <div class="barber-confirm-dialog" style="max-width:420px">
                <div class="flex items-center gap-3 mb-5">
                    <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1">checklist</span>
                    </div>
                    <div>
                        <h3 class="text-white font-black text-base">Gestionar Servicios</h3>
                        <p class="text-white/40 text-[10px] uppercase tracking-wider font-bold">Agregar o eliminar servicios del corte</p>
                    </div>
                </div>

                <div id="svc-manage-list" class="space-y-1 mb-4 max-h-48 overflow-y-auto" style="scrollbar-width:none">
                    ${listHTML}
                </div>

                <div class="flex gap-2 mb-4">
                    <input type="text" id="svc-new-name" class="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium outline-none focus:border-primary/50 transition-colors placeholder:text-white/20" placeholder="Nombre del nuevo servicio...">
                    <button onclick="barberManager.handleAddServicio()" class="px-4 py-2.5 rounded-xl bg-primary text-black text-xs font-black uppercase hover:bg-yellow-500 transition-all active:scale-[0.97]">
                        <span class="material-symbols-outlined text-base">add</span>
                    </button>
                </div>

                <button onclick="barberManager.closeGestionarServicios()" class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                    Cerrar
                </button>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => {
            document.getElementById('svc-manage-overlay')?.classList.add('visible');
        });
    };

    BarberManager.prototype.handleAddServicio = async function () {
        const input = document.getElementById('svc-new-name');
        const nombre = input?.value?.trim();
        if (!nombre) {
            this.showToast('Escribe un nombre', 'error');
            input?.focus();
            return;
        }
        if (this.serviciosCorte.some(s => s.nombre.toLowerCase() === nombre.toLowerCase())) {
            this.showToast('Ese servicio ya existe', 'error');
            return;
        }
        const success = await this.addServicioCorte(nombre);
        if (success) {
            this.showToast(`"${nombre}" agregado ✓`, 'success');
            this.closeGestionarServicios();
            const selectedIds = this.getSelectedServicios().map(s => s.id);
            this.renderServiciosInModal(selectedIds);
            this.openGestionarServicios();
        }
    };

    BarberManager.prototype.confirmDeleteServicio = async function (id, nombre) {
        if (await window.uiConfirm({ title: `¿Eliminar "${nombre}"?`, message: 'Se quitará de todos los barberos.', confirmText: 'Sí, eliminar', danger: true, icon: 'delete' })) {
            const success = await this.deleteServicioCorte(id);
            if (success) {
                this.showToast(`"${nombre}" eliminado`, 'success');
                this.closeGestionarServicios();
                const selectedIds = this.getSelectedServicios().map(s => s.id);
                this.renderServiciosInModal(selectedIds);
                this.openGestionarServicios();
            }
        }
    };

    BarberManager.prototype.toggleServicioPopular = async function (svcId, btnEl) {
        const svc = this.serviciosCorte.find(s => s.id === svcId);
        if (!svc) return;
        const nuevoValor = !svc.popular;
        const ok = await this.updateServicio(svcId, { popular: nuevoValor });
        if (!ok) {
            this.showToast('Error guardando', 'error');
            return;
        }
        const icon = btnEl?.querySelector('.material-symbols-outlined');
        if (btnEl) {
            btnEl.classList.toggle('bg-primary/20', nuevoValor);
            btnEl.classList.toggle('bg-transparent', !nuevoValor);
            btnEl.classList.toggle('hover:bg-white/5', !nuevoValor);
            btnEl.title = nuevoValor ? 'Quitar de Populares' : 'Marcar como Popular';
        }
        if (icon) {
            icon.classList.toggle('text-primary', nuevoValor);
            icon.classList.toggle('text-white/30', !nuevoValor);
            icon.style.fontVariationSettings = `'FILL' ${nuevoValor ? 1 : 0}`;
        }
        this.showToast(nuevoValor ? `"${svc.nombre}" marcado como popular ⭐` : `"${svc.nombre}" ya no es popular`, 'success');
    };

    BarberManager.prototype.openIconPicker = function (svcId, nombre) {
        const svc = this.serviciosCorte.find(s => s.id === svcId);
        const current = svc?.icon || 'content_cut';

        const existing = document.getElementById('svc-icon-overlay');
        if (existing) existing.remove();

        const iconsHTML = SERVICIO_ICONOS.map(name => `
            <button onclick="barberManager.selectIcon('${svcId}', '${name}')"
                class="w-14 h-14 rounded-xl ${name === current ? 'bg-primary/25 border-2 border-primary' : 'bg-white/5 border border-white/10 hover:bg-white/10'} flex items-center justify-center transition-all active:scale-95">
                <span class="material-symbols-outlined ${name === current ? 'text-primary' : 'text-white/70'} text-2xl" style="font-variation-settings: 'FILL' 1">${name}</span>
            </button>
        `).join('');

        const html = `
        <div id="svc-icon-overlay" class="barber-modal-overlay" style="z-index:170">
            <div class="barber-confirm-dialog" style="max-width:380px">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1">palette</span>
                    </div>
                    <div>
                        <h3 class="text-white font-black text-sm">${nombre}</h3>
                        <p class="text-white/40 text-[10px] uppercase tracking-wider font-bold">Ícono del servicio</p>
                    </div>
                </div>
                <div class="grid grid-cols-4 gap-2 mb-4">${iconsHTML}</div>
                <button onclick="barberManager.closeIconPicker()" class="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                    Cerrar
                </button>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => {
            document.getElementById('svc-icon-overlay')?.classList.add('visible');
        });
    };

    BarberManager.prototype.selectIcon = async function (svcId, iconName) {
        const ok = await this.updateServicio(svcId, { icon: iconName });
        if (!ok) {
            this.showToast('Error guardando ícono', 'error');
            return;
        }
        this.closeIconPicker();
        this.closeGestionarServicios();
        this.openGestionarServicios();
        this.showToast('Ícono actualizado ✓', 'success');
    };

    BarberManager.prototype.closeIconPicker = function () {
        const overlay = document.getElementById('svc-icon-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
    };

    BarberManager.prototype.closeGestionarServicios = function () {
        const overlay = document.getElementById('svc-manage-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
    };

    console.log('✓ admin/servicios-picker-ui loaded');
})();
