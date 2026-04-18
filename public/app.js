/**
 * LEGENDS BARBERIA - NAVEGACIÓN ENTRE TABS
 * Cambio de tab + lazy-load del partial + auto-carga de datos para tabs de admin.
 * El ciclo de vida del login vive en firebase-adapter.js.
 * Las interacciones táctiles viven en interactions.js.
 */

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
    if (tabName === 'admin-dashboard') {
        if (typeof loadDashboardStats === 'function') loadDashboardStats();
        if (typeof initCitasPendientes === 'function') initCitasPendientes();
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
    if (tabName === 'admin-agenda' && typeof initAgenda === 'function') {
        initAgenda();
    }
    if (tabName === 'home' && typeof initHome === 'function') {
        initHome();
    }
    if (tabName === 'booking' && typeof initBooking === 'function') {
        initBooking();
    }
    if (tabName === 'profile' && typeof initProfile === 'function') {
        initProfile();
    }
    if (tabName === 'barbero-citas' && typeof initBarberoCitas === 'function') {
        initBarberoCitas();
    }
}

window.switchTab = switchTab;
