/**
 * LEGENDS BARBERIA - STOCK SERVICE (F4)
 *
 * Inventario de productos POR SEDE.
 *
 * MODELO:
 *   stock/{productoId_sedeId} = {
 *     productoId: string,
 *     sedeId: string,
 *     cantidad: number,        // unidades disponibles ahora
 *     minimo: number,          // umbral para alerta de "bajo stock" (0 = sin alerta)
 *     updatedAt: timestamp,
 *     createdAt: timestamp
 *   }
 *
 *   stock_movimientos/{id} = {
 *     productoId, sedeId,
 *     tipo: 'venta' | 'entrada' | 'ajuste',
 *     cantidad: number,        // delta: -1 para venta, +n para entrada, +/-n para ajuste
 *     ventaId: string|null,    // si tipo='venta'
 *     notas: string,           // si tipo='entrada'/'ajuste'
 *     creadoPor: uid,
 *     creadoPorNombre: string,
 *     createdAt: timestamp
 *   }
 *
 * El stockId compuesto `${productoId}_${sedeId}` da un PK natural y permite
 * llegar directo al doc sin queries. La auditoría queda en movimientos.
 *
 * Las VENTAS no llaman directamente a este service — el batch de cobrar-ui
 * incluye el increment(-1) + el movimiento de tipo 'venta' en una única
 * transacción atómica con la venta y la cita.
 */
(function () {
    'use strict';

    const COL_STOCK = 'stock';
    const COL_MOV = 'stock_movimientos';

    const TIPOS_MOV = {
        VENTA: 'venta',
        ENTRADA: 'entrada',
        AJUSTE: 'ajuste'
    };

    function db() {
        return (typeof firebaseAdapter !== 'undefined' && firebaseAdapter && firebaseAdapter.db)
            ? firebaseAdapter.db
            : null;
    }
    function serverTimestamp() {
        return firebase.firestore.FieldValue.serverTimestamp();
    }
    function increment(delta) {
        return firebase.firestore.FieldValue.increment(delta);
    }

    /** Compone el id determinístico del doc de stock. */
    function stockId(productoId, sedeId) {
        return `${productoId}_${sedeId}`;
    }

    /**
     * Lista todo el stock de una sede. Devuelve filas { id, productoId, sedeId,
     * cantidad, minimo }. Si un producto no tiene doc en stock todavía (nunca
     * se le seteó cantidad inicial), no aparece en el resultado — quien llama
     * debe normalizar (mostrar cantidad=0).
     */
    async function listBySede(sedeId) {
        const database = db();
        if (!database || !sedeId) return [];
        try {
            const snapshot = await database.collection(COL_STOCK)
                .where('sedeId', '==', sedeId)
                .get();
            const result = [];
            snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
            return result;
        } catch (error) {
            console.error('❌ Error listando stock:', error);
            return [];
        }
    }

    /** Lee el doc de stock de un producto en una sede. Null si no existe. */
    async function get(productoId, sedeId) {
        const database = db();
        if (!database) return null;
        try {
            const id = stockId(productoId, sedeId);
            const doc = await database.collection(COL_STOCK).doc(id).get();
            if (!doc.exists) return null;
            return { id: doc.id, ...doc.data() };
        } catch (e) {
            console.error('❌ Error obteniendo stock:', e);
            return null;
        }
    }

    /**
     * Registrar entrada de mercancía. Aumenta cantidad e inserta movimiento.
     * Si el doc no existe (primera vez), lo crea con cantidad inicial = delta.
     * Atomic via batch.
     */
    async function registrarEntrada({ productoId, sedeId, cantidad, notas = '', creadoPor, creadoPorNombre = '' }) {
        const database = db();
        if (!database || !productoId || !sedeId) return false;
        if (!cantidad || cantidad <= 0) return false;

        const id = stockId(productoId, sedeId);
        const stockRef = database.collection(COL_STOCK).doc(id);
        const movRef = database.collection(COL_MOV).doc();

        try {
            const snap = await stockRef.get();
            const batch = database.batch();
            const ts = serverTimestamp();

            if (snap.exists) {
                batch.update(stockRef, {
                    cantidad: increment(cantidad),
                    updatedAt: ts
                });
            } else {
                batch.set(stockRef, {
                    productoId,
                    sedeId,
                    cantidad: cantidad,
                    minimo: 0,
                    createdAt: ts,
                    updatedAt: ts
                });
            }

            batch.set(movRef, {
                productoId,
                sedeId,
                tipo: TIPOS_MOV.ENTRADA,
                cantidad: cantidad,
                ventaId: null,
                notas: notas || '',
                creadoPor: creadoPor || null,
                creadoPorNombre: creadoPorNombre || '',
                createdAt: ts
            });

            await batch.commit();
            return true;
        } catch (e) {
            console.error('❌ Error registrando entrada:', e);
            return false;
        }
    }

    /**
     * Ajuste manual: setea cantidad a un valor exacto (corrige inventario tras
     * conteo físico). Registra movimiento con el delta. Es atomic via
     * transaction porque necesitamos LEER la cantidad actual para calcular el
     * delta correctamente.
     */
    async function ajustar({ productoId, sedeId, nuevaCantidad, notas = '', creadoPor, creadoPorNombre = '' }) {
        const database = db();
        if (!database || !productoId || !sedeId) return false;
        if (nuevaCantidad == null || nuevaCantidad < 0) return false;

        const id = stockId(productoId, sedeId);
        const stockRef = database.collection(COL_STOCK).doc(id);
        const movRef = database.collection(COL_MOV).doc();

        try {
            await database.runTransaction(async (tx) => {
                const snap = await tx.get(stockRef);
                const actual = snap.exists ? (Number(snap.data().cantidad) || 0) : 0;
                const delta = nuevaCantidad - actual;
                const ts = serverTimestamp();

                if (snap.exists) {
                    tx.update(stockRef, {
                        cantidad: nuevaCantidad,
                        updatedAt: ts
                    });
                } else {
                    tx.set(stockRef, {
                        productoId,
                        sedeId,
                        cantidad: nuevaCantidad,
                        minimo: 0,
                        createdAt: ts,
                        updatedAt: ts
                    });
                }

                tx.set(movRef, {
                    productoId,
                    sedeId,
                    tipo: TIPOS_MOV.AJUSTE,
                    cantidad: delta,
                    ventaId: null,
                    notas: notas || '',
                    creadoPor: creadoPor || null,
                    creadoPorNombre: creadoPorNombre || '',
                    createdAt: ts
                });
            });
            return true;
        } catch (e) {
            console.error('❌ Error ajustando stock:', e);
            return false;
        }
    }

    /** Set umbral mínimo (para alertas). Solo admin. */
    async function setMinimo({ productoId, sedeId, minimo }) {
        const database = db();
        if (!database || !productoId || !sedeId) return false;
        if (minimo == null || minimo < 0) return false;

        const id = stockId(productoId, sedeId);
        const stockRef = database.collection(COL_STOCK).doc(id);
        try {
            const snap = await stockRef.get();
            const ts = serverTimestamp();
            if (snap.exists) {
                await stockRef.update({ minimo: Number(minimo), updatedAt: ts });
            } else {
                // Crear doc con cantidad=0 y el mínimo seteado
                await stockRef.set({
                    productoId,
                    sedeId,
                    cantidad: 0,
                    minimo: Number(minimo),
                    createdAt: ts,
                    updatedAt: ts
                });
            }
            return true;
        } catch (e) {
            console.error('❌ Error seteando mínimo:', e);
            return false;
        }
    }

    /** Últimos N movimientos de una sede, ordenados desc por fecha. */
    async function listMovimientos(sedeId, limit = 50) {
        const database = db();
        if (!database || !sedeId) return [];
        try {
            const snapshot = await database.collection(COL_MOV)
                .where('sedeId', '==', sedeId)
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();
            const result = [];
            snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
            return result;
        } catch (e) {
            console.error('❌ Error listando movimientos:', e);
            return [];
        }
    }

    /**
     * Helper: dado un array de items de venta (los que tienen tipo='producto'),
     * devuelve los inputs listos para meter en un batch externo:
     *   - stockRef + update({cantidad: increment(-cantidadVendida)})
     *   - movRef + set({tipo: 'venta', cantidad: -cantidadVendida, ventaId, ...})
     * cobrar-ui usa esto para sumar al batch del cobro.
     */
    function buildOpsVenta({ items, sedeId, ventaId, creadoPor, creadoPorNombre = '' }) {
        const database = db();
        if (!database) return [];
        const ts = serverTimestamp();
        const ops = [];
        (items || []).forEach(it => {
            if (it.tipo !== 'producto' || !it.productoId) return;
            const cantidadVendida = Number(it.cantidad) || 1;
            const stockRef = database.collection(COL_STOCK).doc(stockId(it.productoId, sedeId));
            const movRef = database.collection(COL_MOV).doc();
            ops.push({
                type: 'update',
                ref: stockRef,
                data: { cantidad: increment(-cantidadVendida), updatedAt: ts }
            });
            ops.push({
                type: 'set',
                ref: movRef,
                data: {
                    productoId: it.productoId,
                    sedeId,
                    tipo: TIPOS_MOV.VENTA,
                    cantidad: -cantidadVendida,
                    ventaId: ventaId || null,
                    notas: '',
                    creadoPor: creadoPor || null,
                    creadoPorNombre: creadoPorNombre || '',
                    createdAt: ts
                }
            });
        });
        return ops;
    }

    window.StockService = {
        listBySede,
        get,
        registrarEntrada,
        ajustar,
        setMinimo,
        listMovimientos,
        buildOpsVenta,
        stockId,
        TIPOS_MOV
    };
    console.log('✓ StockService loaded');
})();
