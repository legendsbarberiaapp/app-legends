/**
 * LEGENDS BARBERIA - PRODUCTOS SERVICE (F3)
 *
 * Capa de datos para la colección `productos` (para vender por la recepcionista
 * al cobrar — geles, ceras, shampoos, etc.).
 *
 * Modelo:
 *   productos/{id} = {
 *     nombre: string,
 *     precio: number,
 *     activo: boolean,    // false = catálogo oculto en POS pero no perdemos historia
 *     orden: number,
 *     createdAt: timestamp,
 *     updatedAt: timestamp
 *   }
 *
 * Decisiones F3:
 *  - El catálogo es GLOBAL (no por sede). El stock por sede llega en F4.
 *  - La venta guarda la "foto" del producto (nombre + precio) al momento, así
 *    cambiar el precio no afecta ventas históricas.
 */
(function () {
    'use strict';

    const COLLECTION = 'productos';

    function db() {
        return (typeof firebaseAdapter !== 'undefined' && firebaseAdapter && firebaseAdapter.db)
            ? firebaseAdapter.db
            : null;
    }
    function serverTimestamp() {
        return firebase.firestore.FieldValue.serverTimestamp();
    }

    async function list({ soloActivos = false } = {}) {
        const database = db();
        if (!database) return [];
        try {
            const snapshot = await database.collection(COLLECTION).orderBy('orden', 'asc').get();
            const result = [];
            snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
            return soloActivos ? result.filter(p => p.activo !== false) : result;
        } catch (error) {
            console.error('❌ Error listando productos:', error);
            return [];
        }
    }

    async function create({ nombre, precio, ordenActual }) {
        const database = db();
        if (!database) return false;
        if (!nombre || !nombre.trim()) return false;
        await database.collection(COLLECTION).add({
            nombre: nombre.trim(),
            precio: Number(precio) || 0,
            activo: true,
            orden: ordenActual || 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return true;
    }

    async function update(id, fields) {
        const database = db();
        if (!database || !id || !fields) return false;
        await database.collection(COLLECTION).doc(id).update({
            ...fields,
            updatedAt: serverTimestamp()
        });
        return true;
    }

    async function remove(id) {
        const database = db();
        if (!database) return false;
        await database.collection(COLLECTION).doc(id).delete();
        return true;
    }

    window.ProductosService = { list, create, update, remove };
    console.log('✓ ProductosService loaded');
})();
