/**
 * LEGENDS BARBERIA - ADMIN: CONFIRM DELETE DIALOG
 * Diálogo de confirmación para eliminar un barbero.
 * Extiende BarberManager.prototype.
 */

(function () {
    'use strict';

    if (typeof BarberManager === 'undefined') {
        console.error('❌ confirm-dialog-ui: BarberManager no está definido.');
        return;
    }

    BarberManager.prototype.confirmDeleteBarber = function (id, name) {
        const existing = document.getElementById('barber-confirm-overlay');
        if (existing) existing.remove();

        const html = `
        <div id="barber-confirm-overlay" class="barber-modal-overlay" onclick="barberManager.closeConfirm(event)">
            <div class="barber-confirm-dialog" onclick="event.stopPropagation()">
                <div class="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                    <span class="material-symbols-outlined text-red-400 text-3xl">delete_forever</span>
                </div>
                <h3 class="text-white font-black text-lg text-center mb-2">¿Eliminar barbero?</h3>
                <p class="text-white/50 text-sm text-center mb-6">Se eliminará a <strong class="text-white">${name}</strong> y toda su información. Esta acción no se puede deshacer.</p>
                <div class="flex gap-3">
                    <button onclick="barberManager.closeConfirmDialog()" class="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Cancelar
                    </button>
                    <button onclick="barberManager.executeDelete('${id}')" class="flex-1 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-black uppercase tracking-wide hover:bg-red-500/30 transition-all active:scale-[0.97]">
                        Eliminar
                    </button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => {
            document.getElementById('barber-confirm-overlay')?.classList.add('visible');
        });
    };

    BarberManager.prototype.closeConfirm = function (event) {
        if (event.target.id === 'barber-confirm-overlay') {
            this.closeConfirmDialog();
        }
    };

    BarberManager.prototype.closeConfirmDialog = function () {
        const overlay = document.getElementById('barber-confirm-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
    };

    BarberManager.prototype.executeDelete = async function (id) {
        this.closeConfirmDialog();
        const success = await this.deleteBarber(id);
        if (success) {
            this.showToast('Barbero eliminado', 'success');
        } else {
            this.showToast('Error al eliminar', 'error');
        }
    };

    console.log('✓ admin/confirm-dialog-ui loaded');
})();
