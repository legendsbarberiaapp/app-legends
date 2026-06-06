/**
 * LEGENDS BARBERIA - CLIENTE: TIENDA (P3)
 *
 * Vitrina de productos para el cliente, organizada por secciones (globales).
 * El cliente elige sede, ve los productos activos de esa sede agrupados por
 * sección, y al tocar "Comprar" se abre WhatsApp de esa sede con un mensaje
 * pre-armado. Sin carrito ni pagos en la app.
 */
(function () {
    'use strict';

    const state = { sedes: [], secciones: [], productos: [], sedeId: null };

    function fmtCOP(n) {
        return (typeof window.formatCOP === 'function') ? window.formatCOP(n || 0) : `$${n || 0}`;
    }
    function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    async function init() {
        const content = document.getElementById('tienda-content');
        if (!content) return;
        try {
            const [sedes, secciones] = await Promise.all([
                (typeof SedesService !== 'undefined') ? SedesService.list() : Promise.resolve([]),
                (typeof SeccionesService !== 'undefined') ? SeccionesService.list({ soloActivas: true }) : Promise.resolve([])
            ]);
            state.sedes = sedes || [];
            state.secciones = secciones || [];
            if (!state.sedeId && state.sedes.length) state.sedeId = state.sedes[0].id;
            renderSedePills();
            await loadProductos();
        } catch (e) {
            console.error('❌ Error cargando tienda:', e);
            content.innerHTML = renderError();
        }
    }

    async function loadProductos() {
        const content = document.getElementById('tienda-content');
        if (content) content.innerHTML = `
            <div class="flex flex-col items-center gap-3 py-10">
                <div class="auth-checking-spinner"></div>
                <p class="text-white/50 text-xs">Cargando productos...</p>
            </div>`;
        try {
            state.productos = (state.sedeId && typeof ProductosService !== 'undefined')
                ? await ProductosService.listBySede(state.sedeId, { soloActivos: true })
                : [];
            renderContenido();
        } catch (e) {
            console.error('❌ Error cargando productos de la tienda:', e);
            if (content) content.innerHTML = renderError();
        }
    }

    function renderSedePills() {
        const cont = document.getElementById('tienda-sede-pills');
        if (!cont) return;
        if (state.sedes.length <= 1) { cont.innerHTML = ''; return; }
        cont.innerHTML = state.sedes.map(s => {
            const active = s.id === state.sedeId;
            return `<button onclick="tiendaSelectSede('${s.id}')"
                class="shrink-0 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-95
                    ${active ? 'bg-primary text-black shadow-[0_4px_15px_rgba(201,167,74,0.25)]' : 'bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-white/[0.08]'}">
                ${esc(s.nombre)}
            </button>`;
        }).join('');
    }

    function renderContenido() {
        const content = document.getElementById('tienda-content');
        if (!content) return;
        const productos = state.productos || [];
        if (productos.length === 0) {
            content.innerHTML = `
                <div class="flex flex-col items-center gap-3 py-12 px-6 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                    <span class="material-symbols-outlined text-white/20 text-5xl" style="font-variation-settings: 'FILL' 1">shopping_bag</span>
                    <p class="text-white/50 text-sm font-bold text-center">Aún no hay productos en esta sede</p>
                </div>`;
            return;
        }

        // Agrupar por sección (en el orden de state.secciones); "Otros" al final.
        const grupos = [];
        state.secciones.forEach(sec => {
            const items = productos.filter(p => p.seccionId === sec.id);
            if (items.length) grupos.push({ nombre: sec.nombre, items });
        });
        const sinSeccion = productos.filter(p => !p.seccionId || !state.secciones.some(s => s.id === p.seccionId));
        if (sinSeccion.length) grupos.push({ nombre: 'Otros', items: sinSeccion });

        content.innerHTML = grupos.map(g => `
            <div class="mb-6">
                <h2 class="text-white/45 text-[11px] font-black uppercase tracking-[0.3em] mb-3 pl-1">${esc(g.nombre)}</h2>
                <div class="grid grid-cols-2 gap-3">
                    ${g.items.map(productoCard).join('')}
                </div>
            </div>`).join('');
    }

    function productoCard(p) {
        return `
        <div class="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col">
            <div class="w-full aspect-square rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-white/5 flex items-center justify-center mb-2">
                <span class="material-symbols-outlined text-primary/70 text-4xl" style="font-variation-settings: 'FILL' 1">shopping_bag</span>
            </div>
            <p class="text-white text-sm font-bold leading-tight mb-0.5 line-clamp-2">${esc(p.nombre)}</p>
            <p class="text-primary text-base font-black tabular-nums mb-2">${fmtCOP(p.precio)}</p>
            <button onclick="tiendaComprar('${p.id}')"
                class="mt-auto w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-green-500 text-black text-xs font-black uppercase tracking-wider hover:bg-green-400 transition-all active:scale-[0.97]">
                <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1">chat</span>
                Comprar
            </button>
        </div>`;
    }

    function renderError() {
        return `
            <div class="text-center py-10 px-6 rounded-xl bg-red-500/5 border border-red-500/15">
                <span class="material-symbols-outlined text-red-400 text-4xl mb-2">error</span>
                <p class="text-red-400 text-sm font-bold">No se pudo cargar la tienda</p>
                <button onclick="initTienda()" class="mt-4 px-4 py-2 bg-primary/20 text-primary text-xs font-black rounded-lg border border-primary/30">Reintentar</button>
            </div>`;
    }

    function selectSede(sedeId) {
        if (!sedeId || state.sedeId === sedeId) return;
        state.sedeId = sedeId;
        renderSedePills();
        loadProductos();
    }

    /** Abre WhatsApp de la sede con el producto pre-armado. */
    function comprar(productoId) {
        const p = state.productos.find(x => x.id === productoId);
        if (!p) return;
        const sede = state.sedes.find(s => s.id === state.sedeId);
        let wa = (sede && sede.whatsapp ? String(sede.whatsapp) : '').replace(/[^\d]/g, '');
        if (wa.length === 10) wa = '57' + wa; // defensa: número sin indicativo
        if (!wa) {
            if (typeof window.showToast === 'function') window.showToast('Esta sede aún no tiene WhatsApp configurado', 'error');
            return;
        }
        const msg = `Hola, estoy interesado en ${p.nombre} (${fmtCOP(p.precio)})`;
        const url = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    }

    window.initTienda = init;
    window.tiendaSelectSede = selectSede;
    window.tiendaComprar = comprar;
    console.log('✓ ClienteTiendaUI (P3) loaded');
})();
