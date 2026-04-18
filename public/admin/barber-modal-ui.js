/**
 * LEGENDS BARBERIA - ADMIN: BARBER MODAL UI
 * Modal de crear/editar barbero: apertura, interacciones, validación y submit.
 * Extiende BarberManager.prototype.
 */

(function () {
    'use strict';

    if (typeof BarberManager === 'undefined') {
        console.error('❌ barber-modal-ui: BarberManager no está definido.');
        return;
    }

    const DIAS_NOMBRES = {
        lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
        jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
    };
    const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

    const NIVEL_ACTIVE_CLASS = {
        Experto: 'active-blue',
        Profesional: 'active-purple',
        Leyenda: 'active-gold',
    };

    BarberManager.prototype.openAddBarberModal = async function () {
        this.editingBarberId = null;
        await Promise.all([this.loadUsers(), this.loadServiciosCorte(), this.loadAdicionales()]);
        this.showModal(null);
    };

    BarberManager.prototype.openEditBarberModal = async function (id) {
        this.editingBarberId = id;
        await Promise.all([this.loadUsers(), this.loadServiciosCorte(), this.loadAdicionales()]);
        const barber = this.barbers.find(b => b.id === id);
        if (!barber) {
            console.error('Barbero no encontrado:', id);
            return;
        }
        this.showModal(barber);
    };

    BarberManager.prototype.showModal = function (barberData) {
        const existingModal = document.getElementById('barber-modal-overlay');
        if (existingModal) existingModal.remove();

        const isEditing = barberData !== null;
        const title = isEditing ? 'Editar Barbero' : 'Agregar Nuevo Barbero';
        const submitText = isEditing ? 'Guardar Cambios' : 'Agregar Barbero';

        const barberUserIds = this.barbers.map(b => b.userId);
        const usersOptions = this.allUsers
            .filter(u => u.role !== 'admin')
            .filter(u => {
                if (barberData && barberData.userId === u.uid) return true;
                return !barberUserIds.includes(u.uid);
            })
            .map(u => {
                const selected = barberData && barberData.userId === u.uid ? 'selected' : '';
                return `<option value="${u.uid}" data-name="${u.displayName || u.email}" data-photo="${u.photoURL || ''}" ${selected}>
                    ${u.displayName || u.email || u.uid}
                </option>`;
            }).join('');

        const horarioHTML = Object.entries(DIAS_NOMBRES).map(([key, label]) => {
            const config = barberData?.horario?.[key] || { activo: false, desde: '09:00', hasta: '18:00' };

            // Domingo: bloqueado siempre (solo cortes walk-in en la barbería)
            if (key === 'domingo') {
                return `
                <div class="barber-schedule-day" data-day="${key}" style="opacity:0.55;">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3 flex-1">
                            <div class="barber-day-toggle" style="opacity:0.4; cursor:not-allowed;" title="Domingo no se puede activar">
                                <div class="barber-day-toggle-dot"></div>
                            </div>
                            <div class="flex flex-col">
                                <span class="text-sm font-bold text-white/55">${label}</span>
                                <span class="text-[10px] font-semibold text-amber-400/80">Solo cortes en barbería</span>
                            </div>
                        </div>
                        <span class="material-symbols-outlined text-amber-400/70 text-base" style="font-variation-settings: 'FILL' 1" title="Solo atención presencial este día">store</span>
                    </div>
                </div>`;
            }

            return `
            <div class="barber-schedule-day" data-day="${key}">
                <div class="flex items-center justify-between">
                    <label class="flex items-center gap-3 cursor-pointer flex-1" onclick="barberManager.toggleDay('${key}')">
                        <div id="day-toggle-${key}" class="barber-day-toggle ${config.activo ? 'active' : ''}">
                            <div class="barber-day-toggle-dot"></div>
                        </div>
                        <span class="text-sm font-bold ${config.activo ? 'text-white' : 'text-white/40'}" id="day-label-${key}">${label}</span>
                    </label>
                    <div class="flex items-center gap-2 ${config.activo ? '' : 'opacity-30 pointer-events-none'}" id="day-times-${key}">
                        <input type="time" value="${config.desde}" id="time-from-${key}" class="barber-time-input">
                        <span class="text-white/30 text-xs font-bold">a</span>
                        <input type="time" value="${config.hasta}" id="time-to-${key}" class="barber-time-input">
                    </div>
                </div>
            </div>`;
        }).join('');

        const currentNivel = barberData?.nivel || '';
        const currentPrecio = barberData?.corte?.precio || '';

        const modalHTML = `
        <div id="barber-modal-overlay" class="barber-modal-overlay">
            <div class="barber-modal">
                <div class="barber-modal-header">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                            <span class="material-symbols-outlined text-primary text-xl" style="font-variation-settings: 'FILL' 1">${isEditing ? 'edit' : 'person_add'}</span>
                        </div>
                        <div>
                            <h2 class="text-lg font-black text-white">${title}</h2>
                            <p class="text-white/40 text-xs">Completa la información del barbero</p>
                        </div>
                    </div>
                    <button onclick="barberManager.confirmCancel()" class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/30 transition-all active:scale-90">
                        <span class="material-symbols-outlined text-white/60 text-lg hover:text-red-400">close</span>
                    </button>
                </div>

                <div class="barber-modal-body">
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">person</span>
                            <span>Barbero</span>
                        </div>
                        <select id="barber-select-user" class="barber-form-select" ${isEditing ? 'disabled' : ''}>
                            <option value="">Seleccionar usuario...</option>
                            ${usersOptions}
                        </select>
                    </div>

                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">military_tech</span>
                            <span>Nivel</span>
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                            <button type="button" onclick="barberManager.selectNivel('Experto')" id="nivel-btn-Experto" class="barber-nivel-btn ${currentNivel === 'Experto' ? 'active-blue' : ''}">
                                <span class="material-symbols-outlined text-lg mb-1" style="font-variation-settings: 'FILL' 1">workspace_premium</span>
                                <span class="text-xs font-black uppercase tracking-wider">Experto</span>
                            </button>
                            <button type="button" onclick="barberManager.selectNivel('Profesional')" id="nivel-btn-Profesional" class="barber-nivel-btn ${currentNivel === 'Profesional' ? 'active-purple' : ''}">
                                <span class="material-symbols-outlined text-lg mb-1" style="font-variation-settings: 'FILL' 1">military_tech</span>
                                <span class="text-xs font-black uppercase tracking-wider">Profesional</span>
                            </button>
                            <button type="button" onclick="barberManager.selectNivel('Leyenda')" id="nivel-btn-Leyenda" class="barber-nivel-btn ${currentNivel === 'Leyenda' ? 'active-gold' : ''}">
                                <span class="material-symbols-outlined text-lg mb-1" style="font-variation-settings: 'FILL' 1">emoji_events</span>
                                <span class="text-xs font-black uppercase tracking-wider">Leyenda</span>
                            </button>
                        </div>
                    </div>

                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">content_cut</span>
                            <span>Corte</span>
                            <button type="button" onclick="barberManager.openGestionarServicios()" class="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-primary/30 transition-all text-white/40 hover:text-primary active:scale-95" title="Gestionar servicios">
                                <span class="material-symbols-outlined text-[12px]">settings</span>
                                <span class="text-[9px] font-bold uppercase">Gestionar</span>
                            </button>
                        </div>

                        <button type="button" onclick="barberManager.toggleServiciosPanel()" class="svc-toggle-btn mb-2" id="svc-toggle-btn">
                            <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1">checklist</span>
                            <span class="flex-1 text-left text-sm font-bold text-white/70">Servicios incluidos</span>
                            <span id="svc-count-badge" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">0</span>
                            <span class="material-symbols-outlined text-white/30 text-lg svc-toggle-arrow" id="svc-toggle-arrow">expand_more</span>
                        </button>

                        <div id="servicios-corte-panel" class="svc-panel collapsed">
                            <div id="servicios-corte-list" class="svc-chips-grid"></div>
                        </div>

                        <div class="relative mt-3">
                            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-black text-lg">$</div>
                            <input type="number" id="barber-corte-precio" placeholder="0.00" step="0.01" min="0" value="${currentPrecio}" class="barber-form-input pl-8">
                            <div class="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold">PRECIO</div>
                        </div>
                    </div>

                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">add_circle</span>
                            <span>Adicionales</span>
                            <button type="button" onclick="barberManager.openGestionarAdicionales()" class="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-primary/30 transition-all text-white/40 hover:text-primary active:scale-95" title="Gestionar adicionales">
                                <span class="material-symbols-outlined text-[12px]">settings</span>
                                <span class="text-[9px] font-bold uppercase">Gestionar</span>
                            </button>
                        </div>

                        <button type="button" onclick="barberManager.toggleAdicionalesPanel()" class="svc-toggle-btn mb-2" id="adic-toggle-btn">
                            <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1">spa</span>
                            <span class="flex-1 text-left text-sm font-bold text-white/70">Servicios adicionales</span>
                            <span id="adic-count-badge" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25" style="display:none">0</span>
                            <span class="material-symbols-outlined text-white/30 text-lg svc-toggle-arrow" id="adic-toggle-arrow">expand_more</span>
                        </button>

                        <div id="adicionales-panel" class="svc-panel collapsed">
                            <div id="adicionales-list" class="space-y-2"></div>
                        </div>
                    </div>

                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">schedule</span>
                            <span>Horario</span>
                        </div>
                        <div class="barber-schedule-container">
                            ${horarioHTML}
                        </div>
                    </div>
                </div>

                <div class="barber-modal-footer">
                    <button onclick="barberManager.confirmCancel()" class="flex-1 px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Cancelar
                    </button>
                    <button onclick="barberManager.handleSubmit()" class="flex-[2] px-5 py-3.5 rounded-xl bg-primary text-black text-sm font-black uppercase tracking-wider shadow-[0_4px_20px_rgba(201,167,74,0.3)] hover:bg-yellow-500 transition-all active:scale-[0.97]">
                        <span class="flex items-center justify-center gap-2">
                            <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1">${isEditing ? 'save' : 'person_add'}</span>
                            ${submitText}
                        </span>
                    </button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const selectedSvcIds = barberData?.corte?.servicios?.map(s => s.id || s.nombre) || [];
        this.renderServiciosInModal(selectedSvcIds);

        const barberAdicionales = barberData?.adicionales || [];
        this.renderAdicionalesInModal(barberAdicionales);

        requestAnimationFrame(() => {
            document.getElementById('barber-modal-overlay')?.classList.add('visible');
        });
    };

    BarberManager.prototype.selectNivel = function (nivel) {
        document.querySelectorAll('.barber-nivel-btn').forEach(btn => {
            btn.className = 'barber-nivel-btn';
        });
        const btn = document.getElementById(`nivel-btn-${nivel}`);
        if (btn) btn.classList.add(NIVEL_ACTIVE_CLASS[nivel] || 'active-blue');
    };

    BarberManager.prototype.toggleDay = function (day) {
        const toggle = document.getElementById(`day-toggle-${day}`);
        const times = document.getElementById(`day-times-${day}`);
        const label = document.getElementById(`day-label-${day}`);
        if (!toggle || !times || !label) return;

        const isActive = toggle.classList.contains('active');
        if (isActive) {
            toggle.classList.remove('active');
            times.classList.add('opacity-30', 'pointer-events-none');
            label.classList.remove('text-white');
            label.classList.add('text-white/40');
        } else {
            toggle.classList.add('active');
            times.classList.remove('opacity-30', 'pointer-events-none');
            label.classList.add('text-white');
            label.classList.remove('text-white/40');
        }
    };

    BarberManager.prototype.forceCloseModal = function () {
        const overlay = document.getElementById('barber-modal-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
        this.editingBarberId = null;
    };

    BarberManager.prototype.confirmCancel = function () {
        const existing = document.getElementById('barber-cancel-overlay');
        if (existing) existing.remove();

        const html = `
        <div id="barber-cancel-overlay" class="barber-modal-overlay" style="z-index:150">
            <div class="barber-confirm-dialog">
                <div class="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                    <span class="material-symbols-outlined text-primary text-3xl" style="font-variation-settings: 'FILL' 1">edit_off</span>
                </div>
                <h3 class="text-white font-black text-lg text-center mb-2">¿Descartar cambios?</h3>
                <p class="text-white/50 text-sm text-center mb-6">Si sales ahora, perderás toda la información que ingresaste en el formulario.</p>
                <div class="flex gap-3">
                    <button onclick="barberManager.closeCancelDialog()" class="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Seguir editando
                    </button>
                    <button onclick="barberManager.executeCancelAndClose()" class="flex-1 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-black uppercase tracking-wide hover:bg-red-500/30 transition-all active:scale-[0.97]">
                        Descartar
                    </button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => {
            document.getElementById('barber-cancel-overlay')?.classList.add('visible');
        });
    };

    BarberManager.prototype.closeCancelDialog = function () {
        const overlay = document.getElementById('barber-cancel-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
    };

    BarberManager.prototype.executeCancelAndClose = function () {
        this.closeCancelDialog();
        setTimeout(() => {
            this.forceCloseModal();
            this.showToast('Formulario descartado', 'info');
        }, 150);
    };

    BarberManager.prototype.handleSubmit = async function () {
        const userSelect = document.getElementById('barber-select-user');
        const precioInput = document.getElementById('barber-corte-precio');

        const userId = userSelect?.value;
        if (!userId && !this.editingBarberId) {
            this.showToast('Selecciona un usuario', 'error');
            userSelect?.focus();
            return;
        }

        let userName = '', userPhoto = '', userEmail = '';
        if (userId) {
            const selectedOption = userSelect?.selectedOptions?.[0];
            userName = selectedOption?.getAttribute('data-name') || '';
            userPhoto = selectedOption?.getAttribute('data-photo') || '';
            const user = this.allUsers.find(u => u.uid === userId);
            userEmail = user?.email || '';
        }

        const activeNivelBtn = document.querySelector('.barber-nivel-btn[class*="active-"]');
        const nivel = activeNivelBtn ? activeNivelBtn.id.replace('nivel-btn-', '') : '';
        if (!nivel) {
            this.showToast('Selecciona un nivel', 'error');
            return;
        }

        const precio = parseFloat(precioInput?.value) || 0;
        if (!precio || precio <= 0) {
            this.showToast('Ingresa el precio del corte', 'error');
            precioInput?.focus();
            return;
        }

        const horario = {};
        DIAS.forEach(dia => {
            // Domingo siempre bloqueado (solo cortes presenciales en barbería)
            if (dia === 'domingo') {
                horario[dia] = { activo: false, desde: '09:00', hasta: '18:00' };
                return;
            }
            const toggle = document.getElementById(`day-toggle-${dia}`);
            const from = document.getElementById(`time-from-${dia}`);
            const to = document.getElementById(`time-to-${dia}`);
            horario[dia] = {
                activo: toggle ? toggle.classList.contains('active') : false,
                desde: from?.value || '09:00',
                hasta: to?.value || '18:00',
            };
        });

        const diasActivos = Object.values(horario).filter(d => d.activo).length;
        if (diasActivos === 0) {
            this.showToast('Selecciona al menos un día de trabajo', 'error');
            return;
        }

        const serviciosSeleccionados = this.getSelectedServicios();
        const adicionalesSeleccionados = this.getSelectedAdicionales();
        const currentBarber = this.editingBarberId ? this.barbers.find(b => b.id === this.editingBarberId) : null;

        const barberData = {
            userId: userId || currentBarber?.userId || '',
            userName: userName || currentBarber?.userName || '',
            userPhoto: userPhoto || currentBarber?.userPhoto || '',
            userEmail: userEmail || currentBarber?.userEmail || '',
            nivel,
            corte: { servicios: serviciosSeleccionados, precio },
            adicionales: adicionalesSeleccionados,
            horario,
        };

        const submitBtn = document.querySelector('.barber-modal-footer button:last-child');
        const originalHTML = submitBtn?.innerHTML;
        if (submitBtn) {
            submitBtn.innerHTML = '<div class="auth-checking-spinner" style="width:1.2rem;height:1.2rem;border-width:2px;margin:0 auto"></div>';
            submitBtn.disabled = true;
        }

        const success = this.editingBarberId
            ? await this.updateBarber(this.editingBarberId, barberData)
            : await this.saveBarber(barberData);

        if (success) {
            this.showToast(this.editingBarberId ? 'Barbero actualizado ✓' : 'Barbero agregado ✓', 'success');
            this.forceCloseModal();
        } else {
            this.showToast('Error al guardar', 'error');
            if (submitBtn) {
                submitBtn.innerHTML = originalHTML;
                submitBtn.disabled = false;
            }
        }
    };

    console.log('✓ admin/barber-modal-ui loaded');
})();
