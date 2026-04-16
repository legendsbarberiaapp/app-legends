/**
 * LEGENDS BARBERIA - SCREEN LOADER
 * Carga "partials" HTML desde public/screens/*.html dentro de un contenedor con data-partial.
 * Uso:
 *   <div id="some-tab" data-partial="screens/some.html"></div>
 *   await window.loadPartialIntoTab(el);
 * Cachea el resultado (solo carga la primera vez).
 */

(function () {
    'use strict';

    const cache = new Map();

    async function fetchPartial(url) {
        if (cache.has(url)) return cache.get(url);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`No se pudo cargar ${url}: ${res.status}`);
        const html = await res.text();
        cache.set(url, html);
        return html;
    }

    async function loadPartialIntoTab(tabEl) {
        if (!tabEl) return false;
        const url = tabEl.dataset.partial;
        if (!url) return false;
        if (tabEl.dataset.loaded === 'true') return true;

        try {
            const html = await fetchPartial(url);
            tabEl.innerHTML = html;
            tabEl.dataset.loaded = 'true';
            console.log(`✓ Partial cargado: ${url}`);
            return true;
        } catch (error) {
            console.error(`❌ Error cargando partial ${url}:`, error);
            tabEl.innerHTML = `
                <div class="text-center py-12">
                    <span class="material-symbols-outlined text-red-400 text-5xl mb-2">error</span>
                    <p class="text-red-400 text-sm">Error al cargar esta sección</p>
                </div>`;
            return false;
        }
    }

    window.loadPartialIntoTab = loadPartialIntoTab;
    console.log('✓ Screen loader listo');
})();
