/**
 * LEGENDS BARBERIA - MOCK DATA BARBERO
 * Datos de ejemplo para el panel de barbero
 */

const BARBERO_MOCK_DATA = {
    dashboard: {
        todayStats: {
            appointmentsToday: 8,
            completedToday: 5,
            pendingToday: 3,
            todayRevenue: 225.00,
            todayTips: 45.00
        },
        upcomingAppointments: [
            {
                id: 'apt_001',
                clientName: 'Alex Rodriguez',
                clientPhoto: null,
                service: 'Fresh Fade + Beard',
                time: '2:30 PM',
                duration: 45,
                price: 45.00,
                status: 'confirmed'
            },
            {
                id: 'apt_002',
                clientName: 'John Davis',
                clientPhoto: null,
                service: 'Classic Cut',
                time: '3:30 PM',
                duration: 30,
                price: 35.00,
                status: 'pending'
            },
            {
                id: 'apt_003',
                clientName: 'Mike Peterson',
                clientPhoto: null,
                service: 'Hot Towel Shave',
                time: '4:15 PM',
                duration: 30,
                price: 35.00,
                status: 'confirmed'
            }
        ],
        recentCompleted: [
            {
                id: 'apt_004',
                clientName: 'Carlos Ruiz',
                service: 'Fresh Fade',
                completedAt: '11:00 AM',
                price: 35.00,
                tip: 10.00,
                rating: 5
            },
            {
                id: 'apt_005',
                clientName: 'David Lee',
                service: 'Beard Trim',
                completedAt: '10:15 AM',
                price: 20.00,
                tip: 5.00,
                rating: 5
            }
        ]
    },

    appointments: {
        today: [
            {
                id: 'apt_001',
                clientName: 'Alex Rodriguez',
                service: 'Fresh Fade + Beard',
                time: '2:30 PM',
                duration: 45,
                price: 45.00,
                status: 'confirmed'
            },
            {
                id: 'apt_002',
                clientName: 'John Davis',
                service: 'Classic Cut',
                time: '3:30 PM',
                duration: 30,
                price: 35.00,
                status: 'pending'
            }
        ],
        week: [
            // Lunes
            { day: 'Lunes', date: '2024-02-19', appointments: 6, revenue: 270.00 },
            // Martes
            { day: 'Martes', date: '2024-02-20', appointments: 8, revenue: 360.00 },
            // Miércoles
            { day: 'Miércoles', date: '2024-02-21', appointments: 7, revenue: 315.00 }
        ]
    },

    services: [
        {
            id: 'srv_001',
            name: 'Fresh Fade',
            price: 35.00,
            duration: 30,
            active: true,
            timesBooked: 142
        },
        {
            id: 'srv_002',
            name: 'Beard Trim',
            price: 20.00,
            duration: 15,
            active: true,
            timesBooked: 98
        },
        {
            id: 'srv_003',
            name: 'Hot Towel Shave',
            price: 35.00,
            duration: 30,
            active: true,
            timesBooked: 76
        },
        {
            id: 'srv_004',
            name: 'Fresh Fade + Beard',
            price: 45.00,
            duration: 45,
            active: true,
            timesBooked: 64
        },
        {
            id: 'srv_005',
            name: 'Classic Cut',
            price: 35.00,
            duration: 30,
            active: true,
            timesBooked: 52
        },
        {
            id: 'srv_006',
            name: 'Taper Cut',
            price: 40.00,
            duration: 35,
            active: false,
            timesBooked: 12
        }
    ],

    stats: {
        weekRevenue: [150, 200, 180, 220, 245, 225, 120], // Lun-Dom
        monthRevenue: 2340.00,
        lastMonthRevenue: 2180.00,
        totalClients: 142,
        avgRating: 4.9,
        totalCuts: 847,
        topServices: [
            { name: 'Fresh Fade', count: 142, percentage: 35 },
            { name: 'Beard Trim', count: 98, percentage: 24 },
            { name: 'Hot Towel Shave', count: 76, percentage: 19 },
            { name: 'Fresh Fade + Beard', count: 64, percentage: 16 }
        ],
        frequentClients: [
            { name: 'Alex Rodriguez', visits: 12, lastVisit: '2 días atrás' },
            { name: 'Carlos Ruiz', visits: 10, lastVisit: 'Hoy' },
            { name: 'David Lee', visits: 8, lastVisit: '1 semana atrás' }
        ]
    }
};

console.log('✓ Barbero Mock Data loaded');
