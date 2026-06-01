/**
 * LEGENDS BARBERIA - CLIENTE: MODAL DE RESEÑA (F6)
 *
 * Overlay para calificar al barbero después de una cita completada.
 * Se abre desde el perfil del cliente con `openReseniaModal(cita)`.
 *
 * UI: 5 estrellas táctiles + textarea opcional (max 500) + Submit.
 * Submit llama a ReseniasService.create que es atómico (cita + barbero + reseña).
 *
 * Tras éxito: callback `onReseniaCreada(citaId)` que el perfil usa para
 * marcar la cita en memoria como reviewed y re-renderizar.
 */
(function () {
    'use strict';

    const ctx = {
        cita: null,
        estrellas: 0,
        comentario: ''
    };

    function getCurrentUser() {
        return (typeof roleManager !== 'undefined') ? roleManager.currentUser : null;
    }

    function open(cita) {
        if (!cita || cita.estado !== 'completada') return;
        if (cita.reviewed === true) {
            if (typeof window.showToast === 'function') {
                window.showToast('Esta cita ya fue calificada', 'info');
            }
            return;
        }

        ctx.cita = cita;
        ctx.estrellas = 0;
        ctx.comentario = '';

        const existing = document.getElementById('resenia-overlay');
        if (existing) existing.remove();

        const barberoNombre = cita.barberoNombre || 'Barbero';
        const html = `
        <div id="resenia-overlay" class="barber-modal-overlay" style="z-index:150">
            <div class="barber-confirm-dialog" style="max-width:440px">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                        <span class="material-symbols-outlined text-amber-400 text-lg" style="font-variation-settings: 'FILL' 1">star</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="text-white font-black text-base">Calificá tu corte</h3>
                        <p class="text-white/40 text-[10px] uppercase tracking-wider font-bold truncate">Con ${barberoNombre}</p>
                    </div>
                </div>

                <p class="text-white/60 text-xs mb-3 pl-1">¿Cómo estuvo?</p>
                <div id="resenia-stars" class="flex items-center justify-center gap-2 mb-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.05]"></div>
                <p id="resenia-stars-label" class="text-white/40 text-[11px] font-bold text-center mb-4 -mt-2"></p>

                <p class="text-white/60 text-xs mb-2 pl-1">Comentario <span class="text-white/30 text-[10px] font-normal">(opcional)</span></p>
                <textarea id="resenia-comentario" maxlength="500" rows="3" placeholder="Contale a otros clientes qué tal estuvo el corte..."
                    class="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium outline-none focus:border-primary/50 transition-colors placeholder:text-white/20 resize-none mb-1"></textarea>
                <div class="flex justify-end mb-4">
                    <span id="resenia-charcount" class="text-white/30 text-[10px] tabular-nums">0 / 500</span>
                </div>

                <div class="flex gap-2">
                    <button onclick="closeReseniaModal()" class="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Más tarde
                    </button>
                    <button id="resenia-submit" onclick="submitResenia()" disabled
                        class="flex-1 px-4 py-3 rounded-xl bg-primary text-black text-sm font-black uppercase tracking-wider hover:bg-yellow-500 transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed">
                        Enviar
                    </button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => document.getElementById('resenia-overlay')?.classList.add('visible'));

        renderStars();
        wireComentario();
    }

    function close() {
        const overlay = document.getElementById('resenia-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 250);
        }
    }

    function renderStars() {
        const container = document.getElementById('resenia-stars');
        const label = document.getElementById('resenia-stars-label');
        if (!container) return;

        container.innerHTML = [1, 2, 3, 4, 5].map(n => {
            const filled = n <= ctx.estrellas;
            return `
                <button type="button" onclick="setReseniaStars(${n})" aria-label="${n} estrella${n > 1 ? 's' : ''}"
                    class="w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90 ${filled ? 'bg-amber-500/20' : 'hover:bg-white/[0.05]'}">
                    <span class="material-symbols-outlined ${filled ? 'text-amber-400' : 'text-white/25'} text-3xl" style="font-variation-settings: 'FILL' ${filled ? 1 : 0}, 'wght' 600">star</span>
                </button>`;
        }).join('');

        const labels = ['', 'Muy mal', 'Mal', 'Regular', 'Bueno', 'Excelente'];
        if (label) label.textContent = labels[ctx.estrellas] || 'Tocá una estrella';

        const submit = document.getElementById('resenia-submit');
        if (submit) submit.disabled = ctx.estrellas === 0;
    }

    function wireComentario() {
        const textarea = document.getElementById('resenia-comentario');
        const counter = document.getElementById('resenia-charcount');
        if (!textarea) return;
        textarea.addEventListener('input', () => {
            ctx.comentario = textarea.value;
            if (counter) counter.textContent = `${textarea.value.length} / 500`;
        });
    }

    function setStars(n) {
        if (n < 1 || n > 5) return;
        ctx.estrellas = n;
        renderStars();
    }

    async function submit() {
        if (ctx.estrellas < 1) return;
        const user = getCurrentUser();
        if (!user || !user.uid) {
            if (typeof window.showToast === 'function') window.showToast('Sin sesión activa', 'error');
            return;
        }

        const btn = document.getElementById('resenia-submit');
        const orig = btn?.innerHTML;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<div class="auth-checking-spinner" style="width:1.2rem;height:1.2rem;border-width:2px;margin:0 auto"></div>';
        }

        const reseniaId = await ReseniasService.create({
            citaId: ctx.cita.id,
            barberoId: ctx.cita.barberoId,
            barberoDocId: await resolveBarberoDocId(ctx.cita.barberoId),
            barberoNombre: ctx.cita.barberoNombre || '',
            clienteId: user.uid,
            clienteNombre: user.displayName || 'Cliente',
            clientePhotoURL: user.photoURL || null,
            estrellas: ctx.estrellas,
            comentario: ctx.comentario,
            sedeId: ctx.cita.sedeId || null
        });

        if (btn) { btn.disabled = false; btn.innerHTML = orig; }

        if (!reseniaId) {
            if (typeof window.showToast === 'function') {
                window.showToast('No se pudo enviar la reseña', 'error');
            }
            return;
        }

        if (typeof window.showToast === 'function') {
            window.showToast(`Gracias por tu reseña ⭐`, 'success');
        }
        close();
        if (typeof window.onReseniaCreada === 'function') {
            window.onReseniaCreada(ctx.cita.id);
        }
    }

    /**
     * Helper: resolver el docId del barbero a partir de su userId. Esto es
     * necesario porque la cita guarda `barberoId` como userId (auth uid) y
     * el doc de barberos vive en `barberos/{docId}`.
     * Cacheado en module para no hacer la query 2 veces seguidas.
     */
    let barberosCache = null;
    async function resolveBarberoDocId(userId) {
        if (!userId) return null;
        if (!barberosCache && typeof BarbersService !== 'undefined') {
            try { barberosCache = await BarbersService.list(); } catch (_) { barberosCache = []; }
        }
        const b = (barberosCache || []).find(x => x.userId === userId);
        return b?.id || null;
    }

    window.openReseniaModal = open;
    window.closeReseniaModal = close;
    window.setReseniaStars = setStars;
    window.submitResenia = submit;

    console.log('✓ ReseniaModalUI (F6) loaded');
})();
