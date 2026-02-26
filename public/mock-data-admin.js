/**
 * LEGENDS BARBERIA - MOCK DATA ADMIN
 * Datos de ejemplo para el panel de administración
 */

const ADMIN_MOCK_DATA = {
    dashboard: {
        stats: {
            totalRevenue: 4850.00,
            todayAppointments: 24,
            completedToday: 18,
            activeUsers: 342,
            activeBarberos: 5,
            monthRevenue: 28500.00
        },
        recentActivity: [
            {
                id: 'act_001',
                type: 'booking',
                user: 'Alex R.',
                barbero: 'Marcus',
                service: 'Fresh Fade',
                time: '10:30 AM',
                timestamp: Date.now() - 1000 * 60 * 15
            },
            {
                id: 'act_002',
                type: 'payment',
                user: 'John D.',
                amount: 45.00,
                time: '10:15 AM',
                timestamp: Date.now() - 1000 * 60 * 30
            },
            {
                id: 'act_003',
                type: 'newUser',
                user: 'Sarah M.',
                time: '9:45 AM',
                timestamp: Date.now() - 1000 * 60 * 60
            },
            {
                id: 'act_004',
                type: 'completed',
                user: 'Mike P.',
                barbero: 'Dante',
                service: 'Beard Trim',
                time: '9:30 AM',
                timestamp: Date.now() - 1000 * 60 * 75
            }
        ]
    },

    users: [
        {
            uid: 'client_001',
            name: 'Alex Rodriguez',
            email: 'alex@cliente.com',
            role: 'cliente',
            status: 'active',
            joinDate: '2024-01-15',
            totalVisits: 12,
            totalSpent: 540.00,
            lastVisit: '2 días atrás'
        },
        {
            uid: 'barber_001',
            name: 'Marcus Williams',
            email: 'marcus@legends.com',
            role: 'barbero',
            status: 'active',
            joinDate: '2023-06-01',
            totalCuts: 847,
            rating: 4.9,
            monthRevenue: 2340.00
        },
        {
            uid: 'client_002',
            name: 'John Davis',
            email: 'john@cliente.com',
            role: 'cliente',
            status: 'active',
            joinDate: '2024-02-20',
            totalVisits: 8,
            totalSpent: 360.00,
            lastVisit: '1 semana atrás'
        },
        {
            uid: 'barber_002',
            name: 'Dante Johnson',
            email: 'dante@legends.com',
            role: 'barbero',
            status: 'active',
            joinDate: '2023-08-15',
            totalCuts: 634,
            rating: 4.8,
            monthRevenue: 1890.00
        },
        {
            uid: 'client_003',
            name: 'Sarah Martinez',
            email: 'sarah@cliente.com',
            role: 'cliente',
            status: 'active',
            joinDate: '2024-03-10',
            totalVisits: 5,
            totalSpent: 225.00,
            lastVisit: '3 días atrás'
        }
    ],

    barberos: [
        {
            uid: 'barber_001',
            name: 'Marcus Williams',
            specialties: ['Fade', 'Beard Trim', 'Hot Towel Shave'],
            rating: 4.9,
            totalCuts: 847,
            monthRevenue: 2340.00,
            weekRevenue: 540.00,
            status: 'active',
            availability: 'available'
        },
        {
            uid: 'barber_002',
            name: 'Dante Johnson',
            specialties: ['Classic Cut', 'Hot Towel Shave', 'Hair Color'],
            rating: 4.8,
            totalCuts: 634,
            monthRevenue: 1890.00,
            weekRevenue: 435.00,
            status: 'active',
            availability: 'busy'
        },
        {
            uid: 'barber_003',
            name: 'Rico Martinez',
            specialties: ['Taper Cut', 'Design Cuts', 'Fade'],
            rating: 4.7,
            totalCuts: 512,
            monthRevenue: 1540.00,
            weekRevenue: 355.00,
            status: 'active',
            availability: 'available'
        }
    ],

    reportes: {
        weekRevenue: [850, 920, 880, 950, 1020, 890, 340], // Lun-Dom
        monthRevenue: 28500.00,
        lastMonthRevenue: 26300.00,
        topServices: [
            { name: 'Fresh Fade', count: 142, revenue: 4970.00 },
            { name: 'Beard Trim', count: 98, revenue: 1960.00 },
            { name: 'Hot Towel Shave', count: 76, revenue: 2660.00 },
            { name: 'Classic Cut', count: 64, revenue: 2240.00 }
        ],
        topBarberos: [
            { name: 'Marcus Williams', cuts: 847, revenue: 2340.00, rating: 4.9 },
            { name: 'Dante Johnson', cuts: 634, revenue: 1890.00, rating: 4.8 },
            { name: 'Rico Martinez', cuts: 512, revenue: 1540.00, rating: 4.7 }
        ]
    }
};

console.log('✓ Admin Mock Data loaded');
