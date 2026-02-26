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

// Prevent pull-to-refresh on mobile (CORREGIDO)
// El scroll en esta app ocurre dentro de los contenedores de cada tab,
// NO en window, así que hay que verificar el scrollTop del contenedor real.
let touchStartY = 0;
document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    const touchY = e.touches[0].clientY;
    const touchDiff = touchY - touchStartY;

    // Solo bloquear si el usuario está arrastrando hacia abajo (pull-to-refresh)
    if (touchDiff > 0) {
        // Buscar el contenedor scrollable más cercano al elemento tocado
        let scrollableParent = e.target;
        let isAtTop = true;

        while (scrollableParent && scrollableParent !== document.body) {
            const style = window.getComputedStyle(scrollableParent);
            const overflowY = style.overflowY;

            if (overflowY === 'auto' || overflowY === 'scroll') {
                // Encontramos un contenedor scrollable
                if (scrollableParent.scrollTop > 0) {
                    // El contenedor NO está en el top, permitir scroll normal
                    isAtTop = false;
                }
                break;
            }
            scrollableParent = scrollableParent.parentElement;
        }

        // Solo prevenir pull-to-refresh si TODOS los contenedores están en el top
        // Y el window también está en el top
        if (isAtTop && window.scrollY === 0) {
            e.preventDefault();
        }
    }
}, { passive: false });

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
