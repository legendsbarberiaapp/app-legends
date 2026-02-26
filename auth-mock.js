/**
 * LEGENDS BARBERIA - AUTH MOCK
 * Sistema de autenticación mock preparado para Firebase
 */

// Definición de roles
const ROLES = {
    ADMIN: 'admin',
    BARBERO: 'barbero',
    CLIENTE: 'cliente'
};

// Usuarios mock para testing
const MOCK_USERS = {
    admin: {
        uid: 'admin_001',
        email: 'admin@legends.com',
        role: 'admin',
        displayName: 'Admin Legends',
        photoURL: null,
        createdAt: Date.now(),
        metadata: {
            permissions: ['all']
        }
    },
    barbero: {
        uid: 'barber_001',
        email: 'marcus@legends.com',
        role: 'barbero',
        displayName: 'Marcus Williams',
        photoURL: null,
        createdAt: Date.now(),
        metadata: {
            specialties: ['Fade', 'Beard Trim', 'Hot Towel Shave'],
            rating: 4.9,
            totalCuts: 847,
            yearsExperience: 8
        }
    },
    cliente: {
        uid: 'client_001',
        email: 'alex@cliente.com',
        role: 'cliente',
        displayName: 'Alex Rodriguez',
        photoURL: null,
        createdAt: Date.now(),
        metadata: {
            loyaltyPoints: 350,
            tier: 'Oro',
            totalVisits: 12,
            favoriteBarbero: 'barber_001'
        }
    }
};

// Configuración de tabs por rol
const ROLE_CONFIGS = {
    cliente: {
        tabs: [
            { id: 'home', icon: 'home', label: 'Inicio', fill: true },
            { id: 'services', icon: 'content_cut', label: 'Servicios', fill: false },
            { id: 'barbers', icon: 'group', label: 'Barberos', fill: false },
            { id: 'booking', icon: 'calendar_month', label: 'Reservar', fill: false },
            { id: 'profile', icon: 'account_circle', label: 'Perfil', fill: false }
        ],
        defaultTab: 'home',
        showFAB: true
    },

    barbero: {
        tabs: [
            { id: 'barbero-dashboard', icon: 'dashboard', label: 'Dashboard', fill: true },
            { id: 'barbero-citas', icon: 'calendar_today', label: 'Mis Citas', fill: false },
            { id: 'barbero-servicios', icon: 'content_cut', label: 'Servicios', fill: false },
            { id: 'barbero-estadisticas', icon: 'analytics', label: 'Stats', fill: false },
            { id: 'barbero-perfil', icon: 'account_circle', label: 'Perfil', fill: false }
        ],
        defaultTab: 'barbero-dashboard',
        showFAB: false
    },

    admin: {
        tabs: [
            { id: 'admin-dashboard', icon: 'admin_panel_settings', label: 'Admin', fill: true },
            { id: 'admin-usuarios', icon: 'group', label: 'Usuarios', fill: false },
            { id: 'admin-barberos', icon: 'content_cut', label: 'Barberos', fill: false },
            { id: 'admin-reportes', icon: 'bar_chart', label: 'Reportes', fill: false },
            { id: 'admin-config', icon: 'settings', label: 'Config', fill: false }
        ],
        defaultTab: 'admin-dashboard',
        showFAB: false
    }
};

console.log('✓ Auth Mock loaded - Roles:', Object.keys(ROLES));
