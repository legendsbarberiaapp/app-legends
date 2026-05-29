/**
 * LEGENDS BARBERIA - VENTAS SERVICE (F3)
 *
 * Capa de datos para la colección `ventas`. Cada venta es una transacción
 * cerrada: servicios + adicionales + productos + método de pago.
 *
 * Modelo:
 *   ventas/{id} = {
 *     sedeId: string,
 *     fecha: "YYYY-MM-DD",
 *     fechaHora: timestamp,
 *
 *     // Vínculos (opcional según tipo)
 *     citaId: string|null,       // si la venta proviene de una cita
 *     clienteId: string|null,
 *     clienteNombre: string,
 *     barberoId: string|null,    // si hay servicio
 *     barberoNombre: string,
 *
 *     // Items: array {tipo, nombre, cantidad, precioUnit, subtotal, productoId?}
 *     items: [],
 *     subtotal: number,
 *     total: number,             // == subtotal por ahora
 *
 *     metodoPago: 'efectivo'|'tarjeta'|'transferencia',
 *
 *     // Auditoría
 *     cobradoPor: uid,
 *     cobradoPorNombre: string,
 *     tipo: 'cita'|'venta_directa',
 *     createdAt: timestamp
 *   }
 *
 * Notas de seguridad: el create debe ser hecho por la recepcionista de la
 * sede; lo enforce firestore.rules + acá no validamos.
 */
(function () {
    'use strict';

    const COLLECTION = 'ventas';

    const METODOS_PAGO = {
        EFECTIVO: 'efectivo',
        TARJETA: 'tarjeta',
        TRANSFERENCIA: 'transferencia'
    };

    const TIPOS = {
        CITA: 'cita',
        DIRECTA: 'venta_directa'
    };

    function db() {
        return (typeof firebaseAdapter !== 'undefined' && firebaseAdapter && firebaseAdapter.db)
            ? firebaseAdapter.db
            : null;
    }
    function serverTimestamp() {
        return firebase.firestore.FieldValue.serverTimestamp();
    }

    /**
     * Crear una venta. Devuelve el id de la venta o null si falla.
     */
    async function create(data) {
        const database = db();
        if (!database) return null;
        try {
            const docRef = await database.collection(COLLECTION).add({
                sedeId: data.sedeId,
                fecha: data.fecha,
                fechaHora: data.fechaHora || serverTimestamp(),

                citaId: data.citaId || null,
                clienteId: data.clienteId || null,
                clienteNombre: data.clienteNombre || 'Cliente',
                barberoId: data.barberoId || null,
                barberoNombre: data.barberoNombre || '',

                items: data.items || [],
                subtotal: Number(data.subtotal) || 0,
                total: Number(data.total) || 0,

                metodoPago: data.metodoPago || METODOS_PAGO.EFECTIVO,

                cobradoPor: data.cobradoPor || null,
                cobradoPorNombre: data.cobradoPorNombre || '',
                tipo: data.tipo || TIPOS.CITA,

                createdAt: serverTimestamp()
            });
            console.log(`✓ Venta creada: ${docRef.id} (${data.tipo})`);
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creando venta:', error);
            return null;
        }
    }

    /**
     * Listar ventas de una sede en un rango de fechas. Devuelve ordenado
     * por fechaHora ascendente (las más viejas del día primero).
     */
    async function listBySedeRange(sedeId, fechaDesde, fechaHasta) {
        const database = db();
        if (!database || !sedeId) return [];
        try {
            const snapshot = await database.collection(COLLECTION)
                .where('sedeId', '==', sedeId)
                .where('fecha', '>=', fechaDesde)
                .where('fecha', '<=', fechaHasta)
                .get();
            const result = [];
            snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
            result.sort((a, b) => {
                const sa = a.fechaHora?.seconds || 0;
                const sb = b.fechaHora?.seconds || 0;
                return sa - sb;
            });
            return result;
        } catch (error) {
            console.error('❌ Error listando ventas:', error);
            return [];
        }
    }

    /** Agrupa ventas por método de pago. Útil para cierre de caja. */
    function aggregarPorMetodo(ventas) {
        const agg = {
            [METODOS_PAGO.EFECTIVO]:      { count: 0, total: 0 },
            [METODOS_PAGO.TARJETA]:       { count: 0, total: 0 },
            [METODOS_PAGO.TRANSFERENCIA]: { count: 0, total: 0 }
        };
        (ventas || []).forEach(v => {
            const m = v.metodoPago || METODOS_PAGO.EFECTIVO;
            if (!agg[m]) agg[m] = { count: 0, total: 0 };
            agg[m].count++;
            agg[m].total += Number(v.total) || 0;
        });
        return agg;
    }

    window.VentasService = { create, listBySedeRange, aggregarPorMetodo, METODOS_PAGO, TIPOS };
    console.log('✓ VentasService loaded');
})();
