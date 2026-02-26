/**
 * LEGENDS BARBERIA - ROLE MANAGER
 * Sistema centralizado de gestión de roles de usuario
 */

class RoleManager {
    constructor() {
        this.currentUser = null;
        this.currentRole = null;
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

    // Renderizar interfaz según rol actual
    renderForRole() {
        const config = ROLE_CONFIGS[this.currentRole];

        if (!config) {
            console.error(`❌ No hay configuración para el rol: ${this.currentRole}`);
            return;
        }

        console.log(`🎨 Renderizando interfaz para rol: ${this.currentRole}`);

        // 1. Ocultar todos los tabs
        this.hideAllTabs();

        // 2. Mostrar solo tabs del rol actual
        this.showTabsForRole(config.tabs);

        // 3. Renderizar navegación dinámica
        this.renderNavigation(config.tabs);

        // 4. Mostrar/ocultar FAB
        this.toggleFAB(config.showFAB);

        // 5. Actualizar la interfaz del perfil
        this.updateProfileUI();

        // 6. Navegar a tab por defecto
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

    // Obtener rol actual
    getCurrentRole() {
        return this.currentRole;
    }

    // Obtener usuario actual
    getCurrentUser() {
        return this.currentUser;
    }

    // Verificar si el usuario es admin
    isAdmin() {
        return this.currentRole === ROLES.ADMIN;
    }

    // Verificar si el usuario es barbero
    isBarbero() {
        return this.currentRole === ROLES.BARBERO;
    }

    // Verificar si el usuario es cliente
    isCliente() {
        return this.currentRole === ROLES.CLIENTE;
    }
}

// Instancia global
const roleManager = new RoleManager();

console.log('✓ RoleManager class loaded');
