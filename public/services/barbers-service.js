/**
 * LEGENDS BARBERIA - BARBERS SERVICE
 * Capa de datos para la colección `barberos` en Firestore.
 * Sin UI: expone solo operaciones de datos. El consumidor decide cómo renderizar.
 */

(function () {
    'use strict';

    const COLLECTION = 'barberos';

    function db() {
        return (typeof firebaseAdapter !== 'undefined' && firebaseAdapter && firebaseAdapter.db)
            ? firebaseAdapter.db
            : null;
    }

    function serverTimestamp() {
        return firebase.firestore.FieldValue.serverTimestamp();
    }

    async function list() {
        const database = db();
        if (!database) return [];
        const snapshot = await database.collection(COLLECTION).get();
        const result = [];
        snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
        return result;
    }

    async function create(data) {
        const database = db();
        if (!database) return false;
        await database.collection(COLLECTION).add({
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        if (data.userId) {
            await firebaseAdapter.setUserRole(data.userId, 'barbero');
        }
        return true;
    }

    async function update(id, data) {
        const database = db();
        if (!database) return false;
        await database.collection(COLLECTION).doc(id).update({
            ...data,
            updatedAt: serverTimestamp(),
        });
        return true;
    }

    async function remove(id, userId) {
        const database = db();
        if (!database) return false;
        await database.collection(COLLECTION).doc(id).delete();
        if (userId) {
            await firebaseAdapter.setUserRole(userId, 'cliente');
        }
        return true;
    }

    async function listAllUsers() {
        const database = db();
        if (!database) return [];
        return await firebaseAdapter.getAllUsers();
    }

    window.BarbersService = { list, create, update, remove, listAllUsers };
    console.log('✓ BarbersService loaded');
})();
