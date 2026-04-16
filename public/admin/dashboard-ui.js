/**
 * ADMIN - Dashboard
 * Carga de estadísticas reales desde Firestore para el tab admin-dashboard.
 */

async function loadDashboardStats() {
    try {
        if (!firebaseAdapter || !firebaseAdapter.db) return;

        const usersSnapshot = await firebaseAdapter.db.collection('users').get();
        const totalUsers = usersSnapshot.size;
        const el1 = document.getElementById('dash-usuarios');
        if (el1) el1.textContent = totalUsers;

        const barbersSnapshot = await firebaseAdapter.db.collection('barberos').get();
        const totalBarbers = barbersSnapshot.size;
        const el2 = document.getElementById('dash-barberos');
        if (el2) el2.textContent = totalBarbers;

    } catch (error) {
        console.error('Error cargando stats del dashboard:', error);
    }
}

window.loadDashboardStats = loadDashboardStats;
