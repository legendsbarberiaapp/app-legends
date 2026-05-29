/**
 * LEGENDS BARBERIA - UTILS DE PRECIO (CLIENTE)
 *
 * Originalmente este archivo contenía un catálogo hardcodeado de servicios
 * con precios. Ese catálogo se eliminó: el modelo real es por-barbero
 * (`barberos.{id}.corte.precio`) y los servicios viven en Firestore
 * (`servicios_corte`). El home muestra "desde $X" calculado en home-ui.js.
 *
 * Este archivo se mantiene porque exporta utilidades de formato y captura
 * de precio que se usan en booking y admin:
 *   - window.formatCOP(valor)
 *   - window.attachPriceInput(input)
 *   - window.parsePriceInput(input)
 */

console.log('✓ Price utils loaded');

/**
 * Formato de precio en pesos colombianos: $20.000 (punto como separador de miles).
 * Disponible global (window) para ser usado por todos los UI del cliente.
 */
if (!window.formatCOP) {
    window.formatCOP = function (valor) {
        const n = Number(valor) || 0;
        return '$' + n.toLocaleString('es-CO');
    };
}

/**
 * Convierte un input de texto en un campo de precio en formato COP:
 *   "38000" → "38.000"  mientras el usuario tipea.
 * Lee solo dígitos, descarta lo demás. El valor numérico real se obtiene
 * con `parsePriceInput(el)`.
 *
 *   <input type="text" inputmode="numeric" class="price-input" value="38000">
 *   window.attachPriceInput(input);   // hook eventos + formateo inicial
 */
if (!window.attachPriceInput) {
    const formatDigits = (digits) => {
        if (!digits) return '';
        const n = parseInt(digits, 10);
        if (isNaN(n)) return '';
        return n.toLocaleString('es-CO'); // usa puntos como separador de miles
    };

    window.attachPriceInput = function (el) {
        if (!el || el.dataset.priceBound === '1') return;
        el.dataset.priceBound = '1';

        // Normaliza el valor inicial
        const raw = String(el.value || '').replace(/\D/g, '');
        el.value = formatDigits(raw);

        el.addEventListener('input', (ev) => {
            const before = el.value;
            const digits = before.replace(/\D/g, '').slice(0, 12); // tope de 12 dígitos
            const formatted = formatDigits(digits);
            if (formatted !== before) {
                // Conservamos el caret al final (suficiente para este caso)
                el.value = formatted;
            }
        });

        // Bloquear caracteres no numéricos al tipear
        el.addEventListener('keydown', (ev) => {
            if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
            const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Tab','Enter'];
            if (allowed.includes(ev.key)) return;
            if (!/^\d$/.test(ev.key)) ev.preventDefault();
        });

        // Al pegar, limpiar
        el.addEventListener('paste', (ev) => {
            ev.preventDefault();
            const text = (ev.clipboardData || window.clipboardData).getData('text') || '';
            const digits = text.replace(/\D/g, '').slice(0, 12);
            el.value = formatDigits(digits);
            el.dispatchEvent(new Event('input', { bubbles: true }));
        });
    };

    /** Lee el valor numérico real de un input de precio formateado. */
    window.parsePriceInput = function (el) {
        if (!el) return 0;
        const digits = String(el.value || '').replace(/\D/g, '');
        const n = parseInt(digits, 10);
        return isNaN(n) ? 0 : n;
    };
}
