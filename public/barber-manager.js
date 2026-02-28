/**
 * LEGENDS BARBERIA - BARBER MANAGER
 * Sistema completo de gestión de barberos con Firebase/Firestore
 * CRUD: Crear, Leer, Actualizar, Eliminar barberos
 */

class BarberManager {
    constructor() {
        this.barbers = [];
        this.allUsers = [];
        this.serviciosCorte = []; // Servicios globales del corte
        this.adicionalesGlobal = []; // Adicionales globales
        this.editingBarberId = null;
        this.initialized = false;
    }

    // =============================================
    // INICIALIZACIÓN
    // =============================================

    async init() {
        console.log('🔧 Inicializando BarberManager...');
        this.initialized = true;
        await Promise.all([this.loadServiciosCorte(), this.loadAdicionales()]);
        await this.loadBarbers();
    }

    // =============================================
    // FIRESTORE CRUD
    // =============================================

    /** Cargar todos los barberos desde Firestore */
    async loadBarbers() {
        const listContainer = document.getElementById('admin-barbers-list');
        if (!listContainer) return;

        // Mostrar loading
        listContainer.innerHTML = `
            <div class="flex flex-col items-center gap-3 py-12">
                <div class="auth-checking-spinner"></div>
                <p class="text-white/50 text-sm">Cargando barberos...</p>
            </div>
        `;

        try {
            if (!firebaseAdapter || !firebaseAdapter.db) {
                this.barbers = [];
                this.renderBarbersList();
                return;
            }

            const snapshot = await firebaseAdapter.db.collection('barberos').get();
            this.barbers = [];
            snapshot.forEach(doc => {
                this.barbers.push({ id: doc.id, ...doc.data() });
            });

            console.log(`✓ ${this.barbers.length} barberos cargados`);
            this.renderBarbersList();
        } catch (error) {
            console.error('❌ Error cargando barberos:', error);
            listContainer.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined text-red-400 text-5xl mb-3">error</span>
                    <p class="text-white/60 text-sm">Error cargando barberos</p>
                    <button onclick="barberManager.loadBarbers()" 
                        class="mt-4 px-5 py-2 bg-primary/20 text-primary text-xs font-bold rounded-lg border border-primary/30">
                        Reintentar
                    </button>
                </div>
            `;
        }
    }

    /** Guardar nuevo barbero en Firestore */
    async saveBarber(data) {
        try {
            if (!firebaseAdapter || !firebaseAdapter.db) {
                console.error('❌ Firebase no disponible');
                return false;
            }

            const barberData = {
                ...data,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await firebaseAdapter.db.collection('barberos').add(barberData);
            console.log('✓ Barbero guardado en Firestore');

            // Actualizar rol del usuario a 'barbero' en la colección users
            if (data.userId) {
                await firebaseAdapter.setUserRole(data.userId, 'barbero');
                console.log('✓ Rol actualizado a barbero');
            }

            await this.loadBarbers();
            return true;
        } catch (error) {
            console.error('❌ Error guardando barbero:', error);
            return false;
        }
    }

    /** Actualizar barbero existente en Firestore */
    async updateBarber(id, data) {
        try {
            if (!firebaseAdapter || !firebaseAdapter.db) return false;

            data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            await firebaseAdapter.db.collection('barberos').doc(id).update(data);
            console.log('✓ Barbero actualizado');
            await this.loadBarbers();
            return true;
        } catch (error) {
            console.error('❌ Error actualizando barbero:', error);
            return false;
        }
    }

    /** Eliminar barbero de Firestore */
    async deleteBarber(id) {
        try {
            if (!firebaseAdapter || !firebaseAdapter.db) return false;

            // Obtener userId antes de eliminar para revertir rol
            const barber = this.barbers.find(b => b.id === id);
            const userId = barber?.userId;

            await firebaseAdapter.db.collection('barberos').doc(id).delete();
            console.log('✓ Barbero eliminado');

            // Revertir rol del usuario a 'cliente'
            if (userId) {
                await firebaseAdapter.setUserRole(userId, 'cliente');
                console.log('✓ Rol revertido a cliente');
            }

            await this.loadBarbers();
            return true;
        } catch (error) {
            console.error('❌ Error eliminando barbero:', error);
            return false;
        }
    }

    // =============================================
    // CARGAR USUARIOS PARA EL SELECTOR
    // =============================================

    async loadUsers() {
        try {
            if (!firebaseAdapter || !firebaseAdapter.db) {
                this.allUsers = [];
                return;
            }
            this.allUsers = await firebaseAdapter.getAllUsers();
        } catch (error) {
            console.error('❌ Error cargando usuarios:', error);
            this.allUsers = [];
        }
    }

    // =============================================
    // SERVICIOS DEL CORTE - COLECCIÓN GLOBAL
    // =============================================

    /** Servicios predeterminados */
    getDefaultServicios() {
        return [
            { nombre: 'Asesoramiento de Imagen', descripcion: '' },
            { nombre: 'Perfilación de Cejas', descripcion: '' },
            { nombre: 'Mascarilla de Carbón', descripcion: '' },
            { nombre: 'Limpieza Facial', descripcion: '' },
            { nombre: 'Masaje Lavado', descripcion: '' },
            { nombre: 'Peinado', descripcion: '' },
            { nombre: 'Cóctel', descripcion: '' },
            { nombre: 'Café', descripcion: '' }
        ];
    }

    /** Cargar servicios globales desde Firestore */
    async loadServiciosCorte() {
        try {
            if (!firebaseAdapter || !firebaseAdapter.db) {
                this.serviciosCorte = this.getDefaultServicios();
                return;
            }

            const snapshot = await firebaseAdapter.db.collection('servicios_corte').orderBy('orden', 'asc').get();

            if (snapshot.empty) {
                // Crear servicios por defecto si no existen
                console.log('⚙ Creando servicios predeterminados...');
                const defaults = this.getDefaultServicios();
                const batch = firebaseAdapter.db.batch();
                defaults.forEach((s, i) => {
                    const ref = firebaseAdapter.db.collection('servicios_corte').doc();
                    batch.set(ref, { ...s, orden: i, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                });
                await batch.commit();
                // Recargar
                return await this.loadServiciosCorte();
            }

            this.serviciosCorte = [];
            snapshot.forEach(doc => {
                this.serviciosCorte.push({ id: doc.id, ...doc.data() });
            });
            console.log(`✓ ${this.serviciosCorte.length} servicios del corte cargados`);
        } catch (error) {
            console.error('❌ Error cargando servicios:', error);
            this.serviciosCorte = this.getDefaultServicios();
        }
    }

    /** Agregar un servicio global nuevo */
    async addServicioCorte(nombre) {
        if (!nombre || !nombre.trim()) return false;
        try {
            if (!firebaseAdapter || !firebaseAdapter.db) return false;
            await firebaseAdapter.db.collection('servicios_corte').add({
                nombre: nombre.trim(),
                descripcion: '',
                orden: this.serviciosCorte.length,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await this.loadServiciosCorte();
            return true;
        } catch (error) {
            console.error('❌ Error agregando servicio:', error);
            return false;
        }
    }

    /** Eliminar un servicio global */
    async deleteServicioCorte(id) {
        try {
            if (!firebaseAdapter || !firebaseAdapter.db) return false;
            await firebaseAdapter.db.collection('servicios_corte').doc(id).delete();
            await this.loadServiciosCorte();
            return true;
        } catch (error) {
            console.error('❌ Error eliminando servicio:', error);
            return false;
        }
    }

    /** Actualizar descripción de un servicio */
    async updateServicioDescripcion(id, descripcion) {
        try {
            if (!firebaseAdapter || !firebaseAdapter.db) return false;
            await firebaseAdapter.db.collection('servicios_corte').doc(id).update({ descripcion });
            const svc = this.serviciosCorte.find(s => s.id === id);
            if (svc) svc.descripcion = descripcion;
            return true;
        } catch (error) {
            console.error('❌ Error actualizando descripción:', error);
            return false;
        }
    }

    /** Renderizar la lista de servicios en el formulario del barbero */
    renderServiciosInModal(selectedIds = []) {
        const container = document.getElementById('servicios-corte-list');
        if (!container) return;

        if (this.serviciosCorte.length === 0) {
            container.innerHTML = '<p class="text-white/30 text-xs text-center py-4">No hay servicios configurados</p>';
            return;
        }

        container.innerHTML = this.serviciosCorte.map(svc => {
            const isSelected = selectedIds.includes(svc.id || svc.nombre);
            const svcId = svc.id || svc.nombre;
            return `
            <div class="svc-chip ${isSelected ? 'active' : ''}" 
                 id="svc-chip-${svcId}" 
                 onclick="barberManager.toggleServicio('${svcId}')">
                <div class="svc-chip-check">
                    <span class="material-symbols-outlined text-[12px]" 
                        style="font-variation-settings: 'FILL' 1">check</span>
                </div>
                <span class="svc-chip-name">${svc.nombre}</span>
                <button class="svc-chip-desc-btn" onclick="event.stopPropagation(); barberManager.openDescripcionEditor('${svcId}', '${(svc.nombre || '').replace(/'/g, "\\'")}')"
                    title="${svc.descripcion ? 'Editar descripción' : 'Agregar descripción'}">
                    <span class="material-symbols-outlined text-[14px]" 
                        style="font-variation-settings: 'FILL' ${svc.descripcion ? 1 : 0}">
                        ${svc.descripcion ? 'description' : 'note_add'}
                    </span>
                </button>
            </div>`;
        }).join('');

        // Actualizar badge de conteo
        setTimeout(() => {
            this.updateSvcCountBadge();
            // Si hay seleccionados, abrir el panel automáticamente
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
    }

    toggleServicio(svcId) {
        const chip = document.getElementById(`svc-chip-${svcId}`);
        if (chip) chip.classList.toggle('active');
        this.updateSvcCountBadge();
    }

    updateSvcCountBadge() {
        const count = document.querySelectorAll('.svc-chip.active').length;
        const badge = document.getElementById('svc-count-badge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? '' : 'none';
        }
    }

    toggleServiciosPanel() {
        const panel = document.getElementById('servicios-corte-panel');
        const arrow = document.getElementById('svc-toggle-arrow');
        if (!panel) return;

        const isCollapsed = panel.classList.contains('collapsed');
        if (isCollapsed) {
            panel.classList.remove('collapsed');
            panel.style.maxHeight = panel.scrollHeight + 'px';
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        } else {
            panel.style.maxHeight = '0px';
            panel.classList.add('collapsed');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        }
    }

    getSelectedServicios() {
        const chips = document.querySelectorAll('.svc-chip.active');
        return Array.from(chips).map(chip => {
            const id = chip.id.replace('svc-chip-', '');
            const svc = this.serviciosCorte.find(s => (s.id || s.nombre) === id);
            return svc ? { id: svc.id || svc.nombre, nombre: svc.nombre } : null;
        }).filter(Boolean);
    }

    /** Abrir editor de descripción para un servicio */
    openDescripcionEditor(svcId, nombre) {
        const svc = this.serviciosCorte.find(s => (s.id || s.nombre) === svcId);
        const currentDesc = svc?.descripcion || '';

        const existingEditor = document.getElementById('svc-desc-overlay');
        if (existingEditor) existingEditor.remove();

        const editorHTML = `
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
                    <button onclick="barberManager.closeDescEditor()" 
                        class="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Cancelar
                    </button>
                    <button onclick="barberManager.saveDescripcion('${svcId}')" 
                        class="flex-1 px-4 py-2.5 rounded-xl bg-primary text-black text-xs font-black uppercase tracking-wider hover:bg-yellow-500 transition-all active:scale-[0.97]">
                        Guardar
                    </button>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', editorHTML);
        requestAnimationFrame(() => {
            document.getElementById('svc-desc-overlay')?.classList.add('visible');
            document.getElementById('svc-desc-textarea')?.focus();
        });
    }

    closeDescEditor() {
        const overlay = document.getElementById('svc-desc-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
    }

    async saveDescripcion(svcId) {
        const textarea = document.getElementById('svc-desc-textarea');
        const desc = textarea?.value || '';
        const success = await this.updateServicioDescripcion(svcId, desc);
        this.closeDescEditor();
        if (success) {
            this.showToast('Descripción guardada ✓', 'success');
            // Actualizar el ícono del chip
            const btn = document.querySelector(`#svc-chip-${svcId} .svc-chip-desc-btn .material-symbols-outlined`);
            if (btn) {
                btn.textContent = desc ? 'description' : 'note_add';
                btn.style.fontVariationSettings = `'FILL' ${desc ? 1 : 0}`;
            }
        }
    }

    /** Modal para gestionar servicios globales (agregar/eliminar) */
    openGestionarServicios() {
        const existingModal = document.getElementById('svc-manage-overlay');
        if (existingModal) existingModal.remove();

        const serviciosListHTML = this.serviciosCorte.map(svc => `
            <div class="flex items-center gap-3 p-2.5 rounded-xl bg-white/3 hover:bg-white/5 transition-colors group">
                <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1">spa</span>
                <span class="flex-1 text-white text-sm font-semibold">${svc.nombre}</span>
                ${svc.descripcion ? '<span class="material-symbols-outlined text-white/20 text-sm" style="font-variation-settings: \'FILL\' 1">description</span>' : ''}
                <button onclick="barberManager.confirmDeleteServicio('${svc.id}', '${(svc.nombre || '').replace(/'/g, "\\\'")}')" 
                    class="w-7 h-7 rounded-lg bg-transparent hover:bg-red-500/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                    <span class="material-symbols-outlined text-red-400 text-sm">close</span>
                </button>
            </div>
        `).join('');

        const modalHTML = `
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

                <!-- Lista de servicios existentes -->
                <div id="svc-manage-list" class="space-y-1 mb-4 max-h-48 overflow-y-auto" style="scrollbar-width:none">
                    ${serviciosListHTML}
                </div>

                <!-- Agregar nuevo -->
                <div class="flex gap-2 mb-4">
                    <input type="text" id="svc-new-name" 
                        class="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium outline-none focus:border-primary/50 transition-colors placeholder:text-white/20"
                        placeholder="Nombre del nuevo servicio...">
                    <button onclick="barberManager.handleAddServicio()" 
                        class="px-4 py-2.5 rounded-xl bg-primary text-black text-xs font-black uppercase hover:bg-yellow-500 transition-all active:scale-[0.97]">
                        <span class="material-symbols-outlined text-base">add</span>
                    </button>
                </div>

                <button onclick="barberManager.closeGestionarServicios()" 
                    class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                    Cerrar
                </button>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        requestAnimationFrame(() => {
            document.getElementById('svc-manage-overlay')?.classList.add('visible');
        });
    }

    async handleAddServicio() {
        const input = document.getElementById('svc-new-name');
        const nombre = input?.value?.trim();
        if (!nombre) {
            this.showToast('Escribe un nombre', 'error');
            input?.focus();
            return;
        }
        // Verificar duplicado
        if (this.serviciosCorte.some(s => s.nombre.toLowerCase() === nombre.toLowerCase())) {
            this.showToast('Ese servicio ya existe', 'error');
            return;
        }
        const success = await this.addServicioCorte(nombre);
        if (success) {
            this.showToast(`"${nombre}" agregado ✓`, 'success');
            this.closeGestionarServicios();
            // Refrescar la lista en el modal del barbero si está abierto
            const selectedIds = this.getSelectedServicios().map(s => s.id);
            this.renderServiciosInModal(selectedIds);
            // Reabrir gestionar para ver actualizado
            this.openGestionarServicios();
        }
    }

    async confirmDeleteServicio(id, nombre) {
        if (confirm(`¿Eliminar el servicio "${nombre}"? Se quitará de todos los barberos.`)) {
            const success = await this.deleteServicioCorte(id);
            if (success) {
                this.showToast(`"${nombre}" eliminado`, 'success');
                this.closeGestionarServicios();
                const selectedIds = this.getSelectedServicios().map(s => s.id);
                this.renderServiciosInModal(selectedIds);
                this.openGestionarServicios();
            }
        }
    }

    closeGestionarServicios() {
        const overlay = document.getElementById('svc-manage-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
    }

    // =============================================
    // RENDERIZADO DE LISTA DE BARBEROS
    // =============================================

    renderBarbersList() {
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

        // Renderizar tarjetas
        listContainer.innerHTML = this.barbers.map((barber, index) =>
            this.renderBarberCard(barber, index)
        ).join('');
    }

    renderBarberCard(barber, index) {
        const nivelColors = {
            'Experto': { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', icon: 'workspace_premium' },
            'Profesional': { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', icon: 'military_tech' },
            'Leyenda': { bg: 'bg-primary/15', text: 'text-primary', border: 'border-primary/30', icon: 'emoji_events' }
        };

        const nivel = nivelColors[barber.nivel] || nivelColors['Experto'];

        // Construir horario visual
        const diasLabels = { lunes: 'L', martes: 'M', miercoles: 'X', jueves: 'J', viernes: 'V', sabado: 'S', domingo: 'D' };
        const diasOrden = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

        const horarioHTML = diasOrden.map(dia => {
            const config = barber.horario?.[dia];
            const activo = config?.activo;
            return `<div class="flex flex-col items-center gap-0.5">
                <span class="text-[9px] font-black uppercase ${activo ? 'text-primary' : 'text-white/20'}">${diasLabels[dia]}</span>
                <div class="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold
                    ${activo ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-white/5 text-white/15 border border-white/5'}">
                    ${activo ? '✓' : '—'}
                </div>
            </div>`;
        }).join('');

        // Obtener horario de ejemplo del primer día activo
        const primerDiaActivo = diasOrden.find(d => barber.horario?.[d]?.activo);
        const horarioTexto = primerDiaActivo
            ? `${barber.horario[primerDiaActivo].desde} - ${barber.horario[primerDiaActivo].hasta}`
            : 'Sin horario';

        const photoSrc = barber.userPhoto
            ? barber.userPhoto
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(barber.userName || 'B')}&background=c9a74a&color=000&bold=true`;

        return `
        <div class="barber-card" style="animation-delay: ${index * 0.08}s">
            <div class="barber-card-inner">
                <!-- Header del Barbero -->
                <div class="flex items-center gap-4 mb-4">
                    <div class="relative">
                        <div class="w-16 h-16 rounded-2xl overflow-hidden border-2 border-primary/30 shadow-[0_0_15px_rgba(201,167,74,0.2)]">
                            <img src="${photoSrc}" alt="${barber.userName}" 
                                class="w-full h-full object-cover">
                        </div>
                        <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${nivel.bg} ${nivel.border} border flex items-center justify-center">
                            <span class="material-symbols-outlined ${nivel.text} text-[10px]" 
                                style="font-variation-settings: 'FILL' 1">${nivel.icon}</span>
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
                        <button onclick="barberManager.confirmDeleteBarber('${barber.id}', '${(barber.userName || '').replace(/'/g, "\\'")}')" 
                            class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:border-red-500/40 hover:bg-red-500/10 transition-all active:scale-90" title="Eliminar">
                            <span class="material-symbols-outlined text-white/60 text-lg hover:text-red-400">delete</span>
                        </button>
                    </div>
                </div>

                <!-- Info Grid -->
                <div class="grid grid-cols-2 gap-2.5 mb-4">
                    <div class="barber-info-chip">
                        <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">content_cut</span>
                        <div>
                            <p class="text-[9px] text-white/40 font-bold uppercase tracking-wider">Corte</p>
                            <p class="text-sm font-black text-primary">$${(barber.corte?.precio || 0).toFixed(2)}</p>
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

                <!-- Días de la semana -->
                <div class="flex items-center justify-between px-1 pt-3 border-t border-white/5">
                    ${horarioHTML}
                </div>
            </div>
        </div>
        `;
    }

    // =============================================
    // MODAL - AGREGAR / EDITAR BARBERO
    // =============================================

    async openAddBarberModal() {
        this.editingBarberId = null;
        await Promise.all([this.loadUsers(), this.loadServiciosCorte(), this.loadAdicionales()]);
        this.showModal(null);
    }

    async openEditBarberModal(id) {
        this.editingBarberId = id;
        await Promise.all([this.loadUsers(), this.loadServiciosCorte(), this.loadAdicionales()]);
        const barber = this.barbers.find(b => b.id === id);
        if (!barber) {
            console.error('Barbero no encontrado:', id);
            return;
        }
        this.showModal(barber);
    }

    showModal(barberData) {
        // Eliminar modal existente
        const existingModal = document.getElementById('barber-modal-overlay');
        if (existingModal) existingModal.remove();

        const isEditing = barberData !== null;
        const title = isEditing ? 'Editar Barbero' : 'Agregar Nuevo Barbero';
        const submitText = isEditing ? 'Guardar Cambios' : 'Agregar Barbero';

        // Generar opciones de usuarios (excluir admin Y usuarios que ya son barberos)
        const barberUserIds = this.barbers.map(b => b.userId);
        const usersOptions = this.allUsers
            .filter(u => u.role !== 'admin')
            .filter(u => {
                // En edición, sí mostrar el barbero actual
                if (barberData && barberData.userId === u.uid) return true;
                // Excluir los que ya son barberos
                return !barberUserIds.includes(u.uid);
            })
            .map(u => {
                const selected = barberData && barberData.userId === u.uid ? 'selected' : '';
                return `<option value="${u.uid}" data-name="${u.displayName || u.email}" data-photo="${u.photoURL || ''}" ${selected}>
                    ${u.displayName || u.email || u.uid}
                </option>`;
            }).join('');

        // Generar horario
        const diasNombres = {
            lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
            jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo'
        };

        const horarioHTML = Object.entries(diasNombres).map(([key, label]) => {
            const config = barberData?.horario?.[key] || { activo: false, desde: '09:00', hasta: '18:00' };
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
                        <input type="time" value="${config.desde}" id="time-from-${key}" 
                            class="barber-time-input">
                        <span class="text-white/30 text-xs font-bold">a</span>
                        <input type="time" value="${config.hasta}" id="time-to-${key}" 
                            class="barber-time-input">
                    </div>
                </div>
            </div>
            `;
        }).join('');

        // Nivel actual
        const currentNivel = barberData?.nivel || '';

        // Precio actual
        const currentPrecio = barberData?.corte?.precio || '';

        const modalHTML = `
        <div id="barber-modal-overlay" class="barber-modal-overlay">
            <div class="barber-modal">
                <!-- Modal Header -->
                <div class="barber-modal-header">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                            <span class="material-symbols-outlined text-primary text-xl" 
                                style="font-variation-settings: 'FILL' 1">${isEditing ? 'edit' : 'person_add'}</span>
                        </div>
                        <div>
                            <h2 class="text-lg font-black text-white">${title}</h2>
                            <p class="text-white/40 text-xs">Completa la información del barbero</p>
                        </div>
                    </div>
                    <button onclick="barberManager.confirmCancel()" 
                        class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/30 transition-all active:scale-90">
                        <span class="material-symbols-outlined text-white/60 text-lg hover:text-red-400">close</span>
                    </button>
                </div>

                <!-- Modal Body - Scrollable -->
                <div class="barber-modal-body">
                    <!-- 1. SELECCIÓN DE BARBERO -->
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

                    <!-- 2. NIVEL -->
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">military_tech</span>
                            <span>Nivel</span>
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                            <button type="button" onclick="barberManager.selectNivel('Experto')" 
                                id="nivel-btn-Experto"
                                class="barber-nivel-btn ${currentNivel === 'Experto' ? 'active-blue' : ''}">
                                <span class="material-symbols-outlined text-lg mb-1" style="font-variation-settings: 'FILL' 1">workspace_premium</span>
                                <span class="text-xs font-black uppercase tracking-wider">Experto</span>
                            </button>
                            <button type="button" onclick="barberManager.selectNivel('Profesional')" 
                                id="nivel-btn-Profesional"
                                class="barber-nivel-btn ${currentNivel === 'Profesional' ? 'active-purple' : ''}">
                                <span class="material-symbols-outlined text-lg mb-1" style="font-variation-settings: 'FILL' 1">military_tech</span>
                                <span class="text-xs font-black uppercase tracking-wider">Profesional</span>
                            </button>
                            <button type="button" onclick="barberManager.selectNivel('Leyenda')" 
                                id="nivel-btn-Leyenda"
                                class="barber-nivel-btn ${currentNivel === 'Leyenda' ? 'active-gold' : ''}">
                                <span class="material-symbols-outlined text-lg mb-1" style="font-variation-settings: 'FILL' 1">emoji_events</span>
                                <span class="text-xs font-black uppercase tracking-wider">Leyenda</span>
                            </button>
                        </div>
                    </div>

                    <!-- 3. CORTE -->
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">content_cut</span>
                            <span>Corte</span>
                            <button type="button" onclick="barberManager.openGestionarServicios()" 
                                class="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-primary/30 transition-all text-white/40 hover:text-primary active:scale-95" title="Gestionar servicios">
                                <span class="material-symbols-outlined text-[12px]">settings</span>
                                <span class="text-[9px] font-bold uppercase">Gestionar</span>
                            </button>
                        </div>
                        
                        <!-- Botón desplegable de servicios -->
                        <button type="button" onclick="barberManager.toggleServiciosPanel()" 
                            class="svc-toggle-btn mb-2" id="svc-toggle-btn">
                            <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1">checklist</span>
                            <span class="flex-1 text-left text-sm font-bold text-white/70">Servicios incluidos</span>
                            <span id="svc-count-badge" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">0</span>
                            <span class="material-symbols-outlined text-white/30 text-lg svc-toggle-arrow" id="svc-toggle-arrow">expand_more</span>
                        </button>

                        <!-- Panel colapsable de servicios -->
                        <div id="servicios-corte-panel" class="svc-panel collapsed">
                            <div id="servicios-corte-list" class="svc-chips-grid">
                                <!-- Se llena dinámicamente -->
                            </div>
                        </div>

                        <!-- Precio del corte -->
                        <div class="relative mt-3">
                            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-black text-lg">$</div>
                            <input type="number" id="barber-corte-precio" 
                                placeholder="0.00" step="0.01" min="0"
                                value="${currentPrecio}"
                                class="barber-form-input pl-8">
                            <div class="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold">PRECIO</div>
                        </div>
                    </div>

                    <!-- 4. ADICIONALES -->
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">add_circle</span>
                            <span>Adicionales</span>
                            <button type="button" onclick="barberManager.openGestionarAdicionales()" 
                                class="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-primary/30 transition-all text-white/40 hover:text-primary active:scale-95" title="Gestionar adicionales">
                                <span class="material-symbols-outlined text-[12px]">settings</span>
                                <span class="text-[9px] font-bold uppercase">Gestionar</span>
                            </button>
                        </div>

                        <!-- Botón desplegable de adicionales -->
                        <button type="button" onclick="barberManager.toggleAdicionalesPanel()" 
                            class="svc-toggle-btn mb-2" id="adic-toggle-btn">
                            <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1">spa</span>
                            <span class="flex-1 text-left text-sm font-bold text-white/70">Servicios adicionales</span>
                            <span id="adic-count-badge" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25" style="display:none">0</span>
                            <span class="material-symbols-outlined text-white/30 text-lg svc-toggle-arrow" id="adic-toggle-arrow">expand_more</span>
                        </button>

                        <!-- Panel colapsable de adicionales -->
                        <div id="adicionales-panel" class="svc-panel collapsed">
                            <div id="adicionales-list" class="space-y-2">
                                <!-- Se llena dinámicamente -->
                            </div>
                        </div>
                    </div>

                    <!-- 5. HORARIO -->
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

                <!-- Modal Footer -->
                <div class="barber-modal-footer">
                    <button onclick="barberManager.confirmCancel()" 
                        class="flex-1 px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Cancelar
                    </button>
                    <button onclick="barberManager.handleSubmit()" 
                        class="flex-[2] px-5 py-3.5 rounded-xl bg-primary text-black text-sm font-black uppercase tracking-wider shadow-[0_4px_20px_rgba(201,167,74,0.3)] hover:bg-yellow-500 transition-all active:scale-[0.97]">
                        <span class="flex items-center justify-center gap-2">
                            <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1">${isEditing ? 'save' : 'person_add'}</span>
                            ${submitText}
                        </span>
                    </button>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Renderizar servicios del corte
        const selectedSvcIds = barberData?.corte?.servicios?.map(s => s.id || s.nombre) || [];
        this.renderServiciosInModal(selectedSvcIds);

        // Renderizar adicionales
        const barberAdicionales = barberData?.adicionales || [];
        this.renderAdicionalesInModal(barberAdicionales);

        // Animar entrada
        requestAnimationFrame(() => {
            const overlay = document.getElementById('barber-modal-overlay');
            if (overlay) overlay.classList.add('visible');
        });
    }

    // =============================================
    // INTERACCIONES DEL MODAL
    // =============================================

    selectNivel(nivel) {
        // Limpiar todos los botones
        document.querySelectorAll('.barber-nivel-btn').forEach(btn => {
            btn.className = 'barber-nivel-btn';
        });

        // Activar el seleccionado
        const btn = document.getElementById(`nivel-btn-${nivel}`);
        if (btn) {
            const colorClass = nivel === 'Experto' ? 'active-blue' : nivel === 'Profesional' ? 'active-purple' : 'active-gold';
            btn.classList.add(colorClass);
        }
    }

    toggleDay(day) {
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
    }

    /** Cierre forzado del modal (sin confirmación) */
    forceCloseModal() {
        const overlay = document.getElementById('barber-modal-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
        this.editingBarberId = null;
    }

    /** Confirmación elegante antes de cancelar */
    confirmCancel() {
        const existingConfirm = document.getElementById('barber-cancel-overlay');
        if (existingConfirm) existingConfirm.remove();

        const cancelHTML = `
        <div id="barber-cancel-overlay" class="barber-modal-overlay" style="z-index:150">
            <div class="barber-confirm-dialog">
                <div class="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                    <span class="material-symbols-outlined text-primary text-3xl" style="font-variation-settings: 'FILL' 1">edit_off</span>
                </div>
                <h3 class="text-white font-black text-lg text-center mb-2">¿Descartar cambios?</h3>
                <p class="text-white/50 text-sm text-center mb-6">Si sales ahora, perderás toda la información que ingresaste en el formulario.</p>
                <div class="flex gap-3">
                    <button onclick="barberManager.closeCancelDialog()" 
                        class="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Seguir editando
                    </button>
                    <button onclick="barberManager.executeCancelAndClose()" 
                        class="flex-1 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-black uppercase tracking-wide hover:bg-red-500/30 transition-all active:scale-[0.97]">
                        Descartar
                    </button>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', cancelHTML);
        requestAnimationFrame(() => {
            document.getElementById('barber-cancel-overlay')?.classList.add('visible');
        });
    }

    closeCancelDialog() {
        const overlay = document.getElementById('barber-cancel-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
    }

    executeCancelAndClose() {
        this.closeCancelDialog();
        setTimeout(() => {
            this.forceCloseModal();
            this.showToast('Formulario descartado', 'info');
        }, 150);
    }

    // =============================================
    // SUBMIT - GUARDAR / ACTUALIZAR
    // =============================================

    async handleSubmit() {
        // Recopilar datos
        const userSelect = document.getElementById('barber-select-user');
        const precioInput = document.getElementById('barber-corte-precio');

        // Validar usuario
        const userId = userSelect?.value;
        if (!userId && !this.editingBarberId) {
            this.showToast('Selecciona un usuario', 'error');
            userSelect?.focus();
            return;
        }

        // Obtener nombre y foto del usuario seleccionado
        let userName = '';
        let userPhoto = '';
        let userEmail = '';

        if (userId) {
            const selectedOption = userSelect?.selectedOptions?.[0];
            userName = selectedOption?.getAttribute('data-name') || '';
            userPhoto = selectedOption?.getAttribute('data-photo') || '';
            const user = this.allUsers.find(u => u.uid === userId);
            userEmail = user?.email || '';
        }

        // Obtener nivel seleccionado
        const activeNivelBtn = document.querySelector('.barber-nivel-btn[class*="active-"]');
        let nivel = '';
        if (activeNivelBtn) {
            const id = activeNivelBtn.id;
            nivel = id.replace('nivel-btn-', '');
        }

        if (!nivel) {
            this.showToast('Selecciona un nivel', 'error');
            return;
        }

        // Obtener precio
        const precio = parseFloat(precioInput?.value) || 0;

        // ===== VALIDACIONES =====
        if (!precio || precio <= 0) {
            this.showToast('Ingresa el precio del corte', 'error');
            precioInput?.focus();
            return;
        }

        // Validar que al menos un día esté activo
        const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
        const horario = {};
        dias.forEach(dia => {
            const toggle = document.getElementById(`day-toggle-${dia}`);
            const from = document.getElementById(`time-from-${dia}`);
            const to = document.getElementById(`time-to-${dia}`);

            horario[dia] = {
                activo: toggle ? toggle.classList.contains('active') : false,
                desde: from?.value || '09:00',
                hasta: to?.value || '18:00'
            };
        });

        const diasActivos = Object.values(horario).filter(d => d.activo).length;
        if (diasActivos === 0) {
            this.showToast('Selecciona al menos un día de trabajo', 'error');
            return;
        }

        // Obtener servicios seleccionados del corte
        const serviciosSeleccionados = this.getSelectedServicios();

        // Obtener adicionales seleccionados con precios
        const adicionalesSeleccionados = this.getSelectedAdicionales();

        // Construir objeto de datos
        const barberData = {
            userId: userId || (this.editingBarberId ? this.barbers.find(b => b.id === this.editingBarberId)?.userId : ''),
            userName: userName || (this.editingBarberId ? this.barbers.find(b => b.id === this.editingBarberId)?.userName : ''),
            userPhoto: userPhoto || (this.editingBarberId ? this.barbers.find(b => b.id === this.editingBarberId)?.userPhoto : ''),
            userEmail: userEmail || (this.editingBarberId ? this.barbers.find(b => b.id === this.editingBarberId)?.userEmail : ''),
            nivel,
            corte: {
                servicios: serviciosSeleccionados,
                precio
            },
            adicionales: adicionalesSeleccionados,
            horario
        };

        // Mostrar loading en botón
        const submitBtn = document.querySelector('.barber-modal-footer button:last-child');
        const originalHTML = submitBtn?.innerHTML;
        if (submitBtn) {
            submitBtn.innerHTML = '<div class="auth-checking-spinner" style="width:1.2rem;height:1.2rem;border-width:2px;margin:0 auto"></div>';
            submitBtn.disabled = true;
        }

        let success;
        if (this.editingBarberId) {
            success = await this.updateBarber(this.editingBarberId, barberData);
        } else {
            success = await this.saveBarber(barberData);
        }

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
    }

    // =============================================
    // CONFIRMAR ELIMINACIÓN
    // =============================================

    confirmDeleteBarber(id, name) {
        // Crear modal de confirmación
        const existingConfirm = document.getElementById('barber-confirm-overlay');
        if (existingConfirm) existingConfirm.remove();

        const confirmHTML = `
        <div id="barber-confirm-overlay" class="barber-modal-overlay" onclick="barberManager.closeConfirm(event)">
            <div class="barber-confirm-dialog" onclick="event.stopPropagation()">
                <div class="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                    <span class="material-symbols-outlined text-red-400 text-3xl">delete_forever</span>
                </div>
                <h3 class="text-white font-black text-lg text-center mb-2">¿Eliminar barbero?</h3>
                <p class="text-white/50 text-sm text-center mb-6">Se eliminará a <strong class="text-white">${name}</strong> y toda su información. Esta acción no se puede deshacer.</p>
                <div class="flex gap-3">
                    <button onclick="barberManager.closeConfirmDialog()" 
                        class="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Cancelar
                    </button>
                    <button onclick="barberManager.executeDelete('${id}')" 
                        class="flex-1 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-black uppercase tracking-wide hover:bg-red-500/30 transition-all active:scale-[0.97]">
                        Eliminar
                    </button>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', confirmHTML);
        requestAnimationFrame(() => {
            document.getElementById('barber-confirm-overlay')?.classList.add('visible');
        });
    }

    closeConfirm(event) {
        if (event.target.id === 'barber-confirm-overlay') {
            this.closeConfirmDialog();
        }
    }

    closeConfirmDialog() {
        const overlay = document.getElementById('barber-confirm-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
    }

    async executeDelete(id) {
        this.closeConfirmDialog();
        const success = await this.deleteBarber(id);
        if (success) {
            this.showToast('Barbero eliminado', 'success');
        } else {
            this.showToast('Error al eliminar', 'error');
        }
    }

    // =============================================
    // ADICIONALES - COLECCIÓN GLOBAL
    // =============================================

    getDefaultAdicionales() {
        return [
            { nombre: 'Ritual de Barba', descripcion: '', soloConCorte: false },
            { nombre: 'Limpieza Premium', descripcion: '', soloConCorte: false },
            { nombre: 'Corte de Dama', descripcion: '', soloConCorte: false },
            { nombre: 'Daniels', descripcion: '', soloConCorte: false },
            { nombre: 'Jose Cuervo', descripcion: '', soloConCorte: false },
            { nombre: 'Mascarilla Carbonatada Completa', descripcion: '', soloConCorte: false },
            { nombre: 'Mascarilla de Pepino', descripcion: '', soloConCorte: false },
            { nombre: 'Mascarilla de Realce Completo', descripcion: '', soloConCorte: false },
            { nombre: 'Mascarilla Led', descripcion: '', soloConCorte: false },
            { nombre: 'Limpieza Gold', descripcion: '', soloConCorte: false },
            { nombre: 'Cejas', descripcion: '', soloConCorte: false },
            { nombre: 'Experiencia Masajes', descripcion: '', soloConCorte: false }
        ];
    }

    async loadAdicionales() {
        try {
            if (!firebaseAdapter || !firebaseAdapter.db) {
                this.adicionalesGlobal = this.getDefaultAdicionales();
                return;
            }
            const snapshot = await firebaseAdapter.db.collection('adicionales').orderBy('orden', 'asc').get();
            if (snapshot.empty) {
                console.log('⚙ Creando adicionales predeterminados...');
                const defaults = this.getDefaultAdicionales();
                const batch = firebaseAdapter.db.batch();
                defaults.forEach((a, i) => {
                    const ref = firebaseAdapter.db.collection('adicionales').doc();
                    batch.set(ref, { ...a, orden: i, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                });
                await batch.commit();
                return await this.loadAdicionales();
            }
            this.adicionalesGlobal = [];
            snapshot.forEach(doc => {
                this.adicionalesGlobal.push({ id: doc.id, ...doc.data() });
            });
            console.log(`✓ ${this.adicionalesGlobal.length} adicionales cargados`);
        } catch (error) {
            console.error('❌ Error cargando adicionales:', error);
            this.adicionalesGlobal = this.getDefaultAdicionales();
        }
    }

    async addAdicional(nombre) {
        if (!nombre?.trim()) return false;
        try {
            if (!firebaseAdapter?.db) return false;
            await firebaseAdapter.db.collection('adicionales').add({
                nombre: nombre.trim(), descripcion: '', soloConCorte: false,
                orden: this.adicionalesGlobal.length,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await this.loadAdicionales();
            return true;
        } catch (e) { console.error(e); return false; }
    }

    async deleteAdicional(id) {
        try {
            if (!firebaseAdapter?.db) return false;
            await firebaseAdapter.db.collection('adicionales').doc(id).delete();
            await this.loadAdicionales();
            return true;
        } catch (e) { console.error(e); return false; }
    }

    async updateAdicionalDescripcion(id, descripcion) {
        try {
            if (!firebaseAdapter?.db) return false;
            await firebaseAdapter.db.collection('adicionales').doc(id).update({ descripcion });
            const a = this.adicionalesGlobal.find(x => x.id === id);
            if (a) a.descripcion = descripcion;
            return true;
        } catch (e) { console.error(e); return false; }
    }

    async toggleAdicionalSoloConCorte(id) {
        const a = this.adicionalesGlobal.find(x => x.id === id);
        if (!a) return;
        const newVal = !a.soloConCorte;
        try {
            if (!firebaseAdapter?.db) return;
            await firebaseAdapter.db.collection('adicionales').doc(id).update({ soloConCorte: newVal });
            a.soloConCorte = newVal;
            this.showToast(newVal ? 'Solo con corte ✓' : 'Disponible por separado ✓', 'info');
        } catch (e) { console.error(e); }
    }

    /** Renderizar adicionales en el modal del barbero */
    renderAdicionalesInModal(barberAdicionales = []) {
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

            return `
            <div class="adic-item ${isSelected ? 'active' : ''}" id="adic-item-${adic.id}">
                <div class="adic-item-header" onclick="barberManager.toggleAdicional('${adic.id}')">
                    <div class="svc-chip-check">
                        <span class="material-symbols-outlined text-[12px]" style="font-variation-settings: 'FILL' 1">check</span>
                    </div>
                    <span class="adic-item-name">${adic.nombre}</span>
                    ${adic.soloConCorte ? '<span class="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">Solo con corte</span>' : ''}
                    <button class="svc-chip-desc-btn" onclick="event.stopPropagation(); barberManager.openAdicDescEditor('${adic.id}', '${(adic.nombre || '').replace(/'/g, "\\\'")}')">
                        <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' ${adic.descripcion ? 1 : 0}">${adic.descripcion ? 'description' : 'note_add'}</span>
                    </button>
                </div>
                <div class="adic-prices ${isSelected ? '' : 'hidden'}" id="adic-prices-${adic.id}">
                    <div class="adic-price-field">
                        <span class="text-[9px] font-black uppercase text-white/35 tracking-wider">Con corte</span>
                        <div class="relative">
                            <span class="absolute left-2 top-1/2 -translate-y-1/2 text-primary text-xs font-black">$</span>
                            <input type="number" step="0.01" min="0" placeholder="0" 
                                value="${precioConCorte}" 
                                id="adic-precio-corte-${adic.id}"
                                class="adic-price-input" onclick="event.stopPropagation()">
                        </div>
                    </div>
                    ${!adic.soloConCorte ? `
                    <div class="adic-price-field">
                        <span class="text-[9px] font-black uppercase text-white/35 tracking-wider">Solo</span>
                        <div class="relative">
                            <span class="absolute left-2 top-1/2 -translate-y-1/2 text-primary text-xs font-black">$</span>
                            <input type="number" step="0.01" min="0" placeholder="0" 
                                value="${precioSolo}" 
                                id="adic-precio-solo-${adic.id}"
                                class="adic-price-input" onclick="event.stopPropagation()">
                        </div>
                    </div>` : ''}
                </div>
            </div>`;
        }).join('');

        setTimeout(() => this.updateAdicCountBadge(), 50);

        // Auto-abrir panel si hay seleccionados
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
    }

    toggleAdicional(adicId) {
        const item = document.getElementById(`adic-item-${adicId}`);
        const prices = document.getElementById(`adic-prices-${adicId}`);
        if (!item) return;
        const isActive = item.classList.contains('active');
        if (isActive) {
            item.classList.remove('active');
            prices?.classList.add('hidden');
        } else {
            item.classList.add('active');
            prices?.classList.remove('hidden');
        }
        this.updateAdicCountBadge();
        // Recalcular altura del panel
        setTimeout(() => {
            const panel = document.getElementById('adicionales-panel');
            if (panel && !panel.classList.contains('collapsed')) {
                panel.style.maxHeight = panel.scrollHeight + 'px';
            }
        }, 50);
    }

    updateAdicCountBadge() {
        const count = document.querySelectorAll('.adic-item.active').length;
        const badge = document.getElementById('adic-count-badge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? '' : 'none';
        }
    }

    toggleAdicionalesPanel() {
        const panel = document.getElementById('adicionales-panel');
        const arrow = document.getElementById('adic-toggle-arrow');
        if (!panel) return;
        const isCollapsed = panel.classList.contains('collapsed');
        if (isCollapsed) {
            panel.classList.remove('collapsed');
            panel.style.maxHeight = panel.scrollHeight + 'px';
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        } else {
            panel.style.maxHeight = '0px';
            panel.classList.add('collapsed');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        }
    }

    getSelectedAdicionales() {
        const items = document.querySelectorAll('.adic-item.active');
        return Array.from(items).map(item => {
            const id = item.id.replace('adic-item-', '');
            const adic = this.adicionalesGlobal.find(a => a.id === id);
            if (!adic) return null;
            const precioCorte = parseFloat(document.getElementById(`adic-precio-corte-${id}`)?.value) || 0;
            const precioSolo = parseFloat(document.getElementById(`adic-precio-solo-${id}`)?.value) || 0;
            return {
                id: adic.id,
                nombre: adic.nombre,
                soloConCorte: adic.soloConCorte || false,
                precioConCorte: precioCorte,
                precioSolo: adic.soloConCorte ? null : precioSolo
            };
        }).filter(Boolean);
    }

    /** Editor de descripción para adicional */
    openAdicDescEditor(adicId, nombre) {
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
                <textarea id="svc-desc-textarea" 
                    class="w-full h-24 p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium resize-none outline-none focus:border-primary/50 transition-colors placeholder:text-white/20"
                    placeholder="Describe en qué consiste...">${currentDesc}</textarea>
                <div class="flex gap-3 mt-4">
                    <button onclick="barberManager.closeDescEditor()" 
                        class="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-all active:scale-[0.97]">Cancelar</button>
                    <button onclick="barberManager.saveAdicDescripcion('${adicId}')" 
                        class="flex-1 px-4 py-2.5 rounded-xl bg-primary text-black text-xs font-black uppercase tracking-wider hover:bg-yellow-500 transition-all active:scale-[0.97]">Guardar</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => {
            document.getElementById('svc-desc-overlay')?.classList.add('visible');
            document.getElementById('svc-desc-textarea')?.focus();
        });
    }

    async saveAdicDescripcion(adicId) {
        const desc = document.getElementById('svc-desc-textarea')?.value || '';
        const success = await this.updateAdicionalDescripcion(adicId, desc);
        this.closeDescEditor();
        if (success) this.showToast('Descripción guardada ✓', 'success');
    }

    /** Gestionar adicionales globales */
    openGestionarAdicionales() {
        const existing = document.getElementById('svc-manage-overlay');
        if (existing) existing.remove();

        const listHTML = this.adicionalesGlobal.map(a => `
            <div class="flex items-center gap-2 p-2.5 rounded-xl bg-white/3 hover:bg-white/5 transition-colors group">
                <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">spa</span>
                <span class="flex-1 text-white text-xs font-semibold truncate">${a.nombre}</span>
                <button onclick="barberManager.toggleAdicionalSoloConCorte('${a.id}'); barberManager.closeGestionarAdicionales(); setTimeout(()=>barberManager.openGestionarAdicionales(),350)" 
                    class="text-[8px] font-black uppercase px-1.5 py-0.5 rounded border transition-all cursor-pointer ${a.soloConCorte ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' : 'bg-white/5 text-white/30 border-white/10 hover:border-primary/30'}">
                    ${a.soloConCorte ? '✓ Solo c/corte' : 'Individual'}
                </button>
                ${a.descripcion ? '<span class="material-symbols-outlined text-white/20 text-xs" style="font-variation-settings: \'FILL\' 1">description</span>' : ''}
                <button onclick="barberManager.confirmDeleteAdicional('${a.id}', '${(a.nombre || '').replace(/'/g, "\\\'")}')" 
                    class="w-6 h-6 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                    <span class="material-symbols-outlined text-red-400 text-sm">close</span>
                </button>
            </div>
        `).join('');

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
    }

    async handleAddAdicional() {
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
    }

    async confirmDeleteAdicional(id, nombre) {
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
    }

    closeGestionarAdicionales() {
        const overlay = document.getElementById('svc-manage-overlay');
        if (overlay) { overlay.classList.remove('visible'); setTimeout(() => overlay.remove(), 300); }
    }

    // =============================================
    // TOAST NOTIFICATIONS
    // =============================================

    showToast(message, type = 'success') {
        // type: success, error, info
        const existingToast = document.querySelector('.barber-toast');
        if (existingToast) existingToast.remove();

        const icons = { success: 'check_circle', error: 'error', info: 'info' };
        const colors = { success: 'text-green-400', error: 'text-red-400', info: 'text-primary' };
        const bgs = { success: 'from-green-500/20 to-green-500/5 border-green-500/30', error: 'from-red-500/20 to-red-500/5 border-red-500/30', info: 'from-primary/20 to-primary/5 border-primary/30' };
        const icon = icons[type] || icons.success;
        const color = colors[type] || colors.success;
        const bg = bgs[type] || bgs.success;

        const toast = document.createElement('div');
        toast.className = 'barber-toast';
        toast.innerHTML = `
            <div class="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-gradient-to-r ${bg} border backdrop-blur-xl shadow-2xl">
                <span class="material-symbols-outlined ${color} text-lg" style="font-variation-settings: 'FILL' 1">${icon}</span>
                <span class="text-white text-sm font-bold">${message}</span>
            </div>
        `;

        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('visible'));

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// =============================================
// INSTANCIA GLOBAL
// =============================================

const barberManager = new BarberManager();

// Inicializar cuando se entra al tab de barberos
window.barberManager = barberManager;

console.log('✓ BarberManager loaded');
