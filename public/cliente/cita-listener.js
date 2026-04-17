/**
 * LEGENDS BARBERIA - CITA LISTENER (CLIENTE)
 * Escucha en tiempo real los cambios de estado de las citas del cliente
 * logueado. Cuando el admin confirma, rechaza o el barbero completa,
 * muestra toast + notificación del sistema operativo (si hay permiso).
 *
 * Se arranca desde firebase-adapter cuando el cliente inicia sesión y
 * se detiene cuando cierra sesión.
 */

(function () {
    'use strict';

    let unsubscribe = null;
    const previousStates = new Map(); // citaId -> estado anterior
    let isFirstSnapshot = true;

    /**
     * Mapa de transiciones de estado → mensaje a mostrar.
     * Solo notificamos cambios que le importan al cliente.
     */
    const TRANSITIONS = {
        'pendiente->confirmada': {
            title: '¡Cita confirmada!',
            toastType: 'success',
            body: (c) => `Tu cita con ${c.barberoNombre} fue confirmada`
        },
        'pendiente->cancelada': {
            title: 'Cita rechazada',
            toastType: 'error',
            body: (c) => `Tu reserva con ${c.barberoNombre} no pudo ser aceptada`
        },
        'confirmada->cancelada': {
            title: 'Cita cancelada',
            toastType: 'error',
            body: (c) => `Tu cita con ${c.barberoNombre} fue cancelada`
        },
        'confirmada->completada': {
            title: 'Servicio completado',
            toastType: 'success',
            body: (c) => `Tu corte con ${c.barberoNombre} quedó como completado ✓`
        }
    };

    function notifyTransition(cita, prevState, newState) {
        const msg = TRANSITIONS[`${prevState}->${newState}`];
        if (!msg) return;

        const bodyText = msg.body(cita);

        if (typeof window.showToast === 'function') {
            window.showToast(bodyText, msg.toastType);
        }
        if (window.Notifications) {
            window.Notifications.show(msg.title, bodyText);
        }
    }

    function start(uid) {
        stop();
        if (!window.firebaseAdapter || !firebaseAdapter.db) return;

        unsubscribe = firebaseAdapter.db.collection('citas')
            .where('clienteId', '==', uid)
            .onSnapshot(
                snapshot => {
                    if (isFirstSnapshot) {
                        // Primer snapshot: guardar estados actuales sin notificar
                        snapshot.docs.forEach(doc => {
                            previousStates.set(doc.id, doc.data().estado);
                        });
                        isFirstSnapshot = false;
                        return;
                    }

                    snapshot.docChanges().forEach(change => {
                        const id = change.doc.id;
                        const data = change.doc.data();

                        if (change.type === 'modified') {
                            const prev = previousStates.get(id);
                            if (prev && prev !== data.estado) {
                                notifyTransition(data, prev, data.estado);
                            }
                            previousStates.set(id, data.estado);
                        } else if (change.type === 'added') {
                            previousStates.set(id, data.estado);
                        } else if (change.type === 'removed') {
                            previousStates.delete(id);
                        }
                    });
                },
                error => console.error('❌ Cliente listener error:', error)
            );

        console.log(`✓ Cliente citas listener iniciado (uid=${uid})`);
    }

    function stop() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
            previousStates.clear();
            isFirstSnapshot = true;
            console.log('✓ Cliente citas listener detenido');
        }
    }

    window.startClienteCitasListener = start;
    window.stopClienteCitasListener = stop;
})();
