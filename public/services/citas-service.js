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
        CANCELADA: 'cancelada',
        NO_SHOW: 'no_show'
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
     *                          barberoId, barberoNombre, sedeId,
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
                barberoNivel: data.barberoNivel || null,

                // Sede denormalizada desde el barbero (F1). Sirve para que la
                // agenda admin y la pantalla de la recepcionista filtren rápido
                // sin tener que cruzar con la colección barberos.
                sedeId: data.sedeId || null,

                servicioNombre: data.servicioNombre || '',
                servicioPrecio: Number(data.servicioPrecio) || 0,

                fecha: data.fecha,
                hora: data.hora,
                fechaHora: buildFechaHora(data.fecha, data.hora),

                estado: ESTADOS.PENDIENTE,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                confirmedAt: null,
                confirmedBy: null,

                // Stepper de confirmación (admin)
                adminContactoCliente: false,
                adminContactoBarbero: false,
                completedAt: null,
                noShowAt: null
            });
            console.log(`✓ Cita creada: ${docRef.id}`);
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creando cita:', error);
            return null;
        }
    }

    /**
     * Listar citas de una sede en un rango de fechas — usado por agenda admin
     * y por la pantalla de la recepcionista.
     */
    async function listBySedeRange(sedeId, fechaDesde, fechaHasta) {
        const database = db();
        if (!database || !sedeId) return [];
        try {
            const snapshot = await database.collection(COLLECTION)
                .where('sedeId', '==', sedeId)
                .where('fecha', '>=', fechaDesde)
                .where('fecha', '<=', fechaHasta)
                .get();
            const result = [];
            snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
            return sortAsc(result);
        } catch (error) {
            console.error('❌ Error listando citas por sede:', error);
            return [];
        }
    }

    /**
     * Helpers de ordenamiento en cliente (evitan requerir índices compuestos
     * en Firestore). Como las listas son chicas (decenas de items por cliente
     * o barbero) no hay impacto de performance.
     */
    function tsSeconds(cita) {
        return (cita.fechaHora && cita.fechaHora.seconds) ? cita.fechaHora.seconds : 0;
    }
    function sortDesc(arr) { return arr.sort((a, b) => tsSeconds(b) - tsSeconds(a)); }
    function sortAsc(arr) { return arr.sort((a, b) => tsSeconds(a) - tsSeconds(b)); }

    /**
     * Listar citas de un cliente (las suyas, ordenadas por fecha descendente).
     */
    async function listByCliente(clienteId) {
        const database = db();
        if (!database) return [];
        try {
            const snapshot = await database.collection(COLLECTION)
                .where('clienteId', '==', clienteId)
                .get();
            const result = [];
            snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
            return sortDesc(result);
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
            const snapshot = await query.get();
            const result = [];
            snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
            return sortAsc(result);
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
                .get();
            const result = [];
            snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
            return sortAsc(result);
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
     * Marcar cita como completada (barbero al terminar el servicio, o admin
     * al verificar desde la Agenda que el cliente sí llegó).
     */
    async function completar(citaId) {
        const database = db();
        if (!database) return false;
        try {
            await database.collection(COLLECTION).doc(citaId).update({
                estado: ESTADOS.COMPLETADA,
                completedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            console.log(`✓ Cita ${citaId} completada`);
            return true;
        } catch (error) {
            console.error('❌ Error completando cita:', error);
            return false;
        }
    }

    /**
     * Marcar que admin ya contactó al cliente por WhatsApp (paso 1 del stepper).
     */
    async function markContactoCliente(citaId) {
        const database = db();
        if (!database) return false;
        try {
            await database.collection(COLLECTION).doc(citaId).update({
                adminContactoCliente: true,
                updatedAt: serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('❌ Error marcando contacto cliente:', error);
            return false;
        }
    }

    /**
     * Marcar que admin ya envió info al barbero por WhatsApp (paso 2 del stepper).
     */
    async function markContactoBarbero(citaId) {
        const database = db();
        if (!database) return false;
        try {
            await database.collection(COLLECTION).doc(citaId).update({
                adminContactoBarbero: true,
                updatedAt: serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('❌ Error marcando contacto barbero:', error);
            return false;
        }
    }

    /**
     * Marcar cita como "no show" (el cliente no llegó).
     */
    async function markNoShow(citaId) {
        const database = db();
        if (!database) return false;
        try {
            await database.collection(COLLECTION).doc(citaId).update({
                estado: ESTADOS.NO_SHOW,
                noShowAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            console.log(`✓ Cita ${citaId} marcada como no-show`);
            return true;
        } catch (error) {
            console.error('❌ Error marcando no-show:', error);
            return false;
        }
    }

    /**
     * Lista TODAS las citas en un rango de fechas (YYYY-MM-DD inclusivo).
     * Usada por la Agenda del admin — 1 sola lectura cubre varios días,
     * el filtrado por día después es en memoria. Incluye todos los estados.
     *
     * Si no se pasa rango, trae desde hoy-90d hasta hoy+90d.
     */
    async function listByRange(fechaDesde, fechaHasta) {
        const database = db();
        if (!database) return [];

        if (!fechaDesde || !fechaHasta) {
            const today = new Date();
            const d90Back = new Date(today); d90Back.setDate(today.getDate() - 90);
            const d90Fwd = new Date(today); d90Fwd.setDate(today.getDate() + 90);
            const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            fechaDesde = toISO(d90Back);
            fechaHasta = toISO(d90Fwd);
        }

        try {
            const snapshot = await database.collection(COLLECTION)
                .where('fecha', '>=', fechaDesde)
                .where('fecha', '<=', fechaHasta)
                .get();
            const result = [];
            snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
            return sortAsc(result);
        } catch (error) {
            console.error('❌ Error listando citas por rango:', error);
            return [];
        }
    }

    window.CitasService = {
        create,
        listByCliente,
        listByBarbero,
        listPendientes,
        listByRange,
        listBySedeRange,
        confirmar,
        cancelar,
        completar,
        markContactoCliente,
        markContactoBarbero,
        markNoShow,
        getOccupiedSlots,
        hasActiveBooking,
        ESTADOS
    };
    console.log('✓ CitasService loaded');
})();
