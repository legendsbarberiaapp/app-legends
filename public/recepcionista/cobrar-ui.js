/**
 * LEGENDS BARBERIA - RECEPCIONISTA: COBRAR (F3)
 *
 * Overlay genérico de cobro con dos modos:
 *   - 'cita': inicia con items de una cita confirmada (corte + adicionales).
 *     Al confirmar: crea venta + marca cita como completada + denormaliza
 *     totalCobrado y metodoPago en la cita (para que el cliente vea su recibo).
 *   - 'directa': inicia vacío. Solo productos. No hay cita asociada.
 *
 * En ambos modos: permite agregar productos del catálogo, elegir método de
 * pago, ver total. Al confirmar crea el documento `ventas`.
 *
 * Lee window.recepState para sede + ProductosService para catálogo.
 */
(function () {
    'use strict';

    const METODOS = ['efectivo', 'transferencia', 'deuda'];
    const METODO_META = {
        efectivo:      { label: 'Efectivo',      icon: 'payments'  },
        transferencia: { label: 'Transferencia', icon: 'account_balance' },
        deuda:         { label: 'Deuda',         icon: 'schedule' }
    };

    // Estado del overlay — VENTA UNIFICADA: un solo ticket puede llevar cortes
    // (de uno o VARIOS barberos) + productos. La comisión se calcula POR ÍTEM.
    const ctx = {
        cita: null,           // cita vinculada (opcional). Al cobrar se marca completada.
        items: [],            // servicio/adicional: {tipo,nombre,barberoId,barberoNombre,comisionPct,cantidad,precioUnit,subtotal}
                              // producto: {tipo:'producto',productoId,nombre,cantidad,precioUnit,subtotal}
        metodoPago: 'efectivo',
        deudorNombre: '',     // nombre de quien queda debiendo (solo si metodoPago='deuda')
        productosCache: [],
        stockCache: {},       // F4: productoId → cantidad disponible (de la sede actual)
        comisionByBarbero: {},// userId del barbero → % de comisión
        barberosCache: [],    // barberos de la sede (para la sección "Agregar corte")
        citasHoy: [],         // citas del día (pendiente/confirmada) para vincular
        productoSearch: ''    // filtro del buscador de productos
    };

    function fmtCOP(n) {
        return (typeof window.formatCOP === 'function') ? window.formatCOP(n) : `$${n}`;
    }
    function todayISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function getCurrentUser() {
        return (typeof roleManager !== 'undefined') ? roleManager.currentUser : null;
    }

    /**
     * FIX #6: en vez de depender SOLO de window.recepState.sedeId (que se
     * inicializa en citas-ui), buscamos la sede en este orden:
     *   1. user.sedeId del roleManager (fuente de verdad — siempre presente)
     *   2. window.recepState.sedeId (cache si ya cargó la pantalla citas)
     * Esto desacopla el overlay y evita el bug si por algún motivo se llega
     * a este flujo sin pasar antes por la pantalla citas.
     */
    function getSedeId() {
        const user = getCurrentUser();
        if (user && user.sedeId) return user.sedeId;
        const rs = window.recepState;
        if (rs && rs.sedeId) return rs.sedeId;
        return null;
    }

    /**
     * Nombre de la sede para mostrar en el header. Igual estrategia: cache
     * primero (recepState/cajaState), user no tiene el nombre, solo el id.
     */
    function getSedeNombre() {
        const rs = window.recepState;
        if (rs && rs.sedeNombre) return rs.sedeNombre;
        return '';
    }

    // ============================================
    // BUILDERS DE ITEMS
    // ============================================

    /**
     * Construye los items iniciales a partir de una cita.
     *
     * FIX #5: los items YA NO son "protegidos". En la práctica de una barbería
     * el cliente a veces ajusta lo que pidió (cancela la barba, decide solo
     * corte, etc.). La recepcionista puede quitar ítems antes de cobrar.
     * El submit valida que el total sea > 0 — si se queda en 0 no se cobra.
     */
    function itemsDesdeCita(cita) {
        const items = [];
        if (cita.servicioNombre && (cita.servicioPrecio || cita.total)) {
            items.push({
                tipo: 'servicio',
                nombre: cita.servicioNombre,
                cantidad: 1,
                precioUnit: Number(cita.servicioPrecio || cita.total || 0),
                subtotal: Number(cita.servicioPrecio || cita.total || 0)
            });
        }
        return items;
    }

    function calcularSubtotal() {
        return ctx.items.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
    }

    // ============================================
    // OPEN / CLOSE
    // ============================================

    /**
     * Abre el overlay en modo 'cita' (al completar una cita confirmada).
     * @param {object} cita
     */
    function resetCtx() {
        ctx.cita = null;
        ctx.items = [];
        ctx.metodoPago = 'efectivo';
        ctx.deudorNombre = '';
        ctx.productoSearch = '';
    }

    /** Abre la venta ya vinculada a una cita (pre-llena el corte de la cita). */
    async function openParaCita(cita) {
        resetCtx();
        await loadProductosYStock();
        vincularCita(cita); // arma los items del corte de la cita
        renderOverlay();
    }

    /** Abre la "Nueva venta" vacía (walk-in / venta directa). */
    async function openVentaDirecta() {
        resetCtx();
        await loadProductosYStock();
        renderOverlay();
    }

    /**
     * Vincula una cita: setea ctx.cita y arma sus items de corte (con barbero +
     * comisión) para que el cobro genere la comisión correcta. Al cobrar, la cita
     * queda 'completada'. Si ya había items, conserva los productos agregados.
     */
    function vincularCita(cita) {
        ctx.cita = cita || null;
        // Quitar items de servicio previos que vinieran de otra cita (conserva productos)
        ctx.items = ctx.items.filter(it => it.tipo === 'producto');
        if (!cita) return;
        const pct = Number(ctx.comisionByBarbero[cita.barberoId]) || 0;
        if (cita.servicioNombre && (cita.servicioPrecio || cita.total)) {
            const precio = Number(cita.servicioPrecio || cita.total || 0);
            ctx.items.unshift({
                tipo: 'servicio',
                nombre: cita.servicioNombre,
                barberoId: cita.barberoId || null,
                barberoNombre: cita.barberoNombre || '',
                comisionPct: pct,
                cantidad: 1,
                precioUnit: precio,
                subtotal: precio
            });
        }
    }

    /**
     * F4 + F9: carga productos activos DE LA SEDE de la recepcionista + el
     * stock de esa sede. En F9, cada sede tiene su propio catálogo, así que
     * solo cargamos los suyos (no los de la otra sede).
     *
     * Si StockService no está cargado o falla, dejamos stockCache vacío y
     * todos los productos se ven con "stock desconocido" (no se bloquea el
     * flujo del cobro).
     */
    async function loadProductosYStock() {
        const sedeId = getSedeId();
        try {
            const [productos, stockRows, barberos] = await Promise.all([
                (sedeId && typeof ProductosService !== 'undefined')
                    ? ProductosService.listBySede(sedeId, { soloActivos: true })
                    : Promise.resolve([]),
                (sedeId && typeof StockService !== 'undefined')
                    ? StockService.listBySede(sedeId)
                    : Promise.resolve([]),
                // P5: barberos para resolver el % de comisión por userId.
                (typeof BarbersService !== 'undefined') ? BarbersService.list() : Promise.resolve([])
            ]);
            ctx.productosCache = productos;
            ctx.stockCache = {};
            (stockRows || []).forEach(s => {
                ctx.stockCache[s.productoId] = Number(s.cantidad) || 0;
            });
            ctx.comisionByBarbero = {};
            (barberos || []).forEach(b => {
                if (b.userId) ctx.comisionByBarbero[b.userId] = Number(b.comisionPorcentaje) || 0;
            });
            // Barberos de ESTA sede (para la sección "Agregar corte"). Fallback de
            // migración: barbero sin sedeId cuenta para la primera sede.
            ctx.barberosCache = (barberos || []).filter(b => b.sedeId === sedeId);
            // Citas del día (pendiente/confirmada) de la sede, para vincular el cobro.
            try {
                const hoy = todayISO();
                const citas = (typeof CitasService !== 'undefined' && sedeId)
                    ? await CitasService.listBySedeRange(sedeId, hoy, hoy) : [];
                ctx.citasHoy = (citas || []).filter(c => c.estado === 'pendiente' || c.estado === 'confirmada');
            } catch (e) { ctx.citasHoy = []; }
        } catch (e) {
            console.error('❌ Error cargando productos/stock:', e);
            ctx.productosCache = [];
            ctx.stockCache = {};
            ctx.comisionByBarbero = {};
            ctx.barberosCache = [];
            ctx.citasHoy = [];
        }
    }

    /** Cantidad disponible de un producto. undefined si nunca se seteó stock. */
    function stockDe(productoId) {
        return ctx.stockCache[productoId];
    }

    /** Cantidad ya agregada al ticket de un producto. */
    function cantidadEnCarrito(productoId) {
        const it = ctx.items.find(x => x.productoId === productoId);
        return it ? Number(it.cantidad) || 0 : 0;
    }

    function close() {
        const overlay = document.getElementById('cobrar-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 250);
        }
    }

    function renderOverlay() {
        const existing = document.getElementById('cobrar-overlay');
        if (existing) existing.remove();

        const titulo = 'Nueva venta';
        const sedeNombre = getSedeNombre();
        const sub = ctx.cita
            ? `Cita de ${ctx.cita.clienteNombre || 'Cliente'} · ${ctx.cita.hora || ''}`
            : (sedeNombre ? `Sede ${sedeNombre}` : 'Tu sede');

        const html = `
        <div id="cobrar-overlay" class="barber-modal-overlay" style="z-index:155">
            <div class="barber-modal">
                <div class="barber-modal-header">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-green-400 text-xl" style="font-variation-settings: 'FILL' 1">point_of_sale</span>
                        </div>
                        <div class="min-w-0">
                            <h2 class="text-lg font-black text-white truncate">${titulo}</h2>
                            <p class="text-white/40 text-xs truncate">${sub}</p>
                        </div>
                    </div>
                    <button onclick="closeCobrarOverlay()" class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/30 transition-all active:scale-90">
                        <span class="material-symbols-outlined text-white/60 text-lg hover:text-red-400">close</span>
                    </button>
                </div>

                <div class="barber-modal-body">
                    <!-- Vincular a una cita agendada (opcional) -->
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">event</span>
                            <span>¿Es de una cita? (opcional)</span>
                        </div>
                        <div id="cobrar-cita-selector"></div>
                    </div>

                    <!-- Items del ticket -->
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">receipt_long</span>
                            <span>Items</span>
                        </div>
                        <div id="cobrar-items-list" class="space-y-2"></div>
                    </div>

                    <!-- Agregar corte / servicio (uno o varios barberos) -->
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">content_cut</span>
                            <span>Agregar corte / servicio</span>
                        </div>
                        <div id="cobrar-corte-section"></div>
                    </div>

                    <!-- Agregar producto del catálogo (con buscador) -->
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">add_shopping_cart</span>
                            <span>Agregar producto</span>
                        </div>
                        <div class="relative mb-2">
                            <span class="material-symbols-outlined text-white/30 text-base absolute left-3 top-1/2 -translate-y-1/2">search</span>
                            <input type="text" id="cobrar-producto-search" value="${(ctx.productoSearch || '').replace(/"/g, '&quot;')}"
                                oninput="cobrarSetProductoSearch(this.value)" placeholder="Buscar producto…" autocomplete="off"
                                class="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/25 focus:outline-none focus:border-primary/50">
                        </div>
                        <div id="cobrar-productos-grid" class="grid grid-cols-2 gap-2"></div>
                    </div>

                    <!-- Método de pago -->
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">payments</span>
                            <span>Método de pago</span>
                        </div>
                        <div id="cobrar-metodos" class="grid grid-cols-3 gap-2"></div>
                        <!-- Campo "quién debe" — solo visible si método = deuda -->
                        <div id="cobrar-deuda-field" class="mt-2"></div>
                    </div>

                    <!-- Total -->
                    <div id="cobrar-total-bar" class="p-3 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-between">
                        <span class="text-white/65 text-xs font-bold uppercase tracking-wider">Total a cobrar</span>
                        <span id="cobrar-total-amount" class="text-primary text-xl font-black tabular-nums">$0</span>
                    </div>
                </div>

                <div class="barber-modal-footer">
                    <button onclick="closeCobrarOverlay()" class="flex-1 px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Cancelar
                    </button>
                    <button id="cobrar-submit" onclick="cobrarSubmit()" class="flex-[2] px-5 py-3.5 rounded-xl bg-green-500 text-black text-sm font-black uppercase tracking-wider shadow-[0_4px_20px_rgba(34,197,94,0.3)] hover:bg-green-400 transition-all active:scale-[0.97]">
                        <span class="flex items-center justify-center gap-2">
                            <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1">check_circle</span>
                            ${ctx.modo === 'cita' ? 'Cobrar y completar' : 'Registrar venta'}
                        </span>
                    </button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => document.getElementById('cobrar-overlay')?.classList.add('visible'));

        renderCitaSelector();
        renderItems();
        renderCorteSection();
        renderProductos();
        renderMetodos();
        renderDeudaField();
        renderTotal();
    }

    // Escapa texto para HTML (nombres de cliente/barbero/producto).
    function escH(x) {
        return String(x == null ? '' : x)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /** Selector de cita: chips con las citas del día; al elegir, pre-llena el corte. */
    function renderCitaSelector() {
        const cont = document.getElementById('cobrar-cita-selector');
        if (!cont) return;
        const citas = ctx.citasHoy || [];
        if (!citas.length) {
            cont.innerHTML = `<p class="text-white/30 text-[11px] py-1 pl-1">No hay citas pendientes hoy. Registrá la venta directo (walk-in).</p>`;
            return;
        }
        const chips = citas.map(c => {
            const active = ctx.cita && ctx.cita.id === c.id;
            return `<button type="button" onclick="cobrarToggleCita('${c.id}')"
                class="shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95 text-left
                    ${active ? 'bg-primary text-black' : 'bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08]'}">
                ${escH(c.clienteNombre || 'Cliente')} · ${escH(c.hora || '')}<br>
                <span class="${active ? 'text-black/60' : 'text-white/35'} text-[10px]">${escH(c.barberoNombre || '')}</span>
            </button>`;
        }).join('');
        cont.innerHTML = `<div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">${chips}</div>`;
    }

    /** Sección "Agregar corte": elegí barbero → agrega su corte (con su comisión). */
    function renderCorteSection() {
        const cont = document.getElementById('cobrar-corte-section');
        if (!cont) return;
        const barberos = ctx.barberosCache || [];
        if (!barberos.length) {
            cont.innerHTML = `<p class="text-white/30 text-[11px] py-1 pl-1">No hay barberos en esta sede. El admin los crea en la pestaña Barberos.</p>`;
            return;
        }
        const opts = barberos.map(b => `<option value="${b.id}">${escH(b.userName || b.nombre || 'Barbero')} — ${fmtCOP(b.corte?.precio || 0)}</option>`).join('');
        cont.innerHTML = `
            <div class="flex items-center gap-2">
                <select id="cobrar-corte-barbero" class="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary/50">
                    <option value="">Elegí un barbero…</option>
                    ${opts}
                </select>
                <button type="button" onclick="cobrarAddCorte()"
                    class="px-4 py-2.5 rounded-xl bg-primary/15 border border-primary/25 text-primary text-[11px] font-black uppercase tracking-wider hover:bg-primary/25 active:scale-95 transition-all whitespace-nowrap">
                    + Corte
                </button>
            </div>
            <p class="text-white/30 text-[10px] mt-1 pl-1">Podés agregar cortes de varios barberos en el mismo ticket.</p>`;
    }

    /** Agrega el corte del barbero elegido como ítem (con su comisión). */
    function addCorte() {
        const sel = document.getElementById('cobrar-corte-barbero');
        if (!sel || !sel.value) {
            if (typeof window.showToast === 'function') window.showToast('Elegí un barbero', 'info');
            return;
        }
        const b = (ctx.barberosCache || []).find(x => x.id === sel.value);
        if (!b) return;
        const precio = Number(b.corte?.precio) || 0;
        if (precio <= 0) {
            if (typeof window.showToast === 'function') window.showToast('Ese barbero no tiene precio de corte configurado', 'error');
            return;
        }
        ctx.items.push({
            tipo: 'servicio',
            nombre: 'Corte',
            barberoId: b.userId || null,
            barberoNombre: b.userName || b.nombre || '',
            comisionPct: Number(b.comisionPorcentaje) || 0,
            cantidad: 1,
            precioUnit: precio,
            subtotal: precio
        });
        sel.value = '';
        renderItems();
        renderTotal();
    }

    function setProductoSearch(v) {
        ctx.productoSearch = v || '';
        renderProductos();
    }

    /** Vincular/desvincular una cita desde los chips. */
    function toggleCita(citaId) {
        if (ctx.cita && ctx.cita.id === citaId) {
            vincularCita(null); // desvincular
        } else {
            const c = (ctx.citasHoy || []).find(x => x.id === citaId);
            vincularCita(c || null);
        }
        // re-render header sub + secciones
        renderOverlay();
    }

    // ============================================
    // RENDER
    // ============================================

    function renderItems() {
        const container = document.getElementById('cobrar-items-list');
        if (!container) return;
        if (ctx.items.length === 0) {
            container.innerHTML = '<p class="text-white/30 text-xs text-center py-3">Sin items aún — agregá productos abajo.</p>';
            return;
        }
        container.innerHTML = ctx.items.map((it, i) => {
            const sub = fmtCOP(it.subtotal);
            const unit = it.cantidad > 1 ? ` <span class="text-white/35 text-[10px]">(${it.cantidad} × ${fmtCOP(it.precioUnit)})</span>` : '';
            const iconTipo = it.tipo === 'producto' ? 'shopping_bag' : (it.tipo === 'adicional' ? 'spa' : 'content_cut');
            const closeBtn = `<button onclick="cobrarRemoveItem(${i})" class="w-6 h-6 rounded-md bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-all active:scale-90">
                      <span class="material-symbols-outlined text-red-400 text-xs">close</span>
                   </button>`;
            const barberoSub = (it.tipo !== 'producto' && it.barberoNombre)
                ? `<p class="text-white/40 text-[10px] truncate">${escH(it.barberoNombre)}</p>` : '';
            return `
                <div class="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">${iconTipo}</span>
                    <div class="flex-1 min-w-0">
                        <p class="text-white text-sm font-bold truncate">${escH(it.nombre)}${unit}</p>
                        ${barberoSub}
                    </div>
                    <span class="text-primary text-sm font-black tabular-nums shrink-0">${sub}</span>
                    ${closeBtn}
                </div>`;
        }).join('');
    }

    function renderProductos() {
        const container = document.getElementById('cobrar-productos-grid');
        if (!container) return;
        const todos = ctx.productosCache || [];
        if (todos.length === 0) {
            container.innerHTML = `
                <p class="col-span-2 text-white/30 text-xs text-center py-3">
                    Sin productos en el catálogo. El admin los agrega en la pestaña Inventario.
                </p>`;
            return;
        }
        const q = (ctx.productoSearch || '').trim().toLowerCase();
        const productos = q ? todos.filter(p => (p.nombre || '').toLowerCase().includes(q)) : todos;
        if (productos.length === 0) {
            container.innerHTML = `<p class="col-span-2 text-white/30 text-xs text-center py-3">Ningún producto coincide con "${escH(ctx.productoSearch)}".</p>`;
            return;
        }
        container.innerHTML = productos.map(p => {
            const stock = stockDe(p.id);
            const enCarrito = cantidadEnCarrito(p.id);
            const disponibleNow = (stock === undefined) ? null : Math.max(0, stock - enCarrito);
            const agotado = disponibleNow === 0;

            // Etiqueta de stock: "5 disp." / "Agotado" / "Sin registro" (si nunca se seteó)
            let stockBadge = '';
            if (stock === undefined) {
                stockBadge = `<span class="block text-white/30 text-[9px] font-bold uppercase tracking-wider">Sin registro</span>`;
            } else if (agotado) {
                stockBadge = `<span class="block text-red-400 text-[9px] font-black uppercase tracking-wider">Agotado</span>`;
            } else if (stock <= 3) {
                stockBadge = `<span class="block text-amber-400 text-[9px] font-black uppercase tracking-wider">${disponibleNow} disp.</span>`;
            } else {
                stockBadge = `<span class="block text-white/40 text-[9px] font-bold uppercase tracking-wider">${disponibleNow} disp.</span>`;
            }

            const disabled = agotado ? 'disabled' : '';
            const stateClass = agotado
                ? 'opacity-50 cursor-not-allowed bg-white/[0.02] border-white/[0.05]'
                : 'bg-white/[0.03] border-white/[0.08] hover:border-primary/30 hover:bg-primary/5 active:scale-[0.97]';

            return `
                <button type="button" onclick="cobrarAddProducto('${p.id}')" ${disabled}
                    class="flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-all text-left ${stateClass}">
                    <span class="min-w-0">
                        <span class="block text-white text-xs font-bold truncate">${p.nombre}</span>
                        <span class="block text-primary text-xs font-black tabular-nums">${fmtCOP(p.precio || 0)}</span>
                        ${stockBadge}
                    </span>
                    <span class="material-symbols-outlined ${agotado ? 'text-red-400/50' : 'text-white/30'} text-base shrink-0">${agotado ? 'block' : 'add_circle'}</span>
                </button>
            `;
        }).join('');
    }

    function renderMetodos() {
        const container = document.getElementById('cobrar-metodos');
        if (!container) return;
        container.innerHTML = METODOS.map(m => {
            const meta = METODO_META[m];
            const active = ctx.metodoPago === m;
            return `
                <button type="button" onclick="cobrarSelectMetodo('${m}')"
                    class="flex flex-col items-center gap-1 px-2 py-3 rounded-xl transition-all active:scale-[0.97]
                        ${active ? 'bg-primary text-black shadow-[0_4px_15px_rgba(201,167,74,0.25)]' : 'bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-white/[0.08]'}">
                    <span class="material-symbols-outlined text-lg" style="font-variation-settings: 'FILL' ${active ? 1 : 0}">${meta.icon}</span>
                    <span class="text-[11px] font-black uppercase tracking-wider">${meta.label}</span>
                </button>
            `;
        }).join('');
    }

    /**
     * Campo dinámico para "deuda". Solo aparece cuando metodoPago === 'deuda'.
     * - En modo 'cita' el que debe es el cliente de la cita → solo mostramos
     *   una nota (no pedimos nombre, ya lo tenemos).
     * - En modo 'directa' no hay cliente asociado → pedimos el nombre de quien
     *   queda debiendo, para que el admin sepa a quién cobrarle al cuadrar caja.
     */
    function renderDeudaField() {
        const container = document.getElementById('cobrar-deuda-field');
        if (!container) return;
        if (ctx.metodoPago !== 'deuda') {
            container.innerHTML = '';
            return;
        }
        if (ctx.cita) {
            const cliente = escH(ctx.cita.clienteNombre || 'el cliente');
            container.innerHTML = `
                <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2">
                    <span class="material-symbols-outlined text-amber-400 text-base" style="font-variation-settings: 'FILL' 1">info</span>
                    <p class="text-amber-200/90 text-[11px] font-bold">Queda como deuda de <span class="text-amber-300">${cliente}</span>. El admin lo revisa al cuadrar caja.</p>
                </div>`;
            return;
        }
        // Sin cita vinculada: pedir nombre del deudor
        container.innerHTML = `
            <label class="block">
                <span class="text-amber-300 text-[10px] font-black uppercase tracking-wider">¿Quién queda debiendo?</span>
                <input type="text" id="cobrar-deudor-input" value="${(ctx.deudorNombre || '').replace(/"/g, '&quot;')}"
                    oninput="cobrarSetDeudor(this.value)" placeholder="Nombre de quien debe"
                    class="mt-1 w-full px-3 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/25 text-white text-sm font-bold placeholder-white/25 focus:outline-none focus:border-amber-400/50">
            </label>`;
    }

    function renderTotal() {
        const amount = document.getElementById('cobrar-total-amount');
        if (amount) amount.textContent = fmtCOP(calcularSubtotal());
    }

    // ============================================
    // INTERACCIÓN
    // ============================================

    function addProducto(productoId) {
        const p = ctx.productosCache.find(x => x.id === productoId);
        if (!p) return;

        // F4: validar stock. Si stock está registrado, no permitir exceder.
        // Si nunca se registró (undefined), dejamos pasar — "sin registro" no
        // bloquea (el admin todavía no setea el inventario para ese producto).
        const stock = stockDe(productoId);
        const enCarrito = cantidadEnCarrito(productoId);
        if (stock !== undefined && enCarrito + 1 > stock) {
            if (typeof window.showToast === 'function') {
                window.showToast(`Solo hay ${stock} en stock`, 'error');
            }
            return;
        }

        // Si ya está en items, incrementamos la cantidad
        const existing = ctx.items.find(it => it.productoId === productoId);
        if (existing) {
            existing.cantidad += 1;
            existing.subtotal = existing.cantidad * existing.precioUnit;
        } else {
            ctx.items.push({
                tipo: 'producto',
                productoId: p.id,
                nombre: p.nombre,
                cantidad: 1,
                precioUnit: Number(p.precio) || 0,
                subtotal: Number(p.precio) || 0
            });
        }
        renderItems();
        renderProductos(); // re-render para actualizar "X disp." restando lo del carrito
        renderTotal();
    }

    function removeItem(index) {
        if (index < 0 || index >= ctx.items.length) return;
        ctx.items.splice(index, 1);
        renderItems();
        renderProductos(); // recupera el "X disp." en el grid si era producto
        renderTotal();
    }

    function selectMetodo(metodo) {
        if (!METODOS.includes(metodo)) return;
        ctx.metodoPago = metodo;
        renderMetodos();
        renderDeudaField();
    }

    function setDeudor(value) {
        ctx.deudorNombre = value || '';
    }

    // ============================================
    // SUBMIT
    // ============================================

    /**
     * Submit atómico (FIX #3 de inspección).
     *
     * Antes: 1) create venta, 2) update cita. Si la cita fallaba (típico:
     * cita vieja sin sedeId que las rules rechazan), la venta quedaba y la
     * cita seguía en confirmada → segundo intento creaba venta duplicada.
     *
     * Ahora usamos `db.batch()`. Pre-generamos el ventaId con `.doc()` para
     * poder denormalizarlo en la cita, y commiteamos venta+cita juntas.
     * Si una falla, ambas son rollback. Sin doble cobro.
     */
    async function submit() {
        const sedeId = getSedeId();
        if (!sedeId) {
            if (typeof window.showToast === 'function') window.showToast('Sin sede asignada', 'error');
            return;
        }
        const total = calcularSubtotal();
        if (total <= 0) {
            if (typeof window.showToast === 'function') window.showToast('Total en 0 — agregá items', 'error');
            return;
        }
        // F-caja: si es deuda y NO hay cita vinculada, exigir el nombre de quien debe.
        if (ctx.metodoPago === 'deuda' && !ctx.cita && !(ctx.deudorNombre || '').trim()) {
            if (typeof window.showToast === 'function') window.showToast('Escribí quién queda debiendo', 'error');
            const inp = document.getElementById('cobrar-deudor-input');
            if (inp) inp.focus();
            return;
        }

        const database = firebaseAdapter?.db;
        if (!database) {
            if (typeof window.showToast === 'function') window.showToast('Firebase no disponible', 'error');
            return;
        }

        const user = getCurrentUser();
        const submitBtn = document.getElementById('cobrar-submit');
        const orig = submitBtn?.innerHTML;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="auth-checking-spinner" style="width:1.2rem;height:1.2rem;border-width:2px;margin:0 auto"></div>';
        }

        // Pre-genera el id de la venta antes del commit → podemos denormalizarlo
        // en la cita en el mismo batch.
        const ventaRef = database.collection('ventas').doc();
        const ventaId = ventaRef.id;
        const serverTS = firebase.firestore.FieldValue.serverTimestamp();

        // Comisión POR ÍTEM: cada corte/adicional lleva su barbero + %. Esto
        // permite VARIOS barberos en una sola cuenta (la mamá con dos hijos).
        // Los productos NO generan comisión (quedan 100% para la barbería).
        const comisionPorBarbero = {};
        let comisionMonto = 0;
        ctx.items.forEach(it => {
            if (it.tipo === 'producto') return;
            const bid = it.barberoId;
            if (!bid) return;
            const pct = Number(it.comisionPct) || 0;
            const m = Math.round((Number(it.subtotal) || 0) * pct / 100);
            if (m > 0) {
                comisionPorBarbero[bid] = (comisionPorBarbero[bid] || 0) + m;
                comisionMonto += m;
            }
        });
        // Barberos presentes en el ticket (para consultar sus ventas por array-contains).
        const barberoIds = [...new Set(ctx.items.filter(it => it.tipo !== 'producto' && it.barberoId).map(it => it.barberoId))];
        const primerServicio = ctx.items.find(it => it.tipo !== 'producto' && it.barberoId) || null;

        const ventaDoc = {
            sedeId,
            fecha: todayISO(),
            fechaHora: serverTS,

            citaId: ctx.cita?.id || null,
            clienteId: ctx.cita?.clienteId || null,
            // Sin cita y con deuda usamos el nombre del deudor; si hay cita, su cliente.
            clienteNombre: (!ctx.cita && ctx.metodoPago === 'deuda' && ctx.deudorNombre.trim())
                ? ctx.deudorNombre.trim()
                : (ctx.cita?.clienteNombre || 'Cliente'),
            // Barbero "principal" (primer corte) para mostrar en listados simples.
            barberoId: primerServicio?.barberoId || null,
            barberoNombre: primerServicio?.barberoNombre || '',
            // Todos los barberos del ticket + su comisión (modelo multi-barbero).
            barberoIds,
            comisionPorBarbero,

            items: ctx.items.map(it => ({ ...it })),
            subtotal: total,
            total,
            metodoPago: ctx.metodoPago,
            esDeuda: ctx.metodoPago === 'deuda',
            // Comisión total denormalizada (suma de comisionPorBarbero).
            comisionMonto,

            cobradoPor: user?.uid || null,
            cobradoPorNombre: user?.displayName || '',
            tipo: ctx.cita ? 'cita' : 'venta_directa',
            // F5: denormalizamos el flag walk-in de la cita original para que
            // reportes pueda separar "citas reservadas con app" vs "walk-ins".
            walkin: !!ctx.cita?.walkin,
            createdAt: serverTS
        };

        const batch = database.batch();
        batch.set(ventaRef, ventaDoc);

        if (ctx.cita?.id) {
            const citaRef = database.collection('citas').doc(ctx.cita.id);
            batch.update(citaRef, {
                estado: 'completada',
                completedAt: serverTS,
                updatedAt: serverTS,
                totalCobrado: total,
                metodoPago: ctx.metodoPago,
                ventaId
            });
        }

        // F4: agregar al MISMO batch los decrementos de stock + sus movimientos
        // de auditoría. Si falla la venta o la cita, el stock también se rollback.
        // El tipo 'setMerge' soporta el fix crítico: si el producto nunca tuvo
        // stock registrado, crea el doc con cantidad negativa en vez de fallar.
        if (typeof StockService !== 'undefined') {
            const stockOps = StockService.buildOpsVenta({
                items: ctx.items,
                sedeId,
                ventaId,
                creadoPor: user?.uid || null,
                creadoPorNombre: user?.displayName || ''
            });
            stockOps.forEach(op => {
                if (op.type === 'setMerge') batch.set(op.ref, op.data, { merge: true });
                else if (op.type === 'update') batch.update(op.ref, op.data);
                else if (op.type === 'set') batch.set(op.ref, op.data);
            });
        }

        try {
            await batch.commit();
        } catch (e) {
            console.error('❌ Cobro atómico falló:', e);
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = orig; }
            if (typeof window.showToast === 'function') {
                // Mensajes específicos por causa más común
                let msg;
                if (ctx.cita) {
                    msg = 'No se pudo cobrar. ¿La cita es vieja sin sede? Pedile al admin que la asigne.';
                } else if (ctx.items.some(it => it.tipo === 'producto')) {
                    msg = 'No se pudo registrar. Quizás el stock de algún producto está mal — revisá Inventario.';
                } else {
                    msg = 'No se pudo registrar la venta';
                }
                window.showToast(msg, 'error');
            }
            return;
        }

        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = orig; }
        if (typeof window.showToast === 'function') {
            window.showToast(`Cobrado ${fmtCOP(total)} (${METODO_META[ctx.metodoPago].label.toLowerCase()}) ✓`, 'success');
        }

        close();

        // Notificar al resto del UI
        if (ctx.cita?.id && typeof window.onRecepCobroCita === 'function') {
            window.onRecepCobroCita(ctx.cita.id, { total, metodoPago: ctx.metodoPago });
        }
        if (typeof window.onRecepVentaCreada === 'function') {
            window.onRecepVentaCreada(ventaId);
        }
    }

    // ============================================
    // EXPONER
    // ============================================

    window.openCobrarParaCita = openParaCita;
    window.openVentaDirecta = openVentaDirecta;
    window.closeCobrarOverlay = close;
    window.cobrarAddProducto = addProducto;
    window.cobrarRemoveItem = removeItem;
    window.cobrarSelectMetodo = selectMetodo;
    window.cobrarSetDeudor = setDeudor;
    window.cobrarSubmit = submit;
    window.cobrarAddCorte = addCorte;
    window.cobrarSetProductoSearch = setProductoSearch;
    window.cobrarToggleCita = toggleCita;

    console.log('✓ RecepcionistaCobrarUI (F3) loaded');
})();
