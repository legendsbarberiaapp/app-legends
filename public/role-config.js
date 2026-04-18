/**
 * LEGENDS BARBERIA - ROLE CONFIG
 * Catálogo de roles válidos y configuración de cada uno
 * (tabs visibles, tab por defecto, FAB, etc.).
 * Firebase provee los datos reales del usuario; aquí solo definimos
 * qué interfaz le corresponde a cada rol.
 */

const ROLES = {
    ADMIN: 'admin',
    BARBERO: 'barbero',
    CLIENTE: 'cliente'
};

const ROLE_CONFIGS = {
    cliente: {
        tabs: [
            { id: 'home', icon: 'home', label: 'Inicio', fill: true },
            { id: 'booking', icon: 'calendar_month', label: 'Reservar', fill: false },
            { id: 'profile', icon: 'account_circle', label: 'Perfil', fill: false }
        ],
        defaultTab: 'home',
        showFAB: true
    },

    barbero: {
        tabs: [
            { id: 'barbero-dashboard', icon: 'dashboard', label: 'Dashboard', fill: true },
            { id: 'barbero-citas', icon: 'calendar_today', label: 'Mis Citas', fill: false }
        ],
        defaultTab: 'barbero-dashboard',
        showFAB: false
    },

    admin: {
        tabs: [
            { id: 'admin-dashboard', icon: 'admin_panel_settings', label: 'Admin', fill: true },
            { id: 'admin-usuarios', icon: 'group', label: 'Usuarios', fill: false },
            { id: 'admin-barberos', icon: 'content_cut', label: 'Barberos', fill: false }
        ],
        defaultTab: 'admin-dashboard',
        showFAB: false
    }
};

console.log('✓ Role Config loaded - Roles:', Object.keys(ROLES));
