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
    RECEPCIONISTA: 'recepcionista',
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

    // F1: pantalla read-only "Citas Hoy" de su sede.
    // F2 sumó: gestionar citas (confirmar/cancelar/reagendar) + walk-ins.
    // F3 sumó: tab "Caja" (cobro al completar cita, venta directa de productos,
    //          cierre del día por método de pago).
    // F4 sumó: tab "Inventario" (stock por sede, alertas de bajo stock,
    //          registrar entradas de mercancía).
    recepcionista: {
        tabs: [
            { id: 'recepcionista-citas',      icon: 'event_available', label: 'Citas',      fill: true  },
            { id: 'recepcionista-caja',       icon: 'point_of_sale',   label: 'Caja',       fill: false },
            { id: 'recepcionista-inventario', icon: 'inventory_2',     label: 'Stock',      fill: false }
        ],
        defaultTab: 'recepcionista-citas',
        showFAB: false
    },

    admin: {
        tabs: [
            { id: 'admin-dashboard', icon: 'admin_panel_settings', label: 'Admin', fill: true },
            { id: 'admin-agenda', icon: 'event_note', label: 'Agenda', fill: false },
            { id: 'admin-usuarios', icon: 'group', label: 'Usuarios', fill: false },
            { id: 'admin-barberos', icon: 'content_cut', label: 'Barberos', fill: false }
        ],
        defaultTab: 'admin-dashboard',
        showFAB: false
    }
};

console.log('✓ Role Config loaded - Roles:', Object.keys(ROLES));
