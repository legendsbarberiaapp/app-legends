/**
 * LEGENDS BARBERIA - TOAST
 * Componente reutilizable de notificaciones. Expone `window.showToast(message, type)`.
 * type: 'success' | 'error' | 'info'
 */

(function () {
    'use strict';

    const ICONS = { success: 'check_circle', error: 'error', info: 'info' };
    const COLORS = {
        success: 'text-green-400',
        error: 'text-red-400',
        info: 'text-primary',
    };
    const BGS = {
        success: 'from-green-500/20 to-green-500/5 border-green-500/30',
        error: 'from-red-500/20 to-red-500/5 border-red-500/30',
        info: 'from-primary/20 to-primary/5 border-primary/30',
    };

    function showToast(message, type = 'success') {
        const existing = document.querySelector('.barber-toast');
        if (existing) existing.remove();

        const icon = ICONS[type] || ICONS.success;
        const color = COLORS[type] || COLORS.success;
        const bg = BGS[type] || BGS.success;

        const toast = document.createElement('div');
        toast.className = 'barber-toast';
        toast.innerHTML = `
            <div class="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-gradient-to-r ${bg} border backdrop-blur-xl shadow-2xl">
                <span class="material-symbols-outlined ${color} text-lg" style="font-variation-settings: 'FILL' 1">${icon}</span>
                <span class="text-white text-sm font-bold">${message}</span>
            </div>
        `;

        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('visible'));

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    window.showToast = showToast;

    /**
     * Confirmación on-brand reutilizable (reemplaza window.confirm()).
     * Devuelve Promise<boolean>. Usa .barber-modal-overlay/.barber-confirm-dialog.
     * opts: { title, message, confirmText='Confirmar', cancelText='Cancelar',
     *         danger=false, icon }
     * danger=true → acento rojo (acciones destructivas: eliminar/cancelar).
     */
    function uiEsc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function uiConfirm(opts) {
        const o = opts || {};
        const danger = !!o.danger;
        const icon = o.icon || (danger ? 'warning' : 'help');
        const confirmText = o.confirmText || 'Confirmar';
        const cancelText = o.cancelText || 'Cancelar';
        const boxCls = danger ? 'bg-red-500/15 border-red-500/30' : 'bg-primary/15 border-primary/30';
        const icCls = danger ? 'text-red-400' : 'text-primary';
        const okCls = danger
            ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
            : 'bg-primary text-black hover:bg-primary-light';
        return new Promise((resolve) => {
            const existing = document.getElementById('ui-confirm-overlay');
            if (existing) existing.remove();
            const overlay = document.createElement('div');
            overlay.id = 'ui-confirm-overlay';
            overlay.className = 'barber-modal-overlay';
            overlay.style.zIndex = '200';
            overlay.innerHTML = `
                <div class="barber-confirm-dialog" style="max-width:400px">
                    <div class="w-16 h-16 rounded-2xl ${boxCls} border flex items-center justify-center mx-auto mb-4">
                        <span class="material-symbols-outlined ${icCls} text-3xl" style="font-variation-settings: 'FILL' 1">${uiEsc(icon)}</span>
                    </div>
                    <h3 class="text-white font-black text-lg text-center mb-2">${uiEsc(o.title || '¿Confirmar?')}</h3>
                    ${o.message ? `<p class="text-white/50 text-sm text-center mb-6">${uiEsc(o.message)}</p>` : '<div class="mb-6"></div>'}
                    <div class="flex gap-3">
                        <button data-act="cancel" class="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">${uiEsc(cancelText)}</button>
                        <button data-act="ok" class="flex-1 px-4 py-3 rounded-xl ${okCls} text-sm font-black uppercase tracking-wide transition-all active:scale-[0.97]">${uiEsc(confirmText)}</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            // setTimeout (no rAF): la animación debe correr aunque la pestaña esté en segundo plano.
            setTimeout(() => overlay.classList.add('visible'), 10);
            const close = (val) => {
                overlay.classList.remove('visible');
                setTimeout(() => overlay.remove(), 250);
                resolve(val);
            };
            overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
            overlay.querySelector('[data-act="ok"]').addEventListener('click', () => close(true));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
        });
    }
    window.uiConfirm = uiConfirm;

    console.log('✓ Toast component loaded');
})();
