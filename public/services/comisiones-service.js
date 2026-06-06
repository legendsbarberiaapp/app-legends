/**
 * LEGENDS BARBERIA - COMISIONES SERVICE (P5)
 *
 * Pagos de comisión a los barberos. La comisión GENERADA vive denormalizada en
 * cada venta (`comisionMonto`). Acá registramos los PAGOS que el admin le hace
 * al barbero. Pendiente = generada − pagada (en el período/rango consultado).
 *
 * MODELO:
 *   pagos_comision/{id} = {
 *     barberoId: string,        // userId del barbero
 *     barberoNombre: string,
 *     sedeId: string|null,
 *     monto: number,            // > 0
 *     fecha: "YYYY-MM-DD",
 *     fechaHora: timestamp,
 *     pagadoPor: uid,           // admin que pagó
 *     pagadoPorNombre: string,
 *     createdAt: timestamp
 *   }
 */
(function () {
    'use strict';

    const COLLECTION = 'pagos_comision';

    function db() {
        return (typeof firebaseAdapter !== 'undefined' && firebaseAdapter && firebaseAdapter.db)
            ? firebaseAdapter.db : null;
    }
    function serverTimestamp() {
        return firebase.firestore.FieldValue.serverTimestamp();
    }

    /** Registrar un pago de comisión. Devuelve id o null. */
    async function create(data) {
        const database = db();
        if (!database) return null;
        const monto = Number(data.monto) || 0;
        if (!data.barberoId || monto <= 0) return null;
        try {
            const ref = await database.collection(COLLECTION).add({
                barberoId: data.barberoId,
                barberoNombre: data.barberoNombre || '',
                sedeId: data.sedeId || null,
                monto,
                fecha: data.fecha,
                fechaHora: serverTimestamp(),
                pagadoPor: data.pagadoPor || null,
                pagadoPorNombre: data.pagadoPorNombre || '',
                createdAt: serverTimestamp()
            });
            return ref.id;
        } catch (e) {
            console.error('❌ Error registrando pago de comisión:', e);
            return null;
        }
    }

    /** Pagos en un rango (todas las sedes). */
    async function listByRange(fechaDesde, fechaHasta) {
        const database = db();
        if (!database) return [];
        try {
            const snap = await database.collection(COLLECTION)
                .where('fecha', '>=', fechaDesde)
                .where('fecha', '<=', fechaHasta)
                .get();
            const r = [];
            snap.forEach(d => r.push({ id: d.id, ...d.data() }));
            return r;
        } catch (e) {
            console.error('❌ Error listando pagos de comisión (range):', e);
            return [];
        }
    }

    /** Pagos de un barbero (para que vea su historial). */
    async function listByBarbero(barberoId) {
        const database = db();
        if (!database || !barberoId) return [];
        try {
            const snap = await database.collection(COLLECTION)
                .where('barberoId', '==', barberoId)
                .get();
            const r = [];
            snap.forEach(d => r.push({ id: d.id, ...d.data() }));
            r.sort((a, b) => (b.fechaHora?.seconds || 0) - (a.fechaHora?.seconds || 0));
            return r;
        } catch (e) {
            console.error('❌ Error listando pagos de comisión (barbero):', e);
            return [];
        }
    }

    /** Suma de montos de una lista de pagos. */
    function sumTotal(pagos) {
        return (pagos || []).reduce((s, p) => s + (Number(p.monto) || 0), 0);
    }

    window.ComisionesService = { create, listByRange, listByBarbero, sumTotal };
    console.log('✓ ComisionesService loaded');
})();
