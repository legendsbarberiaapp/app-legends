/**
 * LEGENDS BARBERIA - GASTOS SERVICE (P8)
 *
 * Gastos del negocio (insumos, etc.). SIEMPRE en efectivo: descuentan del
 * efectivo de la caja del día y dejan registro para que el admin sepa por qué.
 * Los registra el admin o la recepcionista de la sede; se guarda quién lo hizo.
 *
 * gastos/{id} = {
 *   sedeId, fecha:"YYYY-MM-DD", fechaHora,
 *   concepto: string, monto: number (>0),
 *   registradoPor: uid, registradoPorNombre: string, createdAt
 * }
 */
(function () {
    'use strict';

    const COLLECTION = 'gastos';

    function db() {
        return (typeof firebaseAdapter !== 'undefined' && firebaseAdapter && firebaseAdapter.db)
            ? firebaseAdapter.db : null;
    }
    function serverTimestamp() {
        return firebase.firestore.FieldValue.serverTimestamp();
    }

    async function create(data) {
        const database = db();
        if (!database) return null;
        const monto = Number(data.monto) || 0;
        const concepto = (data.concepto || '').trim();
        if (!data.sedeId || monto <= 0 || !concepto) return null;
        try {
            const ref = await database.collection(COLLECTION).add({
                sedeId: data.sedeId,
                fecha: data.fecha,
                fechaHora: serverTimestamp(),
                concepto: concepto.slice(0, 120),
                monto,
                registradoPor: data.registradoPor || null,
                registradoPorNombre: data.registradoPorNombre || '',
                createdAt: serverTimestamp()
            });
            return ref.id;
        } catch (e) {
            console.error('❌ Error registrando gasto:', e);
            return null;
        }
    }

    async function listBySedeFecha(sedeId, fecha) {
        return listBySedeRange(sedeId, fecha, fecha);
    }

    async function listBySedeRange(sedeId, fechaDesde, fechaHasta) {
        const database = db();
        if (!database || !sedeId) return [];
        try {
            const snap = await database.collection(COLLECTION)
                .where('sedeId', '==', sedeId)
                .where('fecha', '>=', fechaDesde)
                .where('fecha', '<=', fechaHasta)
                .get();
            const r = [];
            snap.forEach(d => r.push({ id: d.id, ...d.data() }));
            r.sort((a, b) => (b.fechaHora?.seconds || 0) - (a.fechaHora?.seconds || 0));
            return r;
        } catch (e) {
            console.error('❌ Error listando gastos:', e);
            return [];
        }
    }

    function sumTotal(gastos) {
        return (gastos || []).reduce((s, g) => s + (Number(g.monto) || 0), 0);
    }

    window.GastosService = { create, listBySedeFecha, listBySedeRange, sumTotal };
    console.log('✓ GastosService loaded');
})();
