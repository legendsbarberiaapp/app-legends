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
    // F7: además del estado guardamos también fecha+hora para detectar
    // reagendamientos (la cita cambia sin que cambie el estado).
    const previousSnapshots = new Map(); // citaId -> { estado, fecha, hora }
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

    /**
     * F7: notificar reagendamiento (fecha y/o hora cambiaron sin cambio de
     * estado). Solo aplica a citas activas — si la recep reagenda algo ya
     * cancelado o completado no tiene sentido avisar.
     */
    const MESES_LBL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    function formatFechaCorta(iso) {
        if (!iso) return '';
        const [y, m, d] = iso.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        return `${date.getDate()} ${MESES_LBL[date.getMonth()]}`;
    }
    function notifyReagendamiento(cita) {
        const fechaTxt = formatFechaCorta(cita.fecha);
        const horaTxt = cita.hora || '';
        const title = 'Tu cita fue reagendada';
        const body = `Nueva fecha: ${fechaTxt} a las ${horaTxt} con ${cita.barberoNombre || 'tu barbero'}`;
        if (typeof window.showToast === 'function') {
            window.showToast(body, 'info');
        }
        if (window.Notifications) {
            window.Notifications.show(title, body);
        }
        // F7-fix #2: limpiar el flag "ya notificada" en sessionStorage para
        // que el nuevo recordatorio pueda dispararse para la fecha nueva.
        if (typeof window.limpiarFlagRecordatorioCita === 'function') {
            window.limpiarFlagRecordatorioCita(cita.id);
        }
    }

    function snapOf(data) {
        return { estado: data.estado, fecha: data.fecha, hora: data.hora };
    }

    function start(uid) {
        stop();
        if (!window.firebaseAdapter || !firebaseAdapter.db) return;

        unsubscribe = firebaseAdapter.db.collection('citas')
            .where('clienteId', '==', uid)
            .onSnapshot(
                snapshot => {
                    if (isFirstSnapshot) {
                        // Primer snapshot: guardar snapshots actuales sin notificar
                        snapshot.docs.forEach(doc => {
                            previousSnapshots.set(doc.id, snapOf(doc.data()));
                        });
                        isFirstSnapshot = false;
                        return;
                    }

                    // F7-fix #3: solo refrescamos recordatorios si hubo un
                    // cambio relevante (estado, fecha, hora o cita borrada).
                    // Cambios cosméticos (ej. denormalizar barberoNombre) no
                    // gastan una query Firestore extra.
                    let cambioRelevante = false;

                    snapshot.docChanges().forEach(change => {
                        const id = change.doc.id;
                        const data = change.doc.data();
                        const dataConId = { ...data, id }; // helpers necesitan el id
                        const prev = previousSnapshots.get(id);

                        if (change.type === 'modified' && prev) {
                            const cambioEstado = prev.estado !== data.estado;
                            const sigueActiva = data.estado === 'pendiente' || data.estado === 'confirmada';
                            const cambioFecha = prev.fecha !== data.fecha || prev.hora !== data.hora;

                            // 1) Cambio de estado → notif transición
                            if (cambioEstado) {
                                notifyTransition(dataConId, prev.estado, data.estado);
                            }
                            // 2) F7: reagendamiento (fecha o hora cambiaron) en cita activa.
                            // F7-fix #7: aún si hubo cambio de estado simultáneo, si el
                            // resultado sigue siendo una cita activa (ej. pendiente→
                            // confirmada + reagendada), avisamos también del cambio de
                            // fecha — el cliente necesita saber la hora nueva.
                            if (sigueActiva && cambioFecha) {
                                notifyReagendamiento(dataConId);
                            }

                            if (cambioEstado || cambioFecha) cambioRelevante = true;
                            previousSnapshots.set(id, snapOf(data));
                        } else if (change.type === 'added') {
                            previousSnapshots.set(id, snapOf(data));
                            // Una cita nueva confirmada (vía recepcionista walk-in)
                            // también requiere programar recordatorio.
                            if (data.estado === 'confirmada') cambioRelevante = true;
                        } else if (change.type === 'removed') {
                            previousSnapshots.delete(id);
                            cambioRelevante = true;
                        }
                    });

                    // F7-fix #3: refresh solo si vale la pena (ver arriba).
                    if (cambioRelevante && typeof window.refrescarRecordatoriosCitas === 'function') {
                        window.refrescarRecordatoriosCitas(uid);
                    }
                },
                error => console.error('❌ Cliente listener error:', error)
            );

        console.log(`✓ Cliente citas listener iniciado (uid=${uid})`);
    }

    function stop() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
            previousSnapshots.clear();
            isFirstSnapshot = true;
            console.log('✓ Cliente citas listener detenido');
        }
    }

    window.startClienteCitasListener = start;
    window.stopClienteCitasListener = stop;
})();
