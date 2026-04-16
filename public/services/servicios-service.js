/**
 * LEGENDS BARBERIA - SERVICIOS SERVICE
 * Capa de datos para la colección global `servicios_corte` en Firestore.
 */

(function () {
    'use strict';

    const COLLECTION = 'servicios_corte';

    const DEFAULTS = [
        { nombre: 'Asesoramiento de Imagen', descripcion: '' },
        { nombre: 'Perfilación de Cejas', descripcion: '' },
        { nombre: 'Mascarilla de Carbón', descripcion: '' },
        { nombre: 'Limpieza Facial', descripcion: '' },
        { nombre: 'Masaje Lavado', descripcion: '' },
        { nombre: 'Peinado', descripcion: '' },
        { nombre: 'Cóctel', descripcion: '' },
        { nombre: 'Café', descripcion: '' },
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
        DEFAULTS.forEach((s, i) => {
            const ref = database.collection(COLLECTION).doc();
            batch.set(ref, { ...s, orden: i, createdAt: serverTimestamp() });
        });
        await batch.commit();
    }

    async function list() {
        const database = db();
        if (!database) return DEFAULTS.map(s => ({ ...s }));

        const snapshot = await database.collection(COLLECTION).orderBy('orden', 'asc').get();

        if (snapshot.empty) {
            console.log('⚙ Creando servicios predeterminados...');
            await seedDefaults();
            return await list();
        }

        const result = [];
        snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
        return result;
    }

    async function create(nombre, ordenActual) {
        if (!nombre || !nombre.trim()) return false;
        const database = db();
        if (!database) return false;
        await database.collection(COLLECTION).add({
            nombre: nombre.trim(),
            descripcion: '',
            orden: ordenActual,
            createdAt: serverTimestamp(),
        });
        return true;
    }

    async function remove(id) {
        const database = db();
        if (!database) return false;
        await database.collection(COLLECTION).doc(id).delete();
        return true;
    }

    async function updateDescripcion(id, descripcion) {
        const database = db();
        if (!database) return false;
        await database.collection(COLLECTION).doc(id).update({ descripcion });
        return true;
    }

    window.ServiciosService = { list, create, remove, updateDescripcion, DEFAULTS };
    console.log('✓ ServiciosService loaded');
})();
