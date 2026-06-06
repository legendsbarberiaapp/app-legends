/**
 * LEGENDS BARBERIA - RETIROS SERVICE
 *
 * Retiros de efectivo de la caja. Cuando el admin (o la cajera) se lleva plata
 * de la caja, se registra acá con cuánto y quién. Sirve para que el "efectivo
 * esperado en caja" = efectivo vendido − retiros del día.
 *
 * NO hay apertura/cierre formal de caja: esto es solo el registro de salidas
 * de plata, que se cruza con las ventas en efectivo para cuadrar.
 *
 * MODELO:
 *   retiros/{id} = {
 *     sedeId: string,
 *     fecha: "YYYY-MM-DD",
 *     fechaHora: timestamp,
 *     monto: number,            // > 0
 *     nota: string,             // motivo / quién se la llevó
 *     hechoPor: uid,
 *     hechoPorNombre: string,
 *     createdAt: timestamp
 *   }
 */
(function () {
    'use strict';

    const COLLECTION = 'retiros';

    function db() {
        return (typeof firebaseAdapter !== 'undefined' && firebaseAdapter && firebaseAdapter.db)
            ? firebaseAdapter.db
            : null;
    }
    function serverTimestamp() {
        return firebase.firestore.FieldValue.serverTimestamp();
    }

    /** Crear un retiro. Devuelve el id o null si falla. */
    async function create(data) {
        const database = db();
        if (!database) return null;
        const monto = Number(data.monto) || 0;
        if (!data.sedeId || monto <= 0) return null;
        try {
            const ref = await database.collection(COLLECTION).add({
                sedeId: data.sedeId,
                fecha: data.fecha,
                fechaHora: serverTimestamp(),
                monto,
                nota: (data.nota || '').slice(0, 200),
                hechoPor: data.hechoPor || null,
                hechoPorNombre: data.hechoPorNombre || '',
                createdAt: serverTimestamp()
            });
            console.log(`✓ Retiro creado: ${ref.id} (${monto})`);
            return ref.id;
        } catch (e) {
            console.error('❌ Error creando retiro:', e);
            return null;
        }
    }

    /** Retiros de una sede en un rango de fechas. */
    async function listBySedeRange(sedeId, fechaDesde, fechaHasta) {
        const database = db();
        if (!database || !sedeId) return [];
        try {
            const snap = await database.collection(COLLECTION)
                .where('sedeId', '==', sedeId)
                .where('fecha', '>=', fechaDesde)
                .where('fecha', '<=', fechaHasta)
                .get();
            const result = [];
            snap.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
            result.sort((a, b) => (a.fechaHora?.seconds || 0) - (b.fechaHora?.seconds || 0));
            return result;
        } catch (e) {
            console.error('❌ Error listando retiros:', e);
            return [];
        }
    }

    /** Retiros de TODAS las sedes en un rango (admin). */
    async function listByRange(fechaDesde, fechaHasta) {
        const database = db();
        if (!database) return [];
        try {
            const snap = await database.collection(COLLECTION)
                .where('fecha', '>=', fechaDesde)
                .where('fecha', '<=', fechaHasta)
                .get();
            const result = [];
            snap.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
            result.sort((a, b) => (a.fechaHora?.seconds || 0) - (b.fechaHora?.seconds || 0));
            return result;
        } catch (e) {
            console.error('❌ Error listando retiros (range):', e);
            return [];
        }
    }

    /** Suma el monto de una lista de retiros. */
    function sumTotal(retiros) {
        return (retiros || []).reduce((s, r) => s + (Number(r.monto) || 0), 0);
    }

    window.RetirosService = { create, listBySedeRange, listByRange, sumTotal };
    console.log('✓ RetirosService loaded');
})();
