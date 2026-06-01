/**
 * LEGENDS BARBERIA - PENDING LISTENER (RECEPCIONISTA) — F7
 *
 * Escucha en tiempo real las citas con estado 'pendiente' DE SU SEDE.
 * Cuando llega una nueva: suena un ping, muestra toast + notif del SO,
 * y re-rendera la pantalla de citas si está abierta.
 *
 * Misma lógica que admin/pending-listener.js, pero filtrado por sedeId.
 *
 * Nota: el filtro `estado == 'pendiente' AND sedeId == X` requiere índice
 * compuesto en Firestore. Como ya tenemos `citas (sedeId+fecha)` y la query
 * usa solo equality en ambos campos, Firestore lo cubre con auto-indexes
 * de single-field. No requiere nuevo índice.
 */
(function () {
    'use strict';

    let unsubscribe = null;
    const knownIds = new Set();
    let isFirstSnapshot = true;

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
            // Silencioso
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

    /**
     * @param {string} sedeId — sede asignada de la recepcionista
     */
    function start(sedeId) {
        stop();
        if (!sedeId) {
            console.warn('Recepcionista pending listener: sin sedeId asignada');
            return;
        }
        if (!window.firebaseAdapter || !firebaseAdapter.db) return;

        unsubscribe = firebaseAdapter.db.collection('citas')
            .where('estado', '==', 'pendiente')
            .where('sedeId', '==', sedeId)
            .onSnapshot(
                snapshot => {
                    if (isFirstSnapshot) {
                        snapshot.docs.forEach(doc => knownIds.add(doc.id));
                        isFirstSnapshot = false;
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

                    // Re-render del listado de citas si la pantalla está activa
                    const tab = document.getElementById('recepcionista-citas-tab');
                    if (tab && tab.classList.contains('active') && typeof window.initRecepcionistaCitas === 'function') {
                        window.initRecepcionistaCitas();
                    }

                    if (nuevas > 0) playPing();
                },
                error => console.error('❌ Recepcionista pending listener error:', error)
            );

        console.log(`✓ Recepcionista pending listener iniciado (sede=${sedeId})`);
    }

    function stop() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
            knownIds.clear();
            isFirstSnapshot = true;
            console.log('✓ Recepcionista pending listener detenido');
        }
    }

    window.startRecepcionistaPendingListener = start;
    window.stopRecepcionistaPendingListener = stop;
})();
