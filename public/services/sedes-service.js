/**
 * LEGENDS BARBERIA - SEDES SERVICE
 *
 * Capa de datos para la colección `sedes` (sucursales).
 *
 * Modelo:
 *   sedes/{docId} = {
 *     nombre: string,
 *     orden:  number,
 *     createdAt: serverTimestamp
 *   }
 *
 * F1 decisión: dejamos 2 sedes fijas (el dueño actual tiene 2 barberías).
 * El admin solo puede RENOMBRAR; agregar/borrar se hace en código si más
 * adelante hacen falta más. Esto evita UI compleja y errores accidentales.
 *
 * Seed: si la colección está vacía, se crean 2 docs por defecto. Idempotente.
 */
(function () {
    'use strict';

    const COLLECTION = 'sedes';

    const DEFAULT_SEDES = [
        { nombre: 'Sede 1', orden: 0 },
        { nombre: 'Sede 2', orden: 1 }
    ];

    function db() {
        return (typeof firebaseAdapter !== 'undefined' && firebaseAdapter && firebaseAdapter.db)
            ? firebaseAdapter.db
            : null;
    }

    function serverTimestamp() {
        return firebase.firestore.FieldValue.serverTimestamp();
    }

    async function seedDefaults() {
        const database = db();
        if (!database) return;
        const batch = database.batch();
        DEFAULT_SEDES.forEach(s => {
            const ref = database.collection(COLLECTION).doc();
            batch.set(ref, { ...s, createdAt: serverTimestamp() });
        });
        await batch.commit();
    }

    async function list() {
        const database = db();
        if (!database) return DEFAULT_SEDES.map((s, i) => ({ id: `default-${i}`, ...s }));

        const snapshot = await database.collection(COLLECTION).orderBy('orden', 'asc').get();
        if (snapshot.empty) {
            console.log('⚙ Creando sedes predeterminadas...');
            try {
                await seedDefaults();
            } catch (error) {
                // Si el seed falla por permisos (ej. user no es admin la primera vez),
                // devolvemos defaults en memoria para no bloquear la UI.
                console.warn('No se pudo sembrar sedes (¿permisos?). Usando defaults en memoria.', error);
                return DEFAULT_SEDES.map((s, i) => ({ id: `default-${i}`, ...s }));
            }
            return await list();
        }

        const result = [];
        snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
        return result;
    }

    /** Actualizar nombre u orden de una sede. */
    async function update(id, fields) {
        const database = db();
        if (!database || !id || !fields) return false;
        await database.collection(COLLECTION).doc(id).update(fields);
        return true;
    }

    /** Helper: nombre amigable a partir del id, con fallback. */
    function nombreById(sedes, id) {
        if (!id || !Array.isArray(sedes)) return '';
        const found = sedes.find(s => s.id === id);
        return found?.nombre || '';
    }

    window.SedesService = { list, update, nombreById, DEFAULT_SEDES };
    console.log('✓ SedesService loaded');
})();
