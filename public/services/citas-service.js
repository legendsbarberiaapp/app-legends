/**
 * LEGENDS BARBERIA - CITAS SERVICE
 * Capa de datos para la colección `citas` en Firestore.
 * Sin UI: expone operaciones para cliente, barbero y admin.
 *
 * Estados posibles: pendiente | confirmada | completada | cancelada
 * Flujo estándar:   cliente crea (pendiente) → admin confirma → barbero completa
 */

(function () {
    'use strict';

    const COLLECTION = 'citas';

    const ESTADOS = {
        PENDIENTE: 'pendiente',
        CONFIRMADA: 'confirmada',
        COMPLETADA: 'completada',
        CANCELADA: 'cancelada'
    };

    function db() {
        return (typeof firebaseAdapter !== 'undefined' && firebaseAdapter && firebaseAdapter.db)
            ? firebaseAdapter.db
            : null;
    }

    function serverTimestamp() {
        return firebase.firestore.FieldValue.serverTimestamp();
    }

    /**
     * Construye un Timestamp desde fecha ("YYYY-MM-DD") + hora ("HH:mm").
     * Se usa para ordenar citas cronológicamente en queries.
     */
    function buildFechaHora(fecha, hora) {
        const [y, m, d] = fecha.split('-').map(Number);
        const [hh, mm] = hora.split(':').map(Number);
        return firebase.firestore.Timestamp.fromDate(new Date(y, m - 1, d, hh, mm));
    }

    /**
     * Crear una cita (la llama el cliente desde booking.html).
     * Recibe los datos ya validados — no valida aquí.
     *
     * @param {object} data - { clienteId, clienteNombre, clientePhotoURL,
     *                          barberoId, barberoNombre,
     *                          servicioNombre, servicioPrecio,
     *                          fecha ("YYYY-MM-DD"), hora ("HH:mm") }
     * @returns {Promise<string|null>} id de la cita creada, o null si falla
     */
    async function create(data) {
        const database = db();
        if (!database) return null;

        try {
            const docRef = await database.collection(COLLECTION).add({
                clienteId: data.clienteId,
                clienteNombre: data.clienteNombre || '',
                clientePhotoURL: data.clientePhotoURL || null,
                clientePhone: data.clientePhone || null,

                barberoId: data.barberoId,
                barberoNombre: data.barberoNombre || '',

                servicioNombre: data.servicioNombre || '',
                servicioPrecio: Number(data.servicioPrecio) || 0,

                fecha: data.fecha,
                hora: data.hora,
                fechaHora: buildFechaHora(data.fecha, data.hora),

                estado: ESTADOS.PENDIENTE,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                confirmedAt: null,
                confirmedBy: null
            });
            console.log(`✓ Cita creada: ${docRef.id}`);
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creando cita:', error);
            return null;
        }
    }

    /**
     * Listar citas de un cliente (las suyas, ordenadas por fecha descendente).
     */
    async function listByCliente(clienteId) {
        const database = db();
        if (!database) return [];
        try {
            const snapshot = await database.collection(COLLECTION)
                .where('clienteId', '==', clienteId)
                .orderBy('fechaHora', 'desc')
                .get();
            const result = [];
            snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
            return result;
        } catch (error) {
            console.error('❌ Error listando citas del cliente:', error);
            return [];
        }
    }

    /**
     * Listar citas asignadas a un barbero. Opcionalmente filtradas por estado.
     */
    async function listByBarbero(barberoId, estado = null) {
        const database = db();
        if (!database) return [];
        try {
            let query = database.collection(COLLECTION).where('barberoId', '==', barberoId);
            if (estado) query = query.where('estado', '==', estado);
            const snapshot = await query.orderBy('fechaHora', 'asc').get();
            const result = [];
            snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
            return result;
        } catch (error) {
            console.error('❌ Error listando citas del barbero:', error);
            return [];
        }
    }

    /**
     * Listar citas pendientes de confirmación (para el admin).
     */
    async function listPendientes() {
        const database = db();
        if (!database) return [];
        try {
            const snapshot = await database.collection(COLLECTION)
                .where('estado', '==', ESTADOS.PENDIENTE)
                .orderBy('fechaHora', 'asc')
                .get();
            const result = [];
            snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
            return result;
        } catch (error) {
            console.error('❌ Error listando citas pendientes:', error);
            return [];
        }
    }

    /**
     * Admin confirma una cita.
     */
    async function confirmar(citaId, adminUid) {
        const database = db();
        if (!database) return false;
        try {
            await database.collection(COLLECTION).doc(citaId).update({
                estado: ESTADOS.CONFIRMADA,
                confirmedAt: serverTimestamp(),
                confirmedBy: adminUid,
                updatedAt: serverTimestamp()
            });
            console.log(`✓ Cita ${citaId} confirmada por ${adminUid}`);
            return true;
        } catch (error) {
            console.error('❌ Error confirmando cita:', error);
            return false;
        }
    }

    /**
     * Cancelar una cita (cliente o admin).
     */
    async function cancelar(citaId) {
        const database = db();
        if (!database) return false;
        try {
            await database.collection(COLLECTION).doc(citaId).update({
                estado: ESTADOS.CANCELADA,
                updatedAt: serverTimestamp()
            });
            console.log(`✓ Cita ${citaId} cancelada`);
            return true;
        } catch (error) {
            console.error('❌ Error cancelando cita:', error);
            return false;
        }
    }

    /**
     * Devuelve las horas ("HH:mm") ya ocupadas por otro cliente para un
     * barbero en una fecha dada. Solo cuentan las citas activas
     * (pendiente o confirmada). Las canceladas/completadas liberan el slot.
     */
    async function getOccupiedSlots(barberoId, fecha) {
        const database = db();
        if (!database) return [];
        try {
            const snapshot = await database.collection(COLLECTION)
                .where('barberoId', '==', barberoId)
                .where('fecha', '==', fecha)
                .get();
            return snapshot.docs
                .map(doc => doc.data())
                .filter(c => c.estado === ESTADOS.PENDIENTE || c.estado === ESTADOS.CONFIRMADA)
                .map(c => c.hora);
        } catch (error) {
            console.error('❌ Error obteniendo slots ocupados:', error);
            return [];
        }
    }

    /**
     * Indica si el cliente ya tiene una cita activa (pendiente o confirmada).
     * Usado para aplicar la regla "una cita por cliente".
     */
    async function hasActiveBooking(clienteId) {
        const database = db();
        if (!database) return false;
        try {
            const snapshot = await database.collection(COLLECTION)
                .where('clienteId', '==', clienteId)
                .get();
            return snapshot.docs.some(doc => {
                const d = doc.data();
                return d.estado === ESTADOS.PENDIENTE || d.estado === ESTADOS.CONFIRMADA;
            });
        } catch (error) {
            console.error('❌ Error comprobando cita activa:', error);
            return false;
        }
    }

    /**
     * Marcar cita como completada (barbero al terminar el servicio).
     */
    async function completar(citaId) {
        const database = db();
        if (!database) return false;
        try {
            await database.collection(COLLECTION).doc(citaId).update({
                estado: ESTADOS.COMPLETADA,
                updatedAt: serverTimestamp()
            });
            console.log(`✓ Cita ${citaId} completada`);
            return true;
        } catch (error) {
            console.error('❌ Error completando cita:', error);
            return false;
        }
    }

    window.CitasService = {
        create,
        listByCliente,
        listByBarbero,
        listPendientes,
        confirmar,
        cancelar,
        completar,
        getOccupiedSlots,
        hasActiveBooking,
        ESTADOS
    };
    console.log('✓ CitasService loaded');
})();
