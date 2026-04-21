/**
 * ADMIN - Gestión de usuarios
 *
 * Secciones colapsables con lazy-load:
 *   - Al entrar a la pantalla NO se lee nada de Firestore.
 *   - Cada sección (Admin / Barberos / Clientes) se abre on-demand y
 *     dispara un query filtrado `where('role','==',...)`.
 *   - Los resultados se cachean en memoria por la sesión. Refresh por sección.
 *   - Desde cada card se puede cambiar el rol del usuario
 *     (salvo admins hardcodeados → badge "Protegido").
 */

(function () {
    'use strict';

    const ROLE_ORDER = ['admin', 'barbero', 'cliente'];

    const ROLE_META = {
        admin: {
            titulo: 'Administradores',
            icon: 'admin_panel_settings',
            colorKey: 'red',
            badgeLabel: 'Admin',
            badgeIcon: 'admin_panel_settings'
        },
        barbero: {
            titulo: 'Barberos',
            icon: 'content_cut',
            colorKey: 'primary',
            badgeLabel: 'Barbero',
            badgeIcon: 'content_cut'
        },
        cliente: {
            titulo: 'Clientes',
            icon: 'person',
            colorKey: 'blue',
            badgeLabel: 'Cliente',
            badgeIcon: 'person'
        }
    };

    const COLOR_MAP = {
        red:     { chip: 'bg-red-500/10 text-red-400 border-red-500/30',     soft: 'bg-red-500/5 border-red-500/15',     ring: 'border-red-500/35' },
        primary: { chip: 'bg-primary/15 text-primary border-primary/30',     soft: 'bg-primary/5 border-primary/15',     ring: 'border-primary/35' },
        blue:    { chip: 'bg-blue-500/10 text-blue-400 border-blue-500/30', soft: 'bg-blue-500/5 border-blue-500/15',   ring: 'border-blue-500/35' }
    };

    // Estado en memoria: por rol, { loaded, loading, users }
    const sectionState = {
        admin:   { loaded: false, loading: false, users: [] },
        barbero: { loaded: false, loading: false, users: [] },
        cliente: { loaded: false, loading: false, users: [] }
    };

    // --------- Render del shell (secciones colapsadas) ---------

    async function loadUsersForAdmin() {
        const container = document.getElementById('admin-users-list');
        if (!container) return;

        container.innerHTML = ROLE_ORDER.map(role => renderSectionShell(role)).join('');
        console.log('✓ Secciones de usuarios renderizadas (colapsadas, sin carga)');
    }

    function renderSectionShell(role) {
        const meta = ROLE_META[role];
        const c = COLOR_MAP[meta.colorKey];
        const state = sectionState[role];

        const chevron = state.loaded && state.expanded ? 'expand_less' : 'expand_more';
        const countBadge = state.loaded
            ? `<span class="px-2 py-0.5 rounded-full ${c.chip} text-[10px] font-black border" data-count-badge>${state.users.length}</span>`
            : `<span class="px-2 py-0.5 rounded-full bg-white/5 text-white/35 text-[10px] font-black border border-white/10" data-count-badge>—</span>`;

        return `
            <section class="mb-4 rounded-2xl border ${c.soft}" data-usuarios-section="${role}">
                <div class="flex items-center gap-3 p-4 rounded-2xl hover:bg-white/[0.03] transition-colors">
                    <button type="button" onclick="toggleUserSection('${role}')"
                        class="flex-1 flex items-center gap-3 text-left min-w-0 cursor-pointer">
                        <span class="material-symbols-outlined text-xl text-white/80 flex-shrink-0" style="font-variation-settings: 'FILL' 1">${meta.icon}</span>
                        <h3 class="flex-1 text-white font-black text-sm uppercase tracking-wider truncate">${meta.titulo}</h3>
                        ${countBadge}
                        <span class="material-symbols-outlined text-2xl text-white/60 transition-transform flex-shrink-0" data-chevron>${chevron}</span>
                    </button>
                    <button type="button" onclick="refreshUserSection('${role}')"
                        class="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-primary hover:border-primary/30 transition-all active:scale-95 flex items-center justify-center flex-shrink-0"
                        title="Recargar esta sección">
                        <span class="material-symbols-outlined text-sm">refresh</span>
                    </button>
                </div>
                <div class="hidden px-3 pb-3" data-usuarios-body></div>
            </section>
        `;
    }

    // --------- Toggle + Lazy load ---------

    async function toggleUserSection(role) {
        const section = document.querySelector(`[data-usuarios-section="${role}"]`);
        if (!section) return;

        const body = section.querySelector('[data-usuarios-body]');
        const chevron = section.querySelector('[data-chevron]');
        const isOpen = !body.classList.contains('hidden');

        if (isOpen) {
            body.classList.add('hidden');
            if (chevron) chevron.textContent = 'expand_more';
            sectionState[role].expanded = false;
            return;
        }

        // Abrir
        body.classList.remove('hidden');
        if (chevron) chevron.textContent = 'expand_less';
        sectionState[role].expanded = true;

        // Si ya está cargado, solo render desde caché
        if (sectionState[role].loaded) {
            renderSectionBody(role);
            return;
        }

        await fetchAndRenderSection(role);
    }

    async function refreshUserSection(role) {
        sectionState[role].loaded = false;
        const section = document.querySelector(`[data-usuarios-section="${role}"]`);
        if (!section) return;
        const body = section.querySelector('[data-usuarios-body]');
        const chevron = section.querySelector('[data-chevron]');

        // Asegurarse de que quede abierta
        body.classList.remove('hidden');
        if (chevron) chevron.textContent = 'expand_less';
        sectionState[role].expanded = true;

        await fetchAndRenderSection(role);
        rerenderCountBadge(role);
    }

    async function fetchAndRenderSection(role) {
        const section = document.querySelector(`[data-usuarios-section="${role}"]`);
        if (!section) return;
        const body = section.querySelector('[data-usuarios-body]');

        body.innerHTML = `
            <div class="flex flex-col items-center gap-2 py-6">
                <div class="auth-checking-spinner"></div>
                <p class="text-white/50 text-xs">Cargando ${ROLE_META[role].titulo.toLowerCase()}...</p>
            </div>
        `;

        sectionState[role].loading = true;
        try {
            const users = await firebaseAdapter.getUsersByRole(role);
            sectionState[role].users = users;
            sectionState[role].loaded = true;
            sectionState[role].loading = false;
            renderSectionBody(role);
            rerenderCountBadge(role);
        } catch (error) {
            sectionState[role].loading = false;
            console.error(`❌ Error cargando ${role}:`, error);
            body.innerHTML = `
                <div class="flex flex-col items-center gap-2 py-6">
                    <span class="material-symbols-outlined text-red-400 text-3xl">error</span>
                    <p class="text-red-400 text-xs">Error al cargar</p>
                    <button onclick="refreshUserSection('${role}')"
                        class="mt-1 px-3 py-1.5 bg-primary/15 text-primary text-[10px] font-black uppercase tracking-wider rounded-lg border border-primary/30 hover:bg-primary/25 transition-all">
                        Reintentar
                    </button>
                </div>
            `;
        }
    }

    function rerenderCountBadge(role) {
        const section = document.querySelector(`[data-usuarios-section="${role}"]`);
        if (!section) return;
        const meta = ROLE_META[role];
        const c = COLOR_MAP[meta.colorKey];
        const state = sectionState[role];
        const badge = section.querySelector('[data-count-badge]');
        if (!badge) return;
        badge.className = `px-2 py-0.5 rounded-full ${c.chip} text-[10px] font-black border`;
        badge.textContent = state.users.length;
    }

    function renderSectionBody(role) {
        const section = document.querySelector(`[data-usuarios-section="${role}"]`);
        if (!section) return;
        const body = section.querySelector('[data-usuarios-body]');
        const users = sectionState[role].users;

        if (!users.length) {
            body.innerHTML = `
                <p class="text-white/30 text-xs text-center py-5">Sin usuarios en este grupo</p>
            `;
            return;
        }

        body.innerHTML = `
            <div class="space-y-2 usuarios-grid">
                ${users.map(u => renderUserCard(u, role)).join('')}
            </div>
        `;
    }

    // --------- Card de usuario ---------

    function renderUserCard(user, currentRole) {
        const meta = ROLE_META[currentRole];
        const c = COLOR_MAP[meta.colorKey];
        const uid = user.uid;
        const nombre = user.displayName || 'Sin nombre';
        const email = user.email || 'Sin email';
        const foto = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=c9a74a&color=000&size=80`;
        const isProtected = typeof isAdminEmail === 'function' && isAdminEmail(email);

        const actions = isProtected
            ? `<span class="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-black uppercase border border-red-500/30 flex items-center gap-1">
                <span class="material-symbols-outlined text-[12px]" style="font-variation-settings: 'FILL' 1">lock</span>
                Protegido
               </span>`
            : renderRoleActions(uid, currentRole);

        return `
            <div class="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors border border-white/[0.05]" data-uid="${uid}">
                <img src="${foto}" alt="" loading="lazy" referrerpolicy="no-referrer"
                    onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=c9a74a&color=000&size=80';"
                    class="w-10 h-10 rounded-full object-cover border-2 ${c.ring} flex-shrink-0">
                <div class="min-w-0 flex-1">
                    <p class="text-white font-bold text-sm truncate">${nombre}</p>
                    <p class="text-white/40 text-[11px] truncate">${email}</p>
                </div>
                <div class="flex items-center gap-2 flex-wrap justify-end">
                    ${actions}
                </div>
            </div>
        `;
    }

    function renderRoleActions(uid, currentRole) {
        // Botones para los roles a los que PUEDE cambiar
        const btns = ROLE_ORDER.filter(r => r !== currentRole).map(r => {
            const meta = ROLE_META[r];
            const c = COLOR_MAP[meta.colorKey];
            return `
                <button type="button" onclick="changeUserRole('${uid}', '${r}', '${currentRole}')"
                    class="px-2.5 py-1.5 rounded-lg ${c.chip} text-[10px] font-black uppercase tracking-wider border hover:brightness-125 active:scale-95 transition-all flex items-center gap-1">
                    <span class="material-symbols-outlined text-[12px]" style="font-variation-settings: 'FILL' 1">${meta.badgeIcon}</span>
                    Hacer ${meta.badgeLabel}
                </button>
            `;
        }).join('');
        return btns;
    }

    // --------- Cambio de rol ---------

    async function changeUserRole(uid, newRole, fromRole) {
        const metaNew = ROLE_META[newRole];
        if (!metaNew) return;

        const confirmed = window.confirm(
            `¿Cambiar este usuario a ${metaNew.titulo.toUpperCase().replace('ES','').trim()}?\n` +
            `El cambio es inmediato.`
        );
        if (!confirmed) return;

        // Feedback visual en la card
        const card = document.querySelector(`[data-uid="${uid}"]`);
        if (card) {
            card.style.opacity = '0.6';
            card.style.pointerEvents = 'none';
        }

        try {
            const ok = await firebaseAdapter.setUserRole(uid, newRole);
            if (!ok) {
                if (typeof window.showToast === 'function') {
                    window.showToast('No se pudo cambiar el rol', 'error');
                } else {
                    alert('No se pudo cambiar el rol (¿es admin protegido?).');
                }
                if (card) { card.style.opacity = '1'; card.style.pointerEvents = 'auto'; }
                return;
            }

            // Mover usuario de una sección a otra SIN tocar Firestore
            const fromList = sectionState[fromRole].users;
            const idx = fromList.findIndex(u => u.uid === uid);
            let moved = null;
            if (idx >= 0) {
                moved = { ...fromList[idx], role: newRole };
                fromList.splice(idx, 1);
            }
            if (sectionState[newRole].loaded && moved) {
                sectionState[newRole].users.unshift(moved);
            }

            // Re-render de ambas secciones afectadas (solo si están cargadas/abiertas)
            if (sectionState[fromRole].loaded) {
                renderSectionBody(fromRole);
                rerenderCountBadge(fromRole);
            }
            if (sectionState[newRole].loaded) {
                renderSectionBody(newRole);
                rerenderCountBadge(newRole);
            }

            if (typeof window.showToast === 'function') {
                window.showToast(`Rol actualizado → ${metaNew.titulo}`, 'success');
            }
        } catch (error) {
            console.error('❌ Error cambiando rol:', error);
            alert('Error al cambiar el rol: ' + error.message);
            if (card) { card.style.opacity = '1'; card.style.pointerEvents = 'auto'; }
        }
    }

    // Exponer API global
    window.loadUsersForAdmin   = loadUsersForAdmin;
    window.toggleUserSection   = toggleUserSection;
    window.refreshUserSection  = refreshUserSection;
    window.changeUserRole      = changeUserRole;

    // Compat con la firma vieja (algunas llamadas usaban toggleUserRole)
    window.toggleUserRole = async (uid, newRole) => {
        // Buscamos el rol actual en caché para mantener coherencia; si no, reload completo.
        for (const r of ROLE_ORDER) {
            const found = sectionState[r].users.find(u => u.uid === uid);
            if (found) return changeUserRole(uid, newRole, r);
        }
        const ok = await firebaseAdapter.setUserRole(uid, newRole);
        if (ok) loadUsersForAdmin();
    };

    console.log('✓ admin/usuarios-ui (lazy sections) loaded');
})();
