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

    // Renderizar navegación dinámica (bottom-nav móvil + sidebar desktop)
    renderNavigation(tabs) {
        const navContainer = document.querySelector('.bottom-nav-container');

        if (!navContainer) {
            console.error('❌ Nav container no encontrado (.bottom-nav-container)');
            return;
        }

        // Adaptar el container según cantidad de tabs:
        // - Hasta 5 tabs (cliente / barbero / recepcionista): centrado con flex-1
        //   en cada item (estética histórica, llena el ancho cómodamente).
        // - 6+ tabs (admin con Inventario en F8): scroll horizontal con ancho
        //   fijo por item para que TODOS sean alcanzables sin romper la UX.
        const muchosTabs = tabs.length > 5;

        if (muchosTabs) {
            navContainer.className = 'bottom-nav-container flex items-center gap-1 overflow-x-auto no-scrollbar -mx-2 px-2';
        } else {
            navContainer.className = 'bottom-nav-container flex items-center justify-around max-w-md mx-auto gap-2';
        }

        const itemSizeCls = muchosTabs ? 'shrink-0 min-w-[64px]' : 'flex-1';

        // Generar HTML de navegación (móvil / bottom-nav)
        const navHTML = tabs.map((tab, index) => `
            <a onclick="switchTab('${tab.id}')"
               class="nav-item relative flex ${itemSizeCls} flex-col items-center justify-center gap-1.5 p-2 rounded-2xl ${index === 0 ? 'text-primary' : 'text-gray-500'} hover:text-gray-300 transition-all duration-300 cursor-pointer active:scale-95"
               data-tab="${tab.id}">
                ${index === 0 ? '<div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-10 h-1 bg-primary rounded-full shadow-[0_0_10px_rgba(201,167,74,0.8)]"></div>' : ''}
                <div class="relative">
                    <span class="material-symbols-outlined text-[26px]"
                          style="font-variation-settings: 'FILL' ${tab.fill || index === 0 ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24">${tab.icon}</span>
                    ${index === 0 ? '<div class="absolute inset-0 bg-primary/30 blur-xl rounded-full"></div>' : ''}
                </div>
                <p class="text-[11px] ${index === 0 ? 'font-black' : 'font-medium'} leading-none tracking-wide whitespace-nowrap">${tab.label}</p>
            </a>
        `).join('');

        navContainer.innerHTML = navHTML;

        // Generar HTML de sidebar (desktop)
        const sidebarNav = document.querySelector('.desktop-sidebar-nav');
        if (sidebarNav) {
            const sidebarHTML = tabs.map((tab, index) => `
                <a onclick="switchTab('${tab.id}')"
                   class="desktop-nav-item ${index === 0 ? 'active' : ''}"
                   data-tab="${tab.id}">
                    <span class="desktop-nav-item-icon material-symbols-outlined"
                          style="font-variation-settings: 'FILL' ${tab.fill || index === 0 ? 1 : 0}, 'wght' 500">${tab.icon}</span>
                    <span class="desktop-nav-item-label">${tab.label}</span>
                </a>
            `).join('');
            sidebarNav.innerHTML = sidebarHTML;
        }

        console.log(`✓ Navegación renderizada con ${tabs.length} items (bottom + sidebar)`);
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

        // Si está viendo otro rol, mostrar botón flotante "Volver a Admin"
        if (this.isViewingAsOtherRole()) {
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
                        selector.className = 'admin-view-selector';
                        selector.innerHTML = `
                            <div class="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] mt-2 mb-2">
                                <p class="text-white/30 text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <span class="material-symbols-outlined text-xs text-primary" style="font-variation-settings: 'FILL' 1">visibility</span>
                                    Previsualizar como
                                </p>
                                <div class="grid grid-cols-3 gap-2">
                                    <button onclick="roleManager.switchViewTo('admin')"
                                        class="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-center transition-all active:scale-95 hover:bg-red-500/25">
                                        <span class="material-symbols-outlined text-red-400 text-base" style="font-variation-settings: 'FILL' 1">admin_panel_settings</span>
                                        <span class="text-red-400 text-[10px] font-black uppercase">Admin</span>
                                    </button>
                                    <button onclick="roleManager.switchViewTo('barbero')"
                                        class="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary/15 border border-primary/25 text-center transition-all active:scale-95 hover:bg-primary/25">
                                        <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1">content_cut</span>
                                        <span class="text-primary text-[10px] font-black uppercase">Barbero</span>
                                    </button>
                                    <button onclick="roleManager.switchViewTo('cliente')"
                                        class="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/25 text-center transition-all active:scale-95 hover:bg-blue-500/25">
                                        <span class="material-symbols-outlined text-blue-400 text-base" style="font-variation-settings: 'FILL' 1">person</span>
                                        <span class="text-blue-400 text-[10px] font-black uppercase">Usuario</span>
                                    </button>
                                </div>
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

        if (avatarImg) {
            // Fallback con iniciales del usuario (siempre disponible)
            const fallbackName = this.currentUser.displayName || 'Usuario';
            const fallbackSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=c9a74a&color=000&size=400&bold=true`;

            // Foto de Google: Google sirve =s96-c por defecto, la subimos a s=400
            // para que no se pixele en el avatar grande.
            let src = this.currentUser.photoURL || fallbackSrc;
            if (typeof src === 'string' && /googleusercontent\.com/.test(src)) {
                src = src.replace(/=s\d+(-c)?/g, '=s400-c').replace(/\/s\d+-c\//g, '/s400-c/');
            }

            // Google pide no-referrer para permitir hotlink desde otro origen
            avatarImg.setAttribute('referrerpolicy', 'no-referrer');
            // Fallback automático si la foto de Google falla (expired, 403, etc.)
            avatarImg.onerror = function () {
                avatarImg.onerror = null;
                avatarImg.src = fallbackSrc;
            };
            avatarImg.src = src;
        }

        if (nameDisplay) {
            nameDisplay.textContent = this.currentUser.displayName || 'Usuario';
        }

        if (emailDisplay) {
            emailDisplay.textContent = this.currentUser.email || 'Miembro Activo';
        }

        const greetingDisplay = document.getElementById('home-greeting-name');
        if (greetingDisplay) {
            const firstName = (this.currentUser.displayName || 'Usuario').split(' ')[0];
            greetingDisplay.textContent = firstName;
        }

        // Sincronizar también con el sidebar desktop
        const sidebarAvatar = document.getElementById('desktop-sidebar-avatar');
        const sidebarName = document.getElementById('desktop-sidebar-name');
        const sidebarRole = document.getElementById('desktop-sidebar-role');
        if (sidebarAvatar) {
            const fallbackName = this.currentUser.displayName || 'Usuario';
            const fallbackSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=c9a74a&color=000&size=200&bold=true`;
            let src = this.currentUser.photoURL || fallbackSrc;
            if (typeof src === 'string' && /googleusercontent\.com/.test(src)) {
                src = src.replace(/=s\d+(-c)?/g, '=s200-c').replace(/\/s\d+-c\//g, '/s200-c/');
            }
            sidebarAvatar.onerror = function () { sidebarAvatar.onerror = null; sidebarAvatar.src = fallbackSrc; };
            sidebarAvatar.src = src;
        }
        if (sidebarName) sidebarName.textContent = this.currentUser.displayName || 'Usuario';
        if (sidebarRole) {
            const activeRole = this.viewingAsRole || this.currentRole || 'cliente';
            const roleLabels = { admin: 'Administrador', barbero: 'Barbero', cliente: 'Cliente' };
            sidebarRole.textContent = roleLabels[activeRole] || activeRole;
        }

        console.log('✓ UI de Perfil Sincronizada con Google');
    }
}

// Instancia global
const roleManager = new RoleManager();

console.log('✓ RoleManager class loaded');
