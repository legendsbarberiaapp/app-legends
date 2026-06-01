/**
 * LEGENDS BARBERIA - BARBERO: TAB RESEÑAS (F6)
 *
 * Muestra al barbero las reseñas que recibió, con:
 *   - Promedio + total visible arriba
 *   - Distribución de estrellas (5,4,3,2,1) con barras
 *   - Lista de últimas 20 reseñas con cliente + estrellas + comentario
 */
(function () {
    'use strict';

    function getCurrentUser() {
        return (typeof roleManager !== 'undefined') ? roleManager.currentUser : null;
    }

    const state = { resenias: [] };

    async function init() {
        const list = document.getElementById('resenias-list');
        const stats = document.getElementById('resenias-stats');
        if (!list) return;

        const user = getCurrentUser();
        if (!user || !user.uid) {
            list.innerHTML = renderError('Sin sesión activa');
            return;
        }

        list.innerHTML = `
            <div class="flex flex-col items-center gap-3 py-10">
                <div class="auth-checking-spinner"></div>
                <p class="text-white/50 text-xs">Cargando reseñas...</p>
            </div>`;
        if (stats) stats.innerHTML = '';

        try {
            const resenias = await ReseniasService.listByBarbero(user.uid, 20);
            state.resenias = resenias || [];
            renderStats();
            renderList();
        } catch (e) {
            console.error('❌ Error cargando reseñas:', e);
            list.innerHTML = renderError('No se pudieron cargar las reseñas');
        }
    }

    function renderStats() {
        const container = document.getElementById('resenias-stats');
        if (!container) return;
        const resenias = state.resenias;

        if (resenias.length === 0) {
            container.innerHTML = `
                <div class="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <p class="text-white/55 text-sm text-center font-bold">Cuando un cliente te califique aparecerá acá ⭐</p>
                </div>`;
            return;
        }

        const total = resenias.length;
        const suma = resenias.reduce((s, r) => s + (Number(r.estrellas) || 0), 0);
        const promedio = total > 0 ? suma / total : 0;

        // Distribución
        const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        resenias.forEach(r => {
            const e = Number(r.estrellas);
            if (dist[e] !== undefined) dist[e]++;
        });
        const max = Math.max(...Object.values(dist), 1);

        const bars = [5, 4, 3, 2, 1].map(n => {
            const count = dist[n];
            const pct = max > 0 ? Math.round((count / max) * 100) : 0;
            return `
                <div class="flex items-center gap-2">
                    <span class="text-white/65 text-[10px] font-bold tabular-nums w-3">${n}</span>
                    <span class="material-symbols-outlined text-amber-400/80 text-[10px]" style="font-variation-settings: 'FILL' 1">star</span>
                    <div class="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                        <div class="h-full bg-amber-400/80 rounded-full transition-all" style="width:${pct}%"></div>
                    </div>
                    <span class="text-white/55 text-[10px] font-bold tabular-nums w-5 text-right">${count}</span>
                </div>`;
        }).join('');

        container.innerHTML = `
            <div class="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 border border-amber-500/25">
                <div class="flex items-center gap-4 mb-4">
                    <div class="text-center">
                        <p class="text-amber-300 text-4xl font-black leading-none tabular-nums">${promedio.toFixed(1)}</p>
                        <div class="flex items-center justify-center gap-0.5 mt-1">
                            ${[1,2,3,4,5].map(n => `
                                <span class="material-symbols-outlined text-amber-400 text-sm" style="font-variation-settings: 'FILL' ${n <= Math.round(promedio) ? 1 : 0}">star</span>
                            `).join('')}
                        </div>
                        <p class="text-white/55 text-[10px] font-bold uppercase tracking-wider mt-1">${total} reseña${total === 1 ? '' : 's'}</p>
                    </div>
                    <div class="flex-1 space-y-1.5">
                        ${bars}
                    </div>
                </div>
            </div>`;
    }

    function renderList() {
        const container = document.getElementById('resenias-list');
        if (!container) return;
        const resenias = state.resenias;

        if (resenias.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <p class="text-white/45 text-[10px] font-black uppercase tracking-[0.3em] mb-2 pl-1">Comentarios</p>
            <div class="space-y-2">
                ${resenias.map(reseniaCard).join('')}
            </div>`;
    }

    function reseniaCard(r) {
        const e = Number(r.estrellas) || 0;
        const cliente = r.clienteNombre || 'Cliente';
        const initial = (cliente.trim().charAt(0) || 'C').toUpperCase();
        const photo = r.clientePhotoURL || '';
        const photoEl = photo
            ? `<img src="${photo.replace(/=s\d+(-c)?/g, '=s96-c')}" alt="" referrerpolicy="no-referrer"
                  class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300"
                  onload="this.style.opacity=1" onerror="this.remove()">`
            : '';

        const stars = [1,2,3,4,5].map(n => `
            <span class="material-symbols-outlined text-amber-400 text-[12px]" style="font-variation-settings: 'FILL' ${n <= e ? 1 : 0}">star</span>
        `).join('');

        let fechaTxt = '';
        if (r.createdAt) {
            const d = r.createdAt.toDate
                ? r.createdAt.toDate()
                : (r.createdAt.seconds ? new Date(r.createdAt.seconds * 1000) : null);
            if (d) {
                fechaTxt = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
            }
        }

        const comentario = (r.comentario || '').trim();
        const comentarioBlock = comentario
            ? `<p class="text-white/75 text-sm mt-2 leading-relaxed">${escapeHTML(comentario)}</p>`
            : '';

        return `
            <div class="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div class="flex items-start gap-3">
                    <div class="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white/10 bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center shrink-0">
                        <span class="text-black text-sm font-black">${initial}</span>
                        ${photoEl}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-2">
                            <p class="text-white text-sm font-bold truncate">${escapeHTML(cliente)}</p>
                            <span class="text-white/35 text-[10px] font-bold shrink-0">${fechaTxt}</span>
                        </div>
                        <div class="flex items-center gap-0.5 mt-1">${stars}</div>
                        ${comentarioBlock}
                    </div>
                </div>
            </div>`;
    }

    /** Helper para escapar comentarios y nombres (evita XSS desde texto de cliente). */
    function escapeHTML(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderError(msg) {
        return `
            <div class="text-center py-10 px-6 rounded-xl bg-red-500/5 border border-red-500/15">
                <span class="material-symbols-outlined text-red-400 text-4xl mb-2">error</span>
                <p class="text-red-400 text-sm font-bold">${msg}</p>
                <button onclick="initBarberoResenias()" class="mt-4 px-4 py-2 bg-primary/20 text-primary text-xs font-black rounded-lg border border-primary/30">
                    Reintentar
                </button>
            </div>`;
    }

    window.initBarberoResenias = init;
    window.reloadBarberoResenias = init;

    console.log('✓ BarberoReseniasUI (F6) loaded');
})();
