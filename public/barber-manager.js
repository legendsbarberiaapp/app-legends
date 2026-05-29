/**
 * LEGENDS BARBERIA - BARBER MANAGER
 * Coordina la UI de administración de barberos.
 * Los datos se gestionan en los services:
 *   - BarbersService (public/services/barbers-service.js)
 *   - ServiciosService (public/services/servicios-service.js)
 *   - AdicionalesService (public/services/adicionales-service.js)
 * Las notificaciones se muestran con showToast (public/components/toast.js).
 */

class BarberManager {
    constructor() {
        this.barbers = [];
        this.allUsers = [];
        this.serviciosCorte = []; // Servicios globales del corte
        this.adicionalesGlobal = []; // Adicionales globales
        this.sedes = []; // Sucursales (F1: 2 sedes fijas, renombrables)
        this.productos = []; // Catálogo de productos para POS (F3)
        this.editingBarberId = null;
        this.initialized = false;
    }

    // =============================================
    // INICIALIZACIÓN
    // =============================================

    async init() {
        console.log('🔧 Inicializando BarberManager...');
        this.initialized = true;
        await Promise.all([this.loadServiciosCorte(), this.loadAdicionales(), this.loadSedes()]);
        await this.loadBarbers();
    }

    async loadSedes() {
        try {
            if (typeof SedesService === 'undefined') {
                this.sedes = [];
                return;
            }
            this.sedes = await SedesService.list();
        } catch (error) {
            console.error('❌ Error cargando sedes:', error);
            this.sedes = [];
        }
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
            this.barbers = await BarbersService.list();
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

    /** Guardar nuevo barbero */
    async saveBarber(data) {
        try {
            await BarbersService.create(data);
            console.log('✓ Barbero guardado');
            await this.loadBarbers();
            return true;
        } catch (error) {
            console.error('❌ Error guardando barbero:', error);
            return false;
        }
    }

    /** Actualizar barbero existente */
    async updateBarber(id, data) {
        try {
            await BarbersService.update(id, data);
            console.log('✓ Barbero actualizado');
            await this.loadBarbers();
            return true;
        } catch (error) {
            console.error('❌ Error actualizando barbero:', error);
            return false;
        }
    }

    /** Eliminar barbero */
    async deleteBarber(id) {
        try {
            const barber = this.barbers.find(b => b.id === id);
            await BarbersService.remove(id, barber?.userId);
            console.log('✓ Barbero eliminado');
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
            this.allUsers = await BarbersService.listAllUsers();
        } catch (error) {
            console.error('❌ Error cargando usuarios:', error);
            this.allUsers = [];
        }
    }

    // =============================================
    // SERVICIOS DEL CORTE - delega en ServiciosService
    // =============================================

    async loadServiciosCorte() {
        try {
            this.serviciosCorte = await ServiciosService.list();
            console.log(`✓ ${this.serviciosCorte.length} servicios del corte cargados`);
        } catch (error) {
            console.error('❌ Error cargando servicios:', error);
            this.serviciosCorte = ServiciosService.DEFAULTS.map(s => ({ ...s }));
        }
    }

    async addServicioCorte(nombre) {
        try {
            const ok = await ServiciosService.create(nombre, this.serviciosCorte.length);
            if (ok) await this.loadServiciosCorte();
            return ok;
        } catch (error) {
            console.error('❌ Error agregando servicio:', error);
            return false;
        }
    }

    async deleteServicioCorte(id) {
        try {
            const ok = await ServiciosService.remove(id);
            if (ok) await this.loadServiciosCorte();
            return ok;
        } catch (error) {
            console.error('❌ Error eliminando servicio:', error);
            return false;
        }
    }

    async updateServicioDescripcion(id, descripcion) {
        try {
            const ok = await ServiciosService.updateDescripcion(id, descripcion);
            if (ok) {
                const svc = this.serviciosCorte.find(s => s.id === id);
                if (svc) svc.descripcion = descripcion;
            }
            return ok;
        } catch (error) {
            console.error('❌ Error actualizando descripción:', error);
            return false;
        }
    }

    async updateServicio(id, fields) {
        try {
            const ok = await ServiciosService.update(id, fields);
            if (ok) {
                const svc = this.serviciosCorte.find(s => s.id === id);
                if (svc) Object.assign(svc, fields);
            }
            return ok;
        } catch (error) {
            console.error('❌ Error actualizando servicio:', error);
            return false;
        }
    }

    // Servicios del corte (UI picker + gestor) → admin/servicios-picker-ui.js

    // Lista de barberos y tarjetas → admin/barbers-list-ui.js

    // Modal de crear/editar + interacciones + submit → admin/barber-modal-ui.js

    // Confirmación de eliminación → admin/confirm-dialog-ui.js

    // =============================================
    // ADICIONALES - delega en AdicionalesService
    // =============================================

    async loadAdicionales() {
        try {
            this.adicionalesGlobal = await AdicionalesService.list();
            console.log(`✓ ${this.adicionalesGlobal.length} adicionales cargados`);
        } catch (error) {
            console.error('❌ Error cargando adicionales:', error);
            this.adicionalesGlobal = AdicionalesService.DEFAULTS.map(a => ({ ...a }));
        }
    }

    async addAdicional(nombre) {
        try {
            const ok = await AdicionalesService.create(nombre, this.adicionalesGlobal.length);
            if (ok) await this.loadAdicionales();
            return ok;
        } catch (e) { console.error(e); return false; }
    }

    async deleteAdicional(id) {
        try {
            const ok = await AdicionalesService.remove(id);
            if (ok) await this.loadAdicionales();
            return ok;
        } catch (e) { console.error(e); return false; }
    }

    async updateAdicionalDescripcion(id, descripcion) {
        try {
            const ok = await AdicionalesService.updateDescripcion(id, descripcion);
            if (ok) {
                const a = this.adicionalesGlobal.find(x => x.id === id);
                if (a) a.descripcion = descripcion;
            }
            return ok;
        } catch (e) { console.error(e); return false; }
    }

    async toggleAdicionalSoloConCorte(id) {
        const a = this.adicionalesGlobal.find(x => x.id === id);
        if (!a) return;
        const newVal = !a.soloConCorte;
        try {
            const ok = await AdicionalesService.setSoloConCorte(id, newVal);
            if (ok) {
                a.soloConCorte = newVal;
                this.showToast(newVal ? 'Solo con corte ✓' : 'Disponible por separado ✓', 'info');
            }
        } catch (e) { console.error(e); }
    }

    // UI picker de adicionales + gestor → admin/adicionales-picker-ui.js

    // =============================================
    // TOAST NOTIFICATIONS
    // =============================================

    showToast(message, type = 'success') {
        window.showToast(message, type);
    }
}

// =============================================
// INSTANCIA GLOBAL
// =============================================

const barberManager = new BarberManager();

// Inicializar cuando se entra al tab de barberos
window.barberManager = barberManager;

console.log('✓ BarberManager loaded');
