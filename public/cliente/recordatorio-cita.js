/**
 * LEGENDS BARBERIA - CLIENTE: RECORDATORIOS DE CITA (F7)
 *
 * Programa recordatorios "tu cita es en 2h" para citas confirmadas próximas,
 * usando setTimeout — funciona mientras el navegador esté abierto.
 *
 * Cómo funciona:
 *   1. Al iniciar sesión el cliente, hace una query de sus citas confirmadas.
 *   2. Para cada una con fecha+hora dentro de las próximas 26h, programa un
 *      setTimeout que dispara el recordatorio 2h antes (o ahora si ya estamos
 *      dentro de esa ventana).
 *   3. Almacena los timeouts por citaId para poder cancelarlos si la cita se
 *      reagenda/cancela.
 *   4. El cita-listener llama refrescarRecordatoriosCitas() después de cada
 *      cambio para mantener los timeouts sincronizados con la realidad.
 *
 * Limitación conocida: si el cliente cierra el navegador, los setTimeout se
 * pierden. Para recordatorios verdaderos con app cerrada hace falta FCM +
 * Cloud Functions (no entran en este alcance).
 *
 * Anti-doble-notif: usamos sessionStorage para marcar las citas ya
 * notificadas en esta sesión. Si la app se refresca, no re-notifica.
 */
(function () {
    'use strict';

    // Constantes
    const HORAS_ANTES = 2;
    const VENTANA_MS = 26 * 3600 * 1000; // ventana de trigger: solo programamos si el trigger (2h antes) cae dentro de 26h
    const STORAGE_KEY_PREFIX = 'legends.recordatorio.';

    // Estado en memoria: citaId → timeoutId
    const timeouts = new Map();

    // F7-fix #1: token de secuencia anti-race. Si dos refresh corren en
    // paralelo (cita-listener + login + refresh manual), el que termina
    // último se descarta. Evita doble notif por programar dos timeouts del
    // mismo cita-id.
    let refreshToken = 0;

    function alreadyNotified(citaId) {
        try {
            return sessionStorage.getItem(STORAGE_KEY_PREFIX + citaId) === '1';
        } catch (e) {
            return false;
        }
    }
    function markNotified(citaId) {
        try {
            sessionStorage.setItem(STORAGE_KEY_PREFIX + citaId, '1');
        } catch (e) {
            // sessionStorage podría no estar disponible (modo privado etc.)
        }
    }

    /**
     * Construye un Date local a partir de fecha "YYYY-MM-DD" y hora "HH:mm".
     * No usa new Date(ISO) para evitar interpretación UTC en Colombia (-5).
     */
    function buildCitaDate(fecha, hora) {
        if (!fecha || !hora) return null;
        const [y, m, d] = fecha.split('-').map(Number);
        const [hh, mm] = hora.split(':').map(Number);
        return new Date(y, m - 1, d, hh, mm);
    }

    function notify(cita) {
        const barbero = cita.barberoNombre || 'tu barbero';
        const hora = cita.hora || '';
        const title = `Tu cita es en ${HORAS_ANTES}h`;
        const body = `A las ${hora} con ${barbero}. ¡Te esperamos en Legends! 👑`;
        if (typeof window.showToast === 'function') {
            window.showToast(body, 'info');
        }
        if (window.Notifications) {
            window.Notifications.show(title, body);
        }
    }

    function cancelAll() {
        timeouts.forEach(id => clearTimeout(id));
        timeouts.clear();
    }

    /**
     * Programa el recordatorio de UNA cita confirmada si corresponde.
     * Idempotente: si ya hay timeout para esa cita, lo reemplaza.
     */
    function scheduleOne(cita) {
        const id = cita.id;
        if (!id) return;
        if (alreadyNotified(id)) return;

        // Limpiar timeout previo (por si la cita se reagendó)
        if (timeouts.has(id)) {
            clearTimeout(timeouts.get(id));
            timeouts.delete(id);
        }

        if (cita.estado !== 'confirmada') return;

        const fechaHora = buildCitaDate(cita.fecha, cita.hora);
        if (!fechaHora) return;

        const ahora = Date.now();
        const triggerAt = fechaHora.getTime() - HORAS_ANTES * 3600 * 1000;
        const delay = triggerAt - ahora;

        // No programamos si la cita ya pasó, o si el trigger (2h antes) está
        // más allá de nuestra ventana de 26h. En ese caso el próximo login/
        // refresh dentro de ventana eventualmente la recogerá.
        if (fechaHora.getTime() <= ahora) return;
        if (delay > VENTANA_MS) return;

        // Si ya estamos dentro de la ventana (faltan <= 2h), disparamos ya
        const safeDelay = Math.max(0, delay);
        const handle = setTimeout(() => {
            notify(cita);
            markNotified(id);
            timeouts.delete(id);
        }, safeDelay);
        timeouts.set(id, handle);
    }

    /**
     * Refresca todos los recordatorios: lee citas activas del cliente y
     * reprograma. Llamado al inicio y desde el cita-listener tras cambios.
     */
    async function refresh(uid) {
        if (!uid || typeof CitasService === 'undefined') return;

        // F7-fix #1: capturar el token de esta llamada para descartar este
        // refresh si otro más nuevo arranca antes de que termine el await.
        const myToken = ++refreshToken;

        cancelAll();
        try {
            const citas = await CitasService.listByCliente(uid);

            // Si otro refresh corrió mientras esperábamos, descartamos: él
            // ya hizo su propio cancelAll + scheduleOne con datos más frescos.
            if (myToken !== refreshToken) return;

            const activas = citas.filter(c => c.estado === 'confirmada');
            activas.forEach(scheduleOne);
            if (activas.length > 0) {
                console.log(`✓ Recordatorios programados: ${timeouts.size}/${activas.length} citas dentro de ventana`);
            }
        } catch (e) {
            console.error('❌ Error refrescando recordatorios:', e);
        }
    }

    /**
     * F7-fix #2: limpia el flag "ya notificada" de una cita. Usado por el
     * cita-listener cuando detecta un reagendamiento: la cita cambió de
     * fecha/hora, así que el recordatorio debe volver a dispararse para
     * la nueva fecha.
     */
    function clearNotifiedFlag(citaId) {
        try {
            sessionStorage.removeItem(STORAGE_KEY_PREFIX + citaId);
        } catch (e) {
            // Silencioso
        }
    }

    function stop() {
        cancelAll();
        console.log('✓ Recordatorios de cita detenidos');
    }

    window.refrescarRecordatoriosCitas = refresh;
    window.stopRecordatoriosCitas = stop;
    window.limpiarFlagRecordatorioCita = clearNotifiedFlag;
    console.log('✓ RecordatorioCita (F7) loaded');
})();
