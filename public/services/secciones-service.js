/**
 * LEGENDS BARBERIA - SECCIONES SERVICE (P3)
 *
 * Secciones GLOBALES de la tienda (camisas, ceras, cremas...). Las crea el
 * admin; cada producto (que es por sede) elige una sección. Sirven para
 * organizar la tienda del cliente y el catálogo.
 *
 * secciones/{id} = { nombre, orden, activo, createdAt, updatedAt }
 */
(function () {
    'use strict';

    const COLLECTION = 'secciones';

    function db() {
        return (typeof firebaseAdapter !== 'undefined' && firebaseAdapter && firebaseAdapter.db)
            ? firebaseAdapter.db : null;
    }
    function serverTimestamp() {
        return firebase.firestore.FieldValue.serverTimestamp();
    }

    async function list({ soloActivas = false } = {}) {
        const database = db();
        if (!database) return [];
        try {
            const snap = await database.collection(COLLECTION).get();
            const r = [];
            snap.forEach(d => r.push({ id: d.id, ...d.data() }));
            r.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
            return soloActivas ? r.filter(s => s.activo !== false) : r;
        } catch (e) {
            console.error('❌ Error listando secciones:', e);
            return [];
        }
    }

    async function create({ nombre, ordenActual }) {
        const database = db();
        if (!database) return null;
        const n = (nombre || '').trim();
        if (!n) return null;
        try {
            const ref = await database.collection(COLLECTION).add({
                nombre: n.slice(0, 40),
                orden: ordenActual || 0,
                activo: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return ref.id;
        } catch (e) {
            console.error('❌ Error creando sección:', e);
            return null;
        }
    }

    async function update(id, fields) {
        const database = db();
        if (!database || !id) return false;
        try {
            await database.collection(COLLECTION).doc(id).update({ ...fields, updatedAt: serverTimestamp() });
            return true;
        } catch (e) {
            console.error('❌ Error actualizando sección:', e);
            return false;
        }
    }

    async function remove(id) {
        const database = db();
        if (!database || !id) return false;
        try {
            await database.collection(COLLECTION).doc(id).delete();
            return true;
        } catch (e) {
            console.error('❌ Error borrando sección:', e);
            return false;
        }
    }

    function nombreById(secciones, id) {
        if (!id || !Array.isArray(secciones)) return '';
        const f = secciones.find(s => s.id === id);
        return f ? f.nombre : '';
    }

    window.SeccionesService = { list, create, update, remove, nombreById };
    console.log('✓ SeccionesService loaded');
})();
