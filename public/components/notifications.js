/**
 * LEGENDS BARBERIA - NOTIFICATIONS (NAVEGADOR)
 * Envuelve la API Notification del browser con chequeos defensivos.
 * Requiere permiso explícito del usuario (se pide en profile).
 *
 * NOTA: Solo funciona mientras el navegador esté abierto. Para push
 * notificaciones con la app cerrada se necesita FCM + Cloud Functions.
 */

(function () {
    'use strict';

    function hasSupport() {
        return typeof window.Notification !== 'undefined';
    }

    function getPermission() {
        if (!hasSupport()) return 'unsupported';
        return window.Notification.permission; // 'granted' | 'denied' | 'default'
    }

    async function request() {
        if (!hasSupport()) return 'unsupported';
        try {
            const result = await window.Notification.requestPermission();
            console.log(`✓ Permiso de notificaciones: ${result}`);
            return result;
        } catch (error) {
            console.error('❌ Error pidiendo permiso:', error);
            return 'denied';
        }
    }

    /**
     * Muestra una notificación del SO si el permiso fue otorgado.
     * Silenciosamente no hace nada si no hay permiso o no hay soporte.
     */
    function show(title, body, options = {}) {
        if (!hasSupport() || window.Notification.permission !== 'granted') return null;
        try {
            const n = new window.Notification(title, {
                body,
                icon: '/logo.png',
                badge: '/logo.png',
                silent: false,
                ...options
            });
            // Auto-cerrar después de 6 segundos
            setTimeout(() => { try { n.close(); } catch (e) {} }, 6000);
            return n;
        } catch (error) {
            console.warn('No se pudo mostrar notificación:', error);
            return null;
        }
    }

    window.Notifications = { hasSupport, getPermission, request, show };
    console.log('✓ Notifications module loaded');
})();
