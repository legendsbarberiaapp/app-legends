/**
 * LEGENDS BARBERIA - CATÁLOGO DE SERVICIOS (FUENTE ÚNICA)
 * Los servicios principales que puede reservar el cliente.
 * Usado por booking-ui y home-ui (preview) — fuente única del catálogo.
 *
 * TODO: cuando el admin tenga UI de catálogo, migrar este array a Firestore
 * y cargar desde ahí. Mientras tanto, edita este archivo para agregar/quitar
 * servicios o ajustar precios.
 */

window.SERVICIOS_CATALOG = [
    {
        id: 'corte-clasico',
        nombre: 'Corte Clásico',
        precio: 40,
        duracionMin: 45,
        icon: 'content_cut',
        descripcion: 'Corte tradicional con acabado profesional'
    },
    {
        id: 'corte-barba',
        nombre: 'Corte + Barba',
        precio: 60,
        duracionMin: 75,
        icon: 'face',
        descripcion: 'Combo completo: corte y arreglo de barba',
        popular: true
    },
    {
        id: 'afeitado',
        nombre: 'Afeitado Premium',
        precio: 35,
        duracionMin: 30,
        icon: 'waves',
        descripcion: 'Afeitado con navaja y toalla caliente'
    },
    {
        id: 'degradado',
        nombre: 'Degradado',
        precio: 45,
        duracionMin: 45,
        icon: 'straighten',
        descripcion: 'Fade limpio y preciso'
    }
];

console.log('✓ ServiciosCatalog loaded');

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
