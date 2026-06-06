/**
 * LEGENDS BARBERIA - RECORDATORIOS DE PAGO SERVICE (P8)
 *
 * Pagos fijos del negocio que el admin debe recordar (ej. arriendo), POR SEDE.
 * Cada uno tiene una frecuencia y una próxima fecha. El admin ve los vencidos
 * ("hoy toca pagar X") en su panel y, al marcarlos pagados, la fecha avanza
 * según la frecuencia (o se desactiva si es pago único).
 *
 * recordatorios_pago/{id} = {
 *   sedeId, nombre, monto:number|null,
 *   frecuencia: 'semanal'|'quincenal'|'mensual'|'bimestral'|'unico',
 *   proximaFecha: "YYYY-MM-DD", activo: boolean,
 *   createdBy, createdByNombre, createdAt, updatedAt
 * }
 */
(function () {
    'use strict';

    const COLLECTION = 'recordatorios_pago';

    const FRECUENCIAS = {
        semanal:   { label: 'Cada semana',    dias: 7 },
        quincenal: { label: 'Cada 15 días',   dias: 15 },
        mensual:   { label: 'Cada mes',       meses: 1 },
        bimestral: { label: 'Cada 2 meses',   meses: 2 },
        unico:     { label: 'Pago único' }
    };

    function db() {
        return (typeof firebaseAdapter !== 'undefined' && firebaseAdapter && firebaseAdapter.db)
            ? firebaseAdapter.db : null;
    }
    function serverTimestamp() {
        return firebase.firestore.FieldValue.serverTimestamp();
    }
    function toISO(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    /** Calcula la próxima fecha a partir de una fecha base y la frecuencia. null si es único. */
    function computeProxima(fechaISO, frecuencia) {
        const f = FRECUENCIAS[frecuencia];
        if (!f || frecuencia === 'unico') return null;
        const [y, m, d] = (fechaISO || toISO(new Date())).split('-').map(Number);
        const base = new Date(y, m - 1, d);
        if (f.dias) {
            base.setDate(base.getDate() + f.dias);
        } else if (f.meses) {
            // H2: sumar meses sin desbordar. Si el día (29/30/31) no existe en el
            // mes destino, JS lo corre al mes siguiente; lo clampeamos al último
            // día del mes destino (ej. 31 ene → 28/29 feb, no 3 mar).
            const dia = base.getDate();
            base.setDate(1);                          // evita el overflow al cambiar de mes
            base.setMonth(base.getMonth() + f.meses);
            const ultimoDia = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
            base.setDate(Math.min(dia, ultimoDia));
        }
        return toISO(base);
    }

    async function create(data) {
        const database = db();
        if (!database) return null;
        const nombre = (data.nombre || '').trim();
        if (!data.sedeId || !nombre || !FRECUENCIAS[data.frecuencia] || !data.proximaFecha) return null;
        try {
            const ref = await database.collection(COLLECTION).add({
                sedeId: data.sedeId,
                nombre: nombre.slice(0, 80),
                monto: data.monto != null ? Number(data.monto) || 0 : null,
                frecuencia: data.frecuencia,
                proximaFecha: data.proximaFecha,
                activo: true,
                createdBy: data.createdBy || null,
                createdByNombre: data.createdByNombre || '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return ref.id;
        } catch (e) {
            console.error('❌ Error creando recordatorio:', e);
            return null;
        }
    }

    async function update(id, data) {
        const database = db();
        if (!database || !id) return false;
        try {
            await database.collection(COLLECTION).doc(id).update({ ...data, updatedAt: serverTimestamp() });
            return true;
        } catch (e) {
            console.error('❌ Error actualizando recordatorio:', e);
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
            console.error('❌ Error borrando recordatorio:', e);
            return false;
        }
    }

    /** Marca como pagado: avanza la próxima fecha según frecuencia (o desactiva si es único). */
    async function marcarPagado(rec) {
        if (!rec || !rec.id) return false;
        const next = computeProxima(rec.proximaFecha, rec.frecuencia);
        if (next === null) {
            return update(rec.id, { activo: false });
        }
        return update(rec.id, { proximaFecha: next });
    }

    /** Lista TODOS los recordatorios (el admin filtra por sede en cliente). */
    async function list() {
        const database = db();
        if (!database) return [];
        try {
            const snap = await database.collection(COLLECTION).get();
            const r = [];
            snap.forEach(d => r.push({ id: d.id, ...d.data() }));
            return r;
        } catch (e) {
            console.error('❌ Error listando recordatorios:', e);
            return [];
        }
    }

    window.RecordatoriosService = { create, update, remove, marcarPagado, list, computeProxima, FRECUENCIAS };
    console.log('✓ RecordatoriosService loaded');
})();
