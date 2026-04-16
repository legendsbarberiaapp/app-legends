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
    console.log('✓ Toast component loaded');
})();
