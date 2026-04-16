/**
 * LEGENDS BARBERIA - APP LOGIC
 * Ciclo de vida del splash, navegación entre tabs y selección de rol.
 * Las interacciones táctiles viven en interactions.js.
 * La UI del admin (usuarios, dashboard) vive en admin/.
 */

// =============================================
// CICLO DE VIDA: SPLASH -> APP
// =============================================

function enterApp() {
    const splashScreen = document.getElementById('splash-screen');
    const mainApp = document.getElementById('main-app');

    splashScreen.style.opacity = '0';
    splashScreen.style.transition = 'opacity 0.5s ease-out';

    setTimeout(() => {
        splashScreen.classList.remove('active');
        splashScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        mainApp.classList.add('active');

        mainApp.style.opacity = '0';
        setTimeout(() => {
            mainApp.style.opacity = '1';
            mainApp.style.transition = 'opacity 0.5s ease-in';
            roleManager.init();
        }, 50);
    }, 500);
}

// =============================================
// NAVEGACIÓN ENTRE TABS
// =============================================

async function switchTab(tabName) {
    const allTabs = document.querySelectorAll('.tab-content');
    allTabs.forEach(tab => {
        tab.classList.remove('active');
        tab.classList.add('hidden');
    });

    const selectedTab = document.getElementById(`${tabName}-tab`);
    if (selectedTab) {
        if (selectedTab.dataset.partial && selectedTab.dataset.loaded !== 'true'
            && typeof window.loadPartialIntoTab === 'function') {
            await window.loadPartialIntoTab(selectedTab);
        }
        selectedTab.classList.remove('hidden');
        selectedTab.classList.add('active');
    }

    updateNavIndicator(tabName);

    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab) activeTab.scrollTop = 0;

    autoLoadDataForTab(tabName);
}

function updateNavIndicator(tabName) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        const itemTab = item.getAttribute('data-tab');
        const isActive = itemTab === tabName;

        item.classList.toggle('active', isActive);
        item.classList.toggle('text-primary', isActive);
        item.classList.toggle('text-gray-500', !isActive);

        const icon = item.querySelector('.material-symbols-outlined');
        if (icon) {
            icon.style.fontVariationSettings = isActive
                ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24";
        }

        const text = item.querySelector('p');
        if (text) {
            text.classList.toggle('font-bold', isActive);
            text.classList.toggle('font-medium', !isActive);
        }
    });
}

function autoLoadDataForTab(tabName) {
    if (tabName === 'admin-dashboard' && typeof loadDashboardStats === 'function') {
        loadDashboardStats();
    }
    if (tabName === 'admin-usuarios' && typeof loadUsersForAdmin === 'function') {
        loadUsersForAdmin();
    }
    if (tabName === 'admin-barberos' && typeof barberManager !== 'undefined') {
        if (!barberManager.initialized) {
            barberManager.init();
        } else {
            barberManager.loadBarbers();
        }
    }
}

// =============================================
// SELECCIÓN DE ROL (SPLASH DE PRUEBAS)
// =============================================

function selectRole(role) {
    sessionStorage.setItem('selected_role_temp', role);

    const display = document.getElementById('selected-role-display');
    if (display) display.textContent = `Rol seleccionado: ${role.toUpperCase()}`;

    document.querySelectorAll('.role-selector-btn').forEach(btn => {
        btn.classList.remove('bg-primary', 'text-black');
        btn.classList.add('bg-white/10', 'text-white');
    });

    event.target.classList.remove('bg-white/10', 'text-white');
    event.target.classList.add('bg-primary', 'text-black');

    console.log(`✓ Rol seleccionado: ${role}`);
}

// =============================================
// INICIALIZACIÓN
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Legends Barberia App Loaded');

    const selectedRole = sessionStorage.getItem('selected_role_temp');
    if (selectedRole) {
        if (typeof roleManager !== 'undefined') {
            roleManager.currentRole = selectedRole;
        }
        sessionStorage.removeItem('selected_role_temp');
    }
});

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => console.log('Window resized'), 250);
});

document.addEventListener('visibilitychange', () => {
    console.log(document.hidden ? 'App hidden' : 'App visible');
});

// =============================================
// EXPORTS AL WINDOW (para onclick en HTML)
// =============================================

window.enterApp = enterApp;
window.switchTab = switchTab;
window.selectRole = selectRole;
