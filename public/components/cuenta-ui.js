/**
 * LEGENDS BARBERIA - CUENTA UI (compartido) — F8-fix
 *
 * Tab "Mi Cuenta" usada por recepcionista y barbero. Muestra avatar +
 * nombre + email + badges contextuales (rol/sede/nivel) + botón Cerrar
 * sesión. Antes del fix, esos roles NO tenían cómo cerrar sesión en
 * móvil/PWA — el botón de logout solo estaba en el sidebar de desktop.
 *
 * El partial /screens/shared/cuenta.html es genérico; este módulo lo
 * llena según rol detectado en roleManager.currentUser.role.
 */
(function () {
    'use strict';

    const NIVEL_META = {
        Leyenda:     { color: 'text-primary',      bg: 'bg-primary/15',      border: 'border-primary/30',      icon: 'emoji_events' },
        Profesional: { color: 'text-purple-400',   bg: 'bg-purple-500/15',   border: 'border-purple-500/30',   icon: 'military_tech' },
        Experto:     { color: 'text-blue-400',     bg: 'bg-blue-500/15',     border: 'border-blue-500/30',     icon: 'workspace_premium' }
    };

    const ROL_META = {
        admin:         { label: 'Administrador', color: 'text-red-400',    bg: 'bg-red-500/15',    border: 'border-red-500/30',    icon: 'admin_panel_settings' },
        barbero:       { label: 'Barbero',       color: 'text-primary',    bg: 'bg-primary/15',    border: 'border-primary/30',    icon: 'content_cut' },
        recepcionista: { label: 'Recepcionista', color: 'text-green-400',  bg: 'bg-green-500/15',  border: 'border-green-500/30',  icon: 'support_agent' },
        cliente:       { label: 'Cliente',       color: 'text-blue-400',   bg: 'bg-blue-500/15',   border: 'border-blue-500/30',   icon: 'person' }
    };

    function getCurrentUser() {
        return (typeof roleManager !== 'undefined') ? roleManager.currentUser : null;
    }

    function badge(meta, label) {
        return `
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${meta.bg} ${meta.color} ${meta.border}">
                <span class="material-symbols-outlined text-[12px]" style="font-variation-settings: 'FILL' 1">${meta.icon}</span>
                ${label}
            </span>`;
    }

    function detalleRow(icon, label, value) {
        return `
            <div class="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div class="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1">${icon}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-white/45 text-[10px] font-black uppercase tracking-wider">${label}</p>
                    <p class="text-white text-sm font-bold truncate">${value || '—'}</p>
                </div>
            </div>`;
    }

    async function init() {
        const user = getCurrentUser();
        if (!user) return;

        const nombre = user.displayName || 'Usuario';
        const email = user.email || '';
        const photo = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=c9a74a&color=000&size=200&bold=true`;
        const rol = user.role || 'cliente';

        // El partial compartido se monta en 2 tabs distintos (barbero +
        // recepcionista). Si ambos quedaron cargados (ej. usuario que cambia
        // de rol en la misma sesión), los IDs se duplicarían en el DOM.
        // Escopeamos las queries al tab ACTIVO para escribir siempre en el
        // partial visible.
        const activeTab = document.querySelector('.tab-content.active');
        const scope = activeTab || document;
        const q = (id) => scope.querySelector ? scope.querySelector('#' + id) : document.getElementById(id);

        const avatarEl = q('cuenta-avatar');
        const nombreEl = q('cuenta-nombre');
        const emailEl = q('cuenta-email');
        const badgesEl = q('cuenta-badges');
        const detallesEl = q('cuenta-detalles');

        if (avatarEl) avatarEl.src = photo;
        if (nombreEl) nombreEl.textContent = nombre;
        if (emailEl) emailEl.textContent = email;

        // Badges arriba (rol siempre, nivel si es barbero)
        const badges = [];
        const rolMeta = ROL_META[rol] || ROL_META.cliente;
        badges.push(badge(rolMeta, rolMeta.label));

        if (rol === 'barbero') {
            // Intentar resolver nivel del doc de barbero
            try {
                if (typeof BarbersService !== 'undefined') {
                    const todos = await BarbersService.list();
                    const mi = todos.find(b => b.userId === user.uid);
                    if (mi?.nivel && NIVEL_META[mi.nivel]) {
                        badges.push(badge(NIVEL_META[mi.nivel], mi.nivel));
                    }
                }
            } catch (e) { /* silencio */ }
        }
        if (badgesEl) badgesEl.innerHTML = badges.join('');

        // Detalles según rol
        const detalles = [];

        if (rol === 'recepcionista') {
            // Sede asignada
            let sedeNombre = 'Sin sede asignada';
            try {
                if (user.sedeId && typeof SedesService !== 'undefined') {
                    const sedes = await SedesService.list();
                    sedeNombre = SedesService.nombreById(sedes, user.sedeId) || 'Sin sede asignada';
                }
            } catch (e) { /* silencio */ }
            detalles.push(detalleRow('storefront', 'Sede asignada', sedeNombre));
        }

        if (rol === 'barbero') {
            // Intentar mostrar la sede del barbero también
            try {
                if (typeof BarbersService !== 'undefined' && typeof SedesService !== 'undefined') {
                    const [todos, sedes] = await Promise.all([BarbersService.list(), SedesService.list()]);
                    const mi = todos.find(b => b.userId === user.uid);
                    const sedeNombre = mi?.sedeId ? (SedesService.nombreById(sedes, mi.sedeId) || 'Sin sede') : 'Sin sede';
                    detalles.push(detalleRow('storefront', 'Sede', sedeNombre));
                }
            } catch (e) { /* silencio */ }
        }

        if (detallesEl) detallesEl.innerHTML = detalles.join('');
    }

    // Expose
    window.initCuenta = init;

    console.log('✓ CuentaUI (compartido) loaded');
})();
