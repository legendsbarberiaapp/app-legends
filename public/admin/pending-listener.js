/**
 * LEGENDS BARBERIA - PENDING LISTENER (ADMIN)
 * Escucha en tiempo real las citas con estado 'pendiente'.
 * Cuando llega una nueva: suena un ping, muestra toast + notificación
 * del SO, y se re-renderiza la lista del dashboard.
 */

(function () {
    'use strict';

    let unsubscribe = null;
    const knownIds = new Set();
    let isFirstSnapshot = true;

    /**
     * Beep corto (880Hz) con Web Audio API. Sin archivos de audio externos.
     */
    function playPing() {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) {
            // Silencioso: el navegador puede bloquear audio hasta interacción
        }
    }

    function notifyNew(cita) {
        const body = `${cita.clienteNombre || 'Cliente'} reservó con ${cita.barberoNombre || 'un barbero'}`;
        if (typeof window.showToast === 'function') {
            window.showToast(`Nueva reserva: ${body}`, 'info');
        }
        if (window.Notifications) {
            window.Notifications.show('Nueva cita pendiente', body);
        }
    }

    function start() {
        stop();
        if (!window.firebaseAdapter || !firebaseAdapter.db) return;

        unsubscribe = firebaseAdapter.db.collection('citas')
            .where('estado', '==', 'pendiente')
            .onSnapshot(
                snapshot => {
                    if (isFirstSnapshot) {
                        snapshot.docs.forEach(doc => knownIds.add(doc.id));
                        isFirstSnapshot = false;
                        // Refrescar el listado en caso de que el admin ya esté viendo el dashboard
                        if (typeof window.initCitasPendientes === 'function') {
                            window.initCitasPendientes();
                        }
                        return;
                    }

                    let nuevas = 0;
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added' && !knownIds.has(change.doc.id)) {
                            knownIds.add(change.doc.id);
                            nuevas++;
                            notifyNew(change.doc.data());
                        } else if (change.type === 'removed') {
                            knownIds.delete(change.doc.id);
                        }
                    });

                    // Re-render del listado y badge
                    if (typeof window.initCitasPendientes === 'function') {
                        window.initCitasPendientes();
                    }

                    if (nuevas > 0) playPing();
                },
                error => console.error('❌ Admin pending listener error:', error)
            );

        console.log('✓ Admin pending listener iniciado');
    }

    function stop() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
            knownIds.clear();
            isFirstSnapshot = true;
            console.log('✓ Admin pending listener detenido');
        }
    }

    window.startAdminPendingListener = start;
    window.stopAdminPendingListener = stop;
})();
