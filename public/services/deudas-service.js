/**
 * LEGENDS BARBERIA - DEUDAS SERVICE (P7)
 *
 * Una "deuda" es una venta cobrada con metodoPago='deuda' (esDeuda=true).
 * No mutamos la venta: cuando se paga, registramos un doc en `pagos_deuda`.
 * La lista de deudores = ventas con esDeuda que NO tienen pago aún, agrupadas
 * por cliente. Solo personal interno (admin / recepcionista de la sede).
 *
 * pagos_deuda/{id} = {
 *   ventaId, clienteId|null, clienteNombre, sedeId,
 *   monto, metodoPago: 'efectivo'|'transferencia'|'admin',  // 'admin' = no pasa por caja
 *   fecha:"YYYY-MM-DD", fechaHora, registradoPor, registradoPorNombre, createdAt
 * }
 */
(function () {
    'use strict';

    function db() {
        return (typeof firebaseAdapter !== 'undefined' && firebaseAdapter && firebaseAdapter.db)
            ? firebaseAdapter.db : null;
    }
    function serverTimestamp() {
        return firebase.firestore.FieldValue.serverTimestamp();
    }

    /**
     * Deudas pendientes de una sede, agrupadas por cliente.
     * Devuelve [{ clienteKey, clienteNombre, total, deudas:[{ventaId, total, fecha, fechaHora}] }]
     */
    async function listPendientesBySede(sedeId) {
        const database = db();
        if (!database || !sedeId) return [];
        try {
            const [ventasSnap, pagosSnap] = await Promise.all([
                database.collection('ventas').where('sedeId', '==', sedeId).where('esDeuda', '==', true).get(),
                database.collection('pagos_deuda').where('sedeId', '==', sedeId).get()
            ]);
            const pagadas = new Set();
            pagosSnap.forEach(d => { const v = d.data().ventaId; if (v) pagadas.add(v); });

            const grupos = {};
            ventasSnap.forEach(doc => {
                const v = { id: doc.id, ...doc.data() };
                if (pagadas.has(v.id)) return; // ya saldada
                // H2: solo agrupamos deudas de clientes con cuenta (clienteId).
                // Las de venta directa (sin clienteId) van separadas por venta,
                // para no fusionar homónimos distintos.
                const key = v.clienteId ? v.clienteId : `_v_${v.id}`;
                if (!grupos[key]) grupos[key] = { clienteKey: key, clienteNombre: v.clienteNombre || 'Cliente', total: 0, deudas: [] };
                grupos[key].total += Number(v.total) || 0;
                grupos[key].deudas.push({
                    ventaId: v.id,
                    clienteId: v.clienteId || null,
                    clienteNombre: v.clienteNombre || 'Cliente',
                    total: Number(v.total) || 0,
                    fecha: v.fecha || '',
                    fechaHora: v.fechaHora || null
                });
            });
            const lista = Object.values(grupos);
            // Ordenar deudas internas por fecha asc; grupos por total desc
            lista.forEach(g => g.deudas.sort((a, b) => (a.fechaHora?.seconds || 0) - (b.fechaHora?.seconds || 0)));
            lista.sort((a, b) => b.total - a.total);
            return lista;
        } catch (e) {
            console.error('❌ Error listando deudores:', e);
            return [];
        }
    }

    /** Registrar el pago de una deuda concreta. metodoPago: efectivo|transferencia|admin. */
    async function pagar(data) {
        const database = db();
        if (!database) return null;
        if (!data.ventaId || !data.sedeId) return null;
        const monto = Number(data.monto) || 0;
        if (monto <= 0) return null;
        const metodo = ['efectivo', 'transferencia', 'admin'].includes(data.metodoPago) ? data.metodoPago : 'efectivo';
        // H1: id del doc = ventaId → un solo pago por deuda (idempotente).
        // No leemos antes (las rules no dejan a la recepcionista leer un doc
        // inexistente). Hacemos set(): si el doc NO existe es un create (permitido);
        // si YA existe es un update, que las rules le niegan a la recepcionista
        // → 'permission-denied' = la deuda ya estaba pagada. Así NUNCA se duplica.
        const ref = database.collection('pagos_deuda').doc(data.ventaId);
        try {
            await ref.set({
                ventaId: data.ventaId,
                clienteId: data.clienteId || null,
                clienteNombre: data.clienteNombre || 'Cliente',
                sedeId: data.sedeId,
                monto,
                metodoPago: metodo,
                fecha: data.fecha,
                fechaHora: serverTimestamp(),
                registradoPor: data.registradoPor || null,
                registradoPorNombre: data.registradoPorNombre || '',
                createdAt: serverTimestamp()
            });
            return ref.id;
        } catch (e) {
            if (e && e.code === 'permission-denied') {
                console.warn('⚠ Esa deuda ya estaba pagada (update bloqueado)');
                return 'YA_PAGADA';
            }
            console.error('❌ Error registrando pago de deuda:', e);
            return null;
        }
    }

    /** Abonos de deuda de una sede en una fecha (para sumar al efectivo de caja del día). */
    async function listPagosBySedeFecha(sedeId, fecha) {
        const database = db();
        if (!database || !sedeId) return [];
        try {
            const snap = await database.collection('pagos_deuda')
                .where('sedeId', '==', sedeId).where('fecha', '==', fecha).get();
            const r = [];
            snap.forEach(d => r.push({ id: d.id, ...d.data() }));
            return r;
        } catch (e) {
            console.error('❌ Error listando pagos de deuda (día):', e);
            return [];
        }
    }

    window.DeudasService = { listPendientesBySede, pagar, listPagosBySedeFecha };
    console.log('✓ DeudasService loaded');
})();
