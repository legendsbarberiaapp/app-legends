/**
 * LEGENDS BARBERIA - ROLE MANAGER
 * Sistema centralizado de gestión de roles de usuario
 * 
 * Roles: admin, barbero, cliente
 * - currentRole: rol REAL del usuario en Firestore (no cambia)
 * - viewingAsRole: rol que el admin está previsualizando (solo admin puede cambiar)
 */

class RoleManager {
    constructor() {
        this.currentUser = null;
        this.currentRole = null;      // Rol REAL en Firestore
        this.viewingAsRole = null;    // Rol que se está previsualizando (solo admin)
        this.initialized = false;
    }

    // Inicializar sistema de roles
    init() {
        console.log('🔧 Inicializando RoleManager...');

        // Cargar usuario desde localStorage
        const savedUser = this.loadUserFromStorage();

        if (savedUser) {
            this.currentUser = savedUser;
            this.currentRole = savedUser.role;
            this.viewingAsRole = savedUser.role;
            console.log(`✓ Usuario cargado: ${savedUser.displayName} (${savedUser.role})`);
        } else {
            // Usuario por defecto para testing (cliente)
            this.setRole('cliente', MOCK_USERS.cliente);
            console.log('⚠ No hay usuario guardado, usando cliente por defecto');
        }

        this.initialized = true;
        this.renderForRole();
    }

    // Establecer rol actual
    setRole(role, userData = null) {
        const roleUpper = role.toUpperCase();

        if (!ROLES[roleUpper]) {
            console.error(`❌ Rol inválido: ${role}`);
            return false;
        }

        this.currentRole = role;
        this.viewingAsRole = role;

        if (userData) {
            this.currentUser = userData;
            this.saveUserToStorage(userData);
        } else {
            // Usar mock user predefinido
            this.currentUser = MOCK_USERS[role];
            this.saveUserToStorage(MOCK_USERS[role]);
        }

        // Renderizar interfaz para el nuevo rol
        if (this.initialized) {
            this.renderForRole();
        }

        console.log(`✓ Rol cambiado a: ${role.toUpperCase()}`);
        return true;
    }

    /**
     * CAMBIAR VISTA (solo para admin)
     * Permite al admin ver la interfaz exacta de otro rol,
     * sin cambiar su rol real en Firestore.
     */
    switchViewTo(role) {
        if (this.currentRole !== 'admin') {
            console.warn('⚠ Solo el admin puede cambiar de vista');
            return false;
        }

        const roleUpper = role.toUpperCase();
        if (!ROLES[roleUpper]) {
            console.error(`❌ Rol inválido para vista: ${role}`);
            return false;
        }

        this.viewingAsRole = role;
        console.log(`👁 Admin cambiando vista a: ${role.toUpperCase()}`);

        // Re-renderizar con la nueva vista
        this.renderForRole();
        return true;
    }

    /**
     * Verificar si el admin está en una vista diferente a la suya
     */
    isViewingAsOtherRole() {
        return this.currentRole === 'admin' && this.viewingAsRole !== 'admin';
    }

    /**
     * Verificar si el usuario actual es admin (rol real)
     */
    isRealAdmin() {
        return this.currentRole === 'admin';
    }

    // Renderizar interfaz según el rol que se está viendo
    renderForRole() {
        const activeRole = this.viewingAsRole || this.currentRole;
        const config = ROLE_CONFIGS[activeRole];

        if (!config) {
            console.error(`❌ No hay configuración para el rol: ${activeRole}`);
            return;
        }

        console.log(`🎨 Renderizando interfaz para vista: ${activeRole}`);

        // 1. Ocultar todos los tabs
        this.hideAllTabs();

        // 2. Mostrar solo tabs del rol activo
        this.showTabsForRole(config.tabs);

        // 3. Renderizar navegación dinámica
        this.renderNavigation(config.tabs);

        // 4. Mostrar/ocultar FAB
        this.toggleFAB(config.showFAB);

        // 5. Actualizar la interfaz del perfil
        this.updateProfileUI();

        // 6. Inyectar botón "Volver a Admin" en el perfil si está viendo otro rol
        this.injectAdminSwitchButton();

        // 7. Navegar a tab por defecto
        setTimeout(() => {
            switchTab(config.defaultTab);
        }, 100);
    }

    // Ocultar todos los tabs
    hideAllTabs() {
        const allTabs = document.querySelectorAll('.tab-content');
        allTabs.forEach(tab => {
            tab.classList.add('hidden');
            tab.classList.remove('active');
        });
    }

    // Mostrar tabs específicos del rol
    showTabsForRole(tabs) {
        tabs.forEach(tabConfig => {
            const tabElement = document.getElementById(`${tabConfig.id}-tab`);
            if (tabElement) {
                // Remover hidden pero no activar aún
                tabElement.classList.remove('hidden');
            } else {
                console.warn(`⚠ Tab no encontrado: ${tabConfig.id}-tab`);
            }
        });
    }

    // Renderizar navegación dinámica
    renderNavigation(tabs) {
        const navContainer = document.querySelector('.bottom-nav-container');

        if (!navContainer) {
            console.error('❌ Nav container no encontrado (.bottom-nav-container)');
            return;
        }

        // Generar HTML de navegación
        const navHTML = tabs.map((tab, index) => `
            <a onclick="switchTab('${tab.id}')"
               class="nav-item relative flex flex-1 flex-col items-center justify-center gap-1.5 p-2 rounded-2xl ${index === 0 ? 'text-primary' : 'text-gray-500'} hover:text-gray-300 transition-all duration-300 cursor-pointer active:scale-95"
               data-tab="${tab.id}">
                ${index === 0 ? '<div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-10 h-1 bg-primary rounded-full shadow-[0_0_10px_rgba(201,167,74,0.8)]"></div>' : ''}
                <div class="relative">
                    <span class="material-symbols-outlined text-[26px]"
                          style="font-variation-settings: 'FILL' ${tab.fill || index === 0 ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24">${tab.icon}</span>
                    ${index === 0 ? '<div class="absolute inset-0 bg-primary/30 blur-xl rounded-full"></div>' : ''}
                </div>
                <p class="text-[11px] ${index === 0 ? 'font-black' : 'font-medium'} leading-none tracking-wide">${tab.label}</p>
            </a>
        `).join('');

        navContainer.innerHTML = navHTML;
        console.log(`✓ Navegación renderizada con ${tabs.length} items`);
    }

    // Toggle FAB (Floating Action Button)
    toggleFAB(show) {
        const fab = document.querySelector('.floating-action-button');
        if (fab) {
            fab.style.display = show ? 'block' : 'none';
            console.log(`✓ FAB ${show ? 'visible' : 'oculto'}`);
        }
    }

    /**
     * Inyectar botón "Volver a Vista Admin" en el perfil
     * cuando el admin está previsualizando otro rol.
     * También inyecta el selector de vista en el dashboard de admin.
     */
    injectAdminSwitchButton() {
        // Limpiar botones anteriores
        document.querySelectorAll('.admin-view-switch-btn').forEach(el => el.remove());
        document.querySelectorAll('.admin-view-selector').forEach(el => el.remove());

        if (!this.isRealAdmin()) return;

        // Si está viendo otro rol, agregar botón en el perfil activo
        if (this.isViewingAsOtherRole()) {
            const activeRole = this.viewingAsRole;
            // Buscar el perfil del rol que se está viendo
            let profileTab = null;
            if (activeRole === 'cliente') {
                profileTab = document.getElementById('profile-tab');
            } else if (activeRole === 'barbero') {
                profileTab = document.getElementById('barbero-perfil-tab');
            }

            if (profileTab) {
                const switchBtn = document.createElement('div');
                switchBtn.className = 'admin-view-switch-btn fixed top-4 left-1/2 -translate-x-1/2 z-50';
                switchBtn.innerHTML = `
                    <button onclick="roleManager.switchViewTo('admin')"
                        class="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-500/90 backdrop-blur-xl text-white text-xs font-black uppercase tracking-wider shadow-[0_4px_20px_rgba(239,68,68,0.4)] hover:bg-red-500 transition-all active:scale-95 border border-red-400/30">
                        <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1">admin_panel_settings</span>
                        <span>Volver a Admin</span>
                    </button>
                `;
                document.body.appendChild(switchBtn);
            }
        }

        // Si está en vista admin, agregar selector de vista en el dashboard
        if (this.viewingAsRole === 'admin') {
            const adminDashboard = document.getElementById('admin-dashboard-tab');
            if (adminDashboard) {
                // Buscar si ya existe el selector
                const existingSelector = adminDashboard.querySelector('.admin-view-selector');
                if (!existingSelector) {
                    const headerSection = adminDashboard.querySelector('.mb-8') || adminDashboard.querySelector('div > div');
                    if (headerSection) {
                        const selector = document.createElement('div');
                        selector.className = 'admin-view-selector mt-6';
                        selector.innerHTML = `
                            <p class="text-white/50 text-xs font-bold uppercase tracking-wider mb-3">
                                <span class="material-symbols-outlined text-sm align-middle mr-1" style="font-variation-settings: 'FILL' 1">visibility</span>
                                Previsualizar Vista
                            </p>
                            <div class="grid grid-cols-3 gap-3">
                                <button onclick="roleManager.switchViewTo('admin')"
                                    class="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-center transition-all active:scale-95 hover:bg-red-500/30">
                                    <span class="material-symbols-outlined text-red-400 text-2xl mb-1" style="font-variation-settings: 'FILL' 1">admin_panel_settings</span>
                                    <p class="text-red-400 text-[10px] font-black uppercase">Admin</p>
                                </button>
                                <button onclick="roleManager.switchViewTo('barbero')"
                                    class="p-3 rounded-xl bg-primary/20 border border-primary/40 text-center transition-all active:scale-95 hover:bg-primary/30">
                                    <span class="material-symbols-outlined text-primary text-2xl mb-1" style="font-variation-settings: 'FILL' 1">content_cut</span>
                                    <p class="text-primary text-[10px] font-black uppercase">Barbero</p>
                                </button>
                                <button onclick="roleManager.switchViewTo('cliente')"
                                    class="p-3 rounded-xl bg-blue-500/20 border border-blue-500/40 text-center transition-all active:scale-95 hover:bg-blue-500/30">
                                    <span class="material-symbols-outlined text-blue-400 text-2xl mb-1" style="font-variation-settings: 'FILL' 1">person</span>
                                    <p class="text-blue-400 text-[10px] font-black uppercase">Usuario</p>
                                </button>
                            </div>
                        `;
                        headerSection.after(selector);
                    }
                }
            }
        }
    }

    // Actualizar nombre y foto de perfil según configuración de Google/currentUser
    updateProfileUI() {
        if (!this.currentUser) return;

        const avatarImg = document.getElementById('profile-avatar-img');
        const nameDisplay = document.getElementById('profile-name-display');
        const emailDisplay = document.getElementById('profile-email-display');

        if (avatarImg && this.currentUser.photoURL) {
            avatarImg.src = this.currentUser.photoURL;
        } else if (avatarImg) {
            // Placeholder si no tiene foto de Google
            const fallbackName = this.currentUser.displayName || 'User';
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=c9a74a&color=000`;
        }

        if (nameDisplay) {
            // Dividir nombre y apellido por estética si es posible
            const nameParts = (this.currentUser.displayName || 'Usuario').split(' ');
            if (nameParts.length >= 2) {
                const fName = nameParts.shift();
                const lName = nameParts.join(' ');
                nameDisplay.innerHTML = `${fName}<br><span class="text-primary drop-shadow-[0_0_15px_rgba(201,167,74,0.6)]"></span> ${lName}`;
            } else {
                nameDisplay.textContent = this.currentUser.displayName;
            }
        }

        if (emailDisplay) {
            emailDisplay.textContent = this.currentUser.email || 'Miembro Activo';
        }

        const greetingDisplay = document.getElementById('home-greeting-name');
        if (greetingDisplay) {
            const firstName = (this.currentUser.displayName || 'Usuario').split(' ')[0];
            greetingDisplay.textContent = firstName;
        }

        console.log('✓ UI de Perfil Sincronizada con Google');
    }

    // Guardar usuario en localStorage
    saveUserToStorage(user) {
        try {
            localStorage.setItem('legends_current_user', JSON.stringify(user));
            console.log('💾 Usuario guardado en localStorage');
        } catch (error) {
            console.error('❌ Error guardando usuario:', error);
        }
    }

    // Cargar usuario desde localStorage
    loadUserFromStorage() {
        try {
            const userJson = localStorage.getItem('legends_current_user');
            return userJson ? JSON.parse(userJson) : null;
        } catch (error) {
            console.error('❌ Error cargando usuario:', error);
            return null;
        }
    }

    // Obtener rol actual (real)
    getCurrentRole() {
        return this.currentRole;
    }

    // Obtener rol que se está viendo (puede ser diferente al real si es admin)
    getViewingRole() {
        return this.viewingAsRole || this.currentRole;
    }

    // Obtener usuario actual
    getCurrentUser() {
        return this.currentUser;
    }

    // Verificar si el usuario es admin
    isAdmin() {
        return this.currentRole === 'admin';
    }

    // Verificar si el usuario es barbero
    isBarbero() {
        return this.currentRole === 'barbero';
    }

    // Verificar si el usuario es cliente
    isCliente() {
        return this.currentRole === 'cliente';
    }
}

// Instancia global
const roleManager = new RoleManager();

console.log('✓ RoleManager class loaded');
