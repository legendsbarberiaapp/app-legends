/**
 * LEGENDS BARBERIA - APP LOGIC
 * Navegación simple entre pantallas y tabs
 */

// Enter the main app from splash screen
function enterApp() {
    const splashScreen = document.getElementById('splash-screen');
    const mainApp = document.getElementById('main-app');

    // Fade out splash screen
    splashScreen.style.opacity = '0';
    splashScreen.style.transition = 'opacity 0.5s ease-out';

    setTimeout(() => {
        splashScreen.classList.remove('active');
        splashScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        mainApp.classList.add('active');

        // Fade in main app
        mainApp.style.opacity = '0';
        setTimeout(() => {
            mainApp.style.opacity = '1';
            mainApp.style.transition = 'opacity 0.5s ease-in';

            // NUEVO: Inicializar sistema de roles
            roleManager.init();
        }, 50);
    }, 500);
}

// Switch between tabs
function switchTab(tabName) {
    // Hide all tab contents
    const allTabs = document.querySelectorAll('.tab-content');
    allTabs.forEach(tab => {
        tab.classList.remove('active');
        tab.classList.add('hidden');
    });

    // Show selected tab
    const selectedTab = document.getElementById(`${tabName}-tab`);
    if (selectedTab) {
        selectedTab.classList.remove('hidden');
        selectedTab.classList.add('active');
    }

    // Update navigation bar
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        const itemTab = item.getAttribute('data-tab');
        if (itemTab === tabName) {
            item.classList.add('active');
            item.classList.remove('text-gray-500');
            item.classList.add('text-primary');

            // Make icon filled
            const icon = item.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.style.fontVariationSettings = "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24";
            }

            // Make text bold
            const text = item.querySelector('p');
            if (text) {
                text.classList.remove('font-medium');
                text.classList.add('font-bold');
            }
        } else {
            item.classList.remove('active');
            item.classList.remove('text-primary');
            item.classList.add('text-gray-500');

            // Make icon outline
            const icon = item.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.style.fontVariationSettings = "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24";
            }

            // Make text regular
            const text = item.querySelector('p');
            if (text) {
                text.classList.remove('font-bold');
                text.classList.add('font-medium');
            }
        }
    });

    // Scroll to top when switching tabs
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab) {
        activeTab.scrollTop = 0;
    }

    // Auto-cargar datos cuando se entra a tabs específicos de admin
    if (tabName === 'admin-usuarios' && typeof loadUsersForAdmin === 'function') {
        loadUsersForAdmin();
    }
}

// Select role for testing (splash screen)
function selectRole(role) {
    // Guardar selección temporal
    sessionStorage.setItem('selected_role_temp', role);

    // Actualizar display
    const display = document.getElementById('selected-role-display');
    if (display) {
        display.textContent = `Rol seleccionado: ${role.toUpperCase()}`;
    }

    // Resaltar botón seleccionado
    document.querySelectorAll('.role-selector-btn').forEach(btn => {
        btn.classList.remove('bg-primary', 'text-black');
        btn.classList.add('bg-white/10', 'text-white');
    });

    event.target.classList.remove('bg-white/10', 'text-white');
    event.target.classList.add('bg-primary', 'text-black');

    console.log(`✓ Rol seleccionado: ${role}`);
}

// Change user role (admin function)
function changeUserRole(uid, newRole) {
    console.log(`🔄 Cambiando rol de usuario ${uid} a ${newRole}`);

    // Actualizar MOCK_USERS
    for (let key in MOCK_USERS) {
        if (MOCK_USERS[key].uid === uid) {
            MOCK_USERS[key].role = newRole;
            console.log(`✓ Usuario ${MOCK_USERS[key].displayName} ahora es ${newRole}`);

            // Si es el usuario actual, recargar interfaz
            if (roleManager.currentUser && roleManager.currentUser.uid === uid) {
                roleManager.setRole(newRole, MOCK_USERS[key]);
            }

            break;
        }
    }

    alert(`Usuario cambiado a rol: ${newRole.toUpperCase()}`);

    // En producción: await firebaseAdapter.updateUserRole(uid, newRole)
}

// Initialize app
document.addEventListener('DOMContentLoaded', function () {
    console.log('Legends Barberia App Loaded');

    // Cargar rol seleccionado desde selector (si existe)
    const selectedRole = sessionStorage.getItem('selected_role_temp');
    if (selectedRole) {
        // Actualizar rol en roleManager (se inicializará en enterApp)
        if (typeof roleManager !== 'undefined') {
            roleManager.currentRole = selectedRole;
        }
        sessionStorage.removeItem('selected_role_temp');
    }

    // NO llamar switchTab('home') aquí - roleManager.init() lo hará después de enterApp()

    // Add smooth scroll behavior
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add touch feedback to buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('touchstart', function () {
            this.style.opacity = '0.8';
        });

        button.addEventListener('touchend', function () {
            this.style.opacity = '1';
        });

        button.addEventListener('touchcancel', function () {
            this.style.opacity = '1';
        });
    });

    // Prevent default drag on images
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        img.addEventListener('dragstart', (e) => e.preventDefault());
    });

    // Add haptic-like feedback on iOS (optional)
    if ('vibrate' in navigator) {
        const interactiveElements = document.querySelectorAll('button, a, .cursor-pointer');
        interactiveElements.forEach(element => {
            element.addEventListener('click', () => {
                navigator.vibrate(10); // Very short vibration
            });
        });
    }
});

// Handle window resize
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        // Update layout if needed
        console.log('Window resized');
    }, 250);
});

// Pull-to-refresh: Se permite el comportamiento nativo del navegador
// para que el usuario pueda recargar la app deslizando hacia abajo.

// Add visibility change handler
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('App hidden');
    } else {
        console.log('App visible');
    }
});

// Export functions for use in HTML
window.enterApp = enterApp;
window.switchTab = switchTab;
window.selectRole = selectRole;
window.changeUserRole = changeUserRole;

// =============================================
// ADMIN PANEL - Gestión de usuarios
// =============================================

/**
 * Cargar lista de usuarios de Firestore en el panel admin
 */
async function loadUsersForAdmin() {
    const container = document.getElementById('admin-users-list');
    if (!container) return;

    container.innerHTML = `
        <div class="flex flex-col items-center gap-3 py-8">
            <div class="auth-checking-spinner"></div>
            <p class="text-white/50 text-sm">Cargando usuarios...</p>
        </div>
    `;

    try {
        const users = await firebaseAdapter.getAllUsers();

        if (users.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <span class="material-symbols-outlined text-white/20 text-5xl mb-2">group_off</span>
                    <p class="text-white/40 text-sm">No hay usuarios registrados</p>
                </div>
            `;
            return;
        }

        // Separar por roles
        const admins = users.filter(u => u.role === 'admin');
        const barberos = users.filter(u => u.role === 'barbero');
        const clientes = users.filter(u => u.role === 'cliente');

        let html = '';

        // Sección Admins
        if (admins.length > 0) {
            html += renderUserSection('Administrador', admins, 'admin_panel_settings', 'red');
        }

        // Sección Barberos
        html += renderUserSection('Barberos', barberos, 'content_cut', 'primary', true);

        // Sección Usuarios
        html += renderUserSection('Usuarios', clientes, 'person', 'blue', true);

        container.innerHTML = html;
        console.log(`✓ Lista de usuarios renderizada: ${users.length} total`);

    } catch (error) {
        console.error('❌ Error cargando usuarios para admin:', error);
        container.innerHTML = `
            <div class="text-center py-8">
                <span class="material-symbols-outlined text-red-400 text-5xl mb-2">error</span>
                <p class="text-red-400 text-sm">Error al cargar usuarios</p>
                <button onclick="loadUsersForAdmin()" class="mt-3 px-4 py-2 bg-primary/20 text-primary text-xs font-bold rounded-lg border border-primary/30">
                    Reintentar
                </button>
            </div>
        `;
    }
}

/**
 * Renderizar sección de usuarios por rol
 */
function renderUserSection(title, users, icon, color, showActions = false) {
    const colorMap = {
        red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
        primary: { bg: 'bg-primary/10', border: 'border-primary/30', text: 'text-primary', badge: 'bg-primary/20 text-primary border-primary/30' },
        blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
    };
    const c = colorMap[color] || colorMap.blue;

    let html = `
        <div class="mb-6">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined ${c.text} text-lg" style="font-variation-settings: 'FILL' 1">${icon}</span>
                <h3 class="text-white font-bold text-sm uppercase tracking-wider">${title}</h3>
                <span class="px-2 py-0.5 rounded-full ${c.badge} text-[10px] font-black border">${users.length}</span>
            </div>
    `;

    if (users.length === 0) {
        html += `<p class="text-white/30 text-xs ml-7">Sin usuarios en este grupo</p>`;
    } else {
        html += `<div class="space-y-2">`;
        users.forEach(user => {
            const isAdmin = user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
            const roleBadge = user.role === 'admin' ? 'Admin' : user.role === 'barbero' ? 'Barbero' : 'Usuario';

            html += `
                <div class="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <img src="${user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=c9a74a&color=000&size=40`}" 
                             alt="" class="w-10 h-10 rounded-full object-cover border-2 ${c.border}">
                        <div class="min-w-0">
                            <p class="text-white font-bold text-sm truncate">${user.displayName || 'Sin nombre'}</p>
                            <p class="text-white/40 text-[11px] truncate">${user.email || 'Sin email'}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
            `;

            if (showActions && !isAdmin) {
                if (user.role === 'cliente') {
                    html += `
                        <button onclick="toggleUserRole('${user.uid}', 'barbero')"
                            class="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-[10px] font-black uppercase border border-primary/30 hover:bg-primary/30 transition-all active:scale-95">
                            Hacer Barbero
                        </button>
                    `;
                } else if (user.role === 'barbero') {
                    html += `
                        <button onclick="toggleUserRole('${user.uid}', 'cliente')"
                            class="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase border border-blue-500/30 hover:bg-blue-500/30 transition-all active:scale-95">
                            Hacer Usuario
                        </button>
                    `;
                }
            } else if (isAdmin) {
                html += `
                    <span class="px-2 py-1 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-black uppercase border border-red-500/30">
                        Protegido
                    </span>
                `;
            }

            html += `
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

    html += `</div>`;
    return html;
}

/**
 * Cambiar rol de un usuario (barbero <-> cliente)
 */
async function toggleUserRole(uid, newRole) {
    if (!confirm(`¿Cambiar usuario a ${newRole.toUpperCase()}?`)) return;

    const success = await firebaseAdapter.setUserRole(uid, newRole);
    if (success) {
        // Recargar lista
        await loadUsersForAdmin();
    } else {
        alert('Error al cambiar el rol');
    }
}

// Exportar funciones admin al window
window.loadUsersForAdmin = loadUsersForAdmin;
window.toggleUserRole = toggleUserRole;
