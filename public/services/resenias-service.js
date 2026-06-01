/**
 * LEGENDS BARBERIA - RESEÑAS SERVICE (F6)
 *
 * Calificaciones post-corte: cliente puntúa al barbero después de que
 * la cita está completada.
 *
 * MODELO:
 *   resenias/{id} = {
 *     citaId: string,            // referencia a la cita
 *     barberoId: string,         // userId (auth uid) del barbero
 *     barberoNombre: string,     // denormalizado
 *     clienteId: string,         // auth uid del cliente
 *     clienteNombre: string,     // denormalizado
 *     clientePhotoURL: string|null,
 *     estrellas: 1|2|3|4|5,
 *     comentario: string,        // max 500 chars (vacío si no escribió)
 *     sedeId: string,            // denormalizado (para reportes futuros)
 *     createdAt: timestamp
 *   }
 *
 * El barbero lleva `ratingPromedio` + `ratingCount` denormalizados (avg de
 * las estrellas) para que los cards muestren el rating sin hacer queries
 * agregadas. Se actualizan ATOMIC con el create de la reseña usando un
 * batch + read-modify-write protegido.
 *
 * La cita marca `reviewed: true` para que el perfil del cliente sepa que
 * ya la calificó y no muestre el botón "Calificar" otra vez.
 */
(function () {
    'use strict';

    const COLLECTION = 'resenias';

    function db() {
        return (typeof firebaseAdapter !== 'undefined' && firebaseAdapter && firebaseAdapter.db)
            ? firebaseAdapter.db
            : null;
    }
    function serverTimestamp() {
        return firebase.firestore.FieldValue.serverTimestamp();
    }

    /**
     * Crear una reseña.
     *
     * Atomic via runTransaction: lee barberos/{docId} para calcular el nuevo
     * promedio, escribe la reseña + actualiza barbero + marca cita.reviewed
     * en una sola transacción. Si algo falla, todo es rollback.
     *
     * Importante: barberoDocId NO es lo mismo que barberoId (userId/auth uid).
     * Quien llama debe pasar ambos.
     *
     * @param {object} data - { citaId, barberoId, barberoDocId, barberoNombre,
     *                          clienteId, clienteNombre, clientePhotoURL,
     *                          estrellas, comentario, sedeId }
     * @returns {Promise<string|null>} id de la reseña creada, o null si falla
     */
    async function create(data) {
        const database = db();
        if (!database) return null;
        if (!data || !data.citaId || !data.barberoId || !data.clienteId) return null;
        const estrellas = Number(data.estrellas);
        if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) return null;

        const reseniaRef = database.collection(COLLECTION).doc();
        const citaRef = database.collection('citas').doc(data.citaId);
        const barberoDocId = data.barberoDocId || null;
        const barberoRef = barberoDocId ? database.collection('barberos').doc(barberoDocId) : null;

        try {
            await database.runTransaction(async (tx) => {
                // 1. Validar que la cita exista, sea del cliente, esté completada y NO calificada
                const citaSnap = await tx.get(citaRef);
                if (!citaSnap.exists) throw new Error('Cita no existe');
                const cita = citaSnap.data();
                if (cita.clienteId !== data.clienteId) throw new Error('La cita no es del cliente');
                if (cita.estado !== 'completada') throw new Error('Solo se puede calificar citas completadas');
                if (cita.reviewed === true) throw new Error('Esta cita ya fue calificada');

                // 2. Calcular nuevo promedio del barbero (si tenemos su docId)
                let nuevoBarberoUpdate = null;
                if (barberoRef) {
                    const barberoSnap = await tx.get(barberoRef);
                    if (barberoSnap.exists) {
                        const b = barberoSnap.data();
                        const prevCount = Number(b.ratingCount) || 0;
                        const prevPromedio = Number(b.ratingPromedio) || 0;
                        const newCount = prevCount + 1;
                        const newPromedio = ((prevPromedio * prevCount) + estrellas) / newCount;
                        nuevoBarberoUpdate = {
                            ratingPromedio: Math.round(newPromedio * 10) / 10, // 1 decimal
                            ratingCount: newCount
                        };
                    }
                }

                const ts = serverTimestamp();

                // 3. Crear la reseña
                tx.set(reseniaRef, {
                    citaId: data.citaId,
                    barberoId: data.barberoId,
                    barberoNombre: data.barberoNombre || '',
                    clienteId: data.clienteId,
                    clienteNombre: data.clienteNombre || 'Cliente',
                    clientePhotoURL: data.clientePhotoURL || null,
                    estrellas,
                    comentario: (data.comentario || '').slice(0, 500),
                    sedeId: data.sedeId || cita.sedeId || null,
                    createdAt: ts
                });

                // 4. Marcar cita como reviewed
                tx.update(citaRef, { reviewed: true });

                // 5. Actualizar rating del barbero (si pudimos leerlo)
                if (barberoRef && nuevoBarberoUpdate) {
                    tx.update(barberoRef, nuevoBarberoUpdate);
                }
            });

            console.log(`✓ Reseña creada: ${reseniaRef.id}`);
            return reseniaRef.id;
        } catch (e) {
            console.error('❌ Error creando reseña:', e.message || e);
            return null;
        }
    }

    /**
     * Lista las reseñas de un barbero (por userId/auth uid), ordenadas por
     * createdAt descendente. Limit configurable (default 20).
     */
    async function listByBarbero(barberoId, limit = 20) {
        const database = db();
        if (!database || !barberoId) return [];
        try {
            const snapshot = await database.collection(COLLECTION)
                .where('barberoId', '==', barberoId)
                .get();
            const result = [];
            snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
            // Ordenamos client-side por createdAt desc (evita necesitar índice compuesto)
            result.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            return result.slice(0, limit);
        } catch (e) {
            console.error('❌ Error listando reseñas (barbero):', e);
            return [];
        }
    }

    /**
     * Lista las reseñas que escribió un cliente (útil para "Mis reseñas" futuras).
     */
    async function listByCliente(clienteId, limit = 50) {
        const database = db();
        if (!database || !clienteId) return [];
        try {
            const snapshot = await database.collection(COLLECTION)
                .where('clienteId', '==', clienteId)
                .get();
            const result = [];
            snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
            result.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            return result.slice(0, limit);
        } catch (e) {
            console.error('❌ Error listando reseñas (cliente):', e);
            return [];
        }
    }

    window.ReseniasService = { create, listByBarbero, listByCliente };
    console.log('✓ ReseniasService loaded');
})();
