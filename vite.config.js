/**
 * Configuración mínima de Vite para la app.
 *
 * Desactivamos el pipeline de PostCSS porque:
 *  1. Usamos Tailwind via CDN (<script src="cdn.tailwindcss.com">),
 *     no por el build local.
 *  2. styles.css es CSS vanilla, no necesita transformaciones.
 *  3. La búsqueda automática de postcss.config fallaba al leer desde
 *     OneDrive, rompiendo el dev server.
 */

/** @type {import('vite').UserConfig} */
module.exports = {
    css: {
        postcss: {
            plugins: []
        }
    },
    server: {
        open: true
    }
};
