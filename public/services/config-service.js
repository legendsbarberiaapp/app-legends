/**
 * LEGENDS BARBERIA - CONFIG SERVICE
 *
 * Configuración global de la app, en un único documento `config/app`.
 * Lo lee cualquier usuario logeado; solo el admin lo escribe (ver firestore.rules).
 *
 * MODELO:
 *   config/app = {
 *     resenasComentariosVisibles: boolean,  // si false → el barbero ve solo
 *                                           //   las estrellas, no el texto.
 *     updatedAt: timestamp,
 *     updatedBy: uid
 *   }
 *
 * Defaults (si el doc no existe todavía): resenasComentariosVisibles = true.
 */
(function () {
    'use strict';

    const COLLECTION = 'config';
    const DOC_ID = 'app';

    const DEFAULTS = {
        resenasComentariosVisibles: true
    };

    let cache = null; // {...config} una vez leído

    function db() {
        return (typeof firebaseAdapter !== 'undefined' && firebaseAdapter && firebaseAdapter.db)
            ? firebaseAdapter.db
            : null;
    }
    function serverTimestamp() {
        return firebase.firestore.FieldValue.serverTimestamp();
    }

    /** Lee el doc de config (con cache). force=true ignora la cache. */
    async function get(force = false) {
        if (cache && !force) return cache;
        const database = db();
        if (!database) return { ...DEFAULTS };
        try {
            const snap = await database.collection(COLLECTION).doc(DOC_ID).get();
            cache = snap.exists ? { ...DEFAULTS, ...snap.data() } : { ...DEFAULTS };
        } catch (e) {
            console.error('❌ Error leyendo config:', e);
            cache = { ...DEFAULTS };
        }
        return cache;
    }

    /** Helper directo del flag de visibilidad de comentarios. force=true relee de Firestore. */
    async function getResenasComentariosVisibles(force = false) {
        const cfg = await get(force);
        return cfg.resenasComentariosVisibles !== false; // default true
    }

    /** Merge parcial de config (solo admin por rules). Actualiza la cache. */
    async function set(partial) {
        const database = db();
        if (!database) return false;
        const user = (typeof roleManager !== 'undefined') ? roleManager.currentUser : null;
        try {
            await database.collection(COLLECTION).doc(DOC_ID).set({
                ...partial,
                updatedAt: serverTimestamp(),
                updatedBy: user?.uid || null
            }, { merge: true });
            cache = { ...(cache || DEFAULTS), ...partial };
            return true;
        } catch (e) {
            console.error('❌ Error guardando config:', e);
            return false;
        }
    }

    window.ConfigService = { get, set, getResenasComentariosVisibles, DEFAULTS };
    console.log('✓ ConfigService loaded');
})();
