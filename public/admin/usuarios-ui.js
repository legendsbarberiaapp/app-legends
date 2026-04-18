/**
 * ADMIN - Gestión de usuarios
 * Renderizado de la lista de usuarios en el panel de administración
 * y cambio de roles (cliente <-> barbero).
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

        const admins = users.filter(u => u.role === 'admin');
        const barberos = users.filter(u => u.role === 'barbero');
        const clientes = users.filter(u => u.role === 'cliente');

        let html = '';

        if (admins.length > 0) {
            html += renderUserSection('Administrador', admins, 'admin_panel_settings', 'red');
        }
        html += renderUserSection('Barberos', barberos, 'content_cut', 'primary', true);
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
            const isAdmin = typeof isAdminEmail === 'function' ? isAdminEmail(user.email) : (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());

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

            if (isAdmin) {
                html += `
                    <span class="px-2 py-1 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-black uppercase border border-red-500/30">
                        Protegido
                    </span>
                `;
            } else if (user.role === 'barbero') {
                html += `
                    <span class="px-2 py-1 rounded-lg bg-primary/20 text-primary text-[10px] font-black uppercase border border-primary/30">
                        <span class="material-symbols-outlined text-[10px] align-middle mr-0.5" style="font-variation-settings: 'FILL' 1">content_cut</span>
                        Barbero
                    </span>
                `;
            } else {
                html += `
                    <span class="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400/60 text-[10px] font-bold uppercase border border-blue-500/20">
                        Usuario
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

async function toggleUserRole(uid, newRole) {
    if (!confirm(`¿Cambiar usuario a ${newRole.toUpperCase()}?`)) return;

    const success = await firebaseAdapter.setUserRole(uid, newRole);
    if (success) {
        await loadUsersForAdmin();
    } else {
        alert('Error al cambiar el rol');
    }
}

window.loadUsersForAdmin = loadUsersForAdmin;
window.toggleUserRole = toggleUserRole;
