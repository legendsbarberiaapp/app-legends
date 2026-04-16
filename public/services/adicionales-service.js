/**
 * LEGENDS BARBERIA - ADICIONALES SERVICE
 * Capa de datos para la colección global `adicionales` en Firestore.
 */

(function () {
    'use strict';

    const COLLECTION = 'adicionales';

    const DEFAULTS = [
        { nombre: 'Ritual de Barba', descripcion: '', soloConCorte: false },
        { nombre: 'Limpieza Premium', descripcion: '', soloConCorte: false },
        { nombre: 'Corte de Dama', descripcion: '', soloConCorte: false },
        { nombre: 'Daniels', descripcion: '', soloConCorte: false },
        { nombre: 'Jose Cuervo', descripcion: '', soloConCorte: false },
        { nombre: 'Mascarilla Carbonatada Completa', descripcion: '', soloConCorte: false },
        { nombre: 'Mascarilla de Pepino', descripcion: '', soloConCorte: false },
        { nombre: 'Mascarilla de Realce Completo', descripcion: '', soloConCorte: false },
        { nombre: 'Mascarilla Led', descripcion: '', soloConCorte: false },
        { nombre: 'Limpieza Gold', descripcion: '', soloConCorte: false },
        { nombre: 'Cejas', descripcion: '', soloConCorte: false },
        { nombre: 'Experiencia Masajes', descripcion: '', soloConCorte: false },
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
        DEFAULTS.forEach((a, i) => {
            const ref = database.collection(COLLECTION).doc();
            batch.set(ref, { ...a, orden: i, createdAt: serverTimestamp() });
        });
        await batch.commit();
    }

    async function list() {
        const database = db();
        if (!database) return DEFAULTS.map(a => ({ ...a }));

        const snapshot = await database.collection(COLLECTION).orderBy('orden', 'asc').get();

        if (snapshot.empty) {
            console.log('⚙ Creando adicionales predeterminados...');
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
            soloConCorte: false,
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

    async function setSoloConCorte(id, value) {
        const database = db();
        if (!database) return false;
        await database.collection(COLLECTION).doc(id).update({ soloConCorte: value });
        return true;
    }

    window.AdicionalesService = {
        list, create, remove, updateDescripcion, setSoloConCorte, DEFAULTS,
    };
    console.log('✓ AdicionalesService loaded');
})();
