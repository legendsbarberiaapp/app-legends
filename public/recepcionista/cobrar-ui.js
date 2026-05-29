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

    const METODOS = ['efectivo', 'tarjeta', 'transferencia'];
    const METODO_META = {
        efectivo:      { label: 'Efectivo',      icon: 'payments'  },
        tarjeta:       { label: 'Tarjeta',       icon: 'credit_card' },
        transferencia: { label: 'Transferencia', icon: 'account_balance' }
    };

    // Estado del overlay
    const ctx = {
        modo: null,           // 'cita' | 'directa'
        cita: null,           // referencia cuando modo='cita'
        items: [],            // {tipo,nombre,cantidad,precioUnit,subtotal,productoId?,protegido?}
        metodoPago: 'efectivo',
        productosCache: []
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
    async function openParaCita(cita) {
        ctx.modo = 'cita';
        ctx.cita = cita;
        ctx.items = itemsDesdeCita(cita);
        ctx.metodoPago = 'efectivo';
        await loadProductos();
        renderOverlay();
    }

    /**
     * Abre el overlay en modo 'directa' (venta sin cita).
     */
    async function openVentaDirecta() {
        ctx.modo = 'directa';
        ctx.cita = null;
        ctx.items = [];
        ctx.metodoPago = 'efectivo';
        await loadProductos();
        renderOverlay();
    }

    async function loadProductos() {
        try {
            ctx.productosCache = (typeof ProductosService !== 'undefined')
                ? await ProductosService.list({ soloActivos: true })
                : [];
        } catch (e) {
            ctx.productosCache = [];
        }
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

        const titulo = ctx.modo === 'cita' ? 'Cobrar cita' : 'Venta directa';
        const sedeNombre = getSedeNombre();
        const sub = ctx.modo === 'cita'
            ? `${ctx.cita?.clienteNombre || 'Cliente'} · ${ctx.cita?.hora || ''}`
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
                    <!-- Items del ticket -->
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">receipt_long</span>
                            <span>Items</span>
                        </div>
                        <div id="cobrar-items-list" class="space-y-2"></div>
                    </div>

                    <!-- Agregar producto del catálogo -->
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">add_shopping_cart</span>
                            <span>Agregar producto</span>
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

        renderItems();
        renderProductos();
        renderMetodos();
        renderTotal();
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
            const closeBtn = it.protegido
                ? ''
                : `<button onclick="cobrarRemoveItem(${i})" class="w-6 h-6 rounded-md bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-all active:scale-90">
                      <span class="material-symbols-outlined text-red-400 text-xs">close</span>
                   </button>`;
            return `
                <div class="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">${iconTipo}</span>
                    <div class="flex-1 min-w-0">
                        <p class="text-white text-sm font-bold truncate">${it.nombre}${unit}</p>
                    </div>
                    <span class="text-primary text-sm font-black tabular-nums shrink-0">${sub}</span>
                    ${closeBtn}
                </div>`;
        }).join('');
    }

    function renderProductos() {
        const container = document.getElementById('cobrar-productos-grid');
        if (!container) return;
        const productos = ctx.productosCache || [];
        if (productos.length === 0) {
            container.innerHTML = `
                <p class="col-span-2 text-white/30 text-xs text-center py-3">
                    Sin productos en el catálogo. El admin puede agregar desde Barberos → Productos.
                </p>`;
            return;
        }
        container.innerHTML = productos.map(p => `
            <button type="button" onclick="cobrarAddProducto('${p.id}')"
                class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-primary/30 hover:bg-primary/5 transition-all active:scale-[0.97] text-left">
                <span class="min-w-0">
                    <span class="block text-white text-xs font-bold truncate">${p.nombre}</span>
                    <span class="block text-primary text-xs font-black tabular-nums">${fmtCOP(p.precio || 0)}</span>
                </span>
                <span class="material-symbols-outlined text-white/30 text-base shrink-0">add_circle</span>
            </button>
        `).join('');
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
        renderTotal();
    }

    function removeItem(index) {
        if (index < 0 || index >= ctx.items.length) return;
        ctx.items.splice(index, 1);
        renderItems();
        renderTotal();
    }

    function selectMetodo(metodo) {
        if (!METODOS.includes(metodo)) return;
        ctx.metodoPago = metodo;
        renderMetodos();
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

        const ventaDoc = {
            sedeId,
            fecha: todayISO(),
            fechaHora: serverTS,

            citaId: ctx.cita?.id || null,
            clienteId: ctx.cita?.clienteId || null,
            clienteNombre: ctx.cita?.clienteNombre || 'Cliente',
            barberoId: ctx.cita?.barberoId || null,
            barberoNombre: ctx.cita?.barberoNombre || '',

            items: ctx.items.map(({ protegido, ...rest }) => rest), // limpiar flag UI legacy si quedaba
            subtotal: total,
            total,
            metodoPago: ctx.metodoPago,

            cobradoPor: user?.uid || null,
            cobradoPorNombre: user?.displayName || '',
            tipo: ctx.modo === 'cita' ? 'cita' : 'venta_directa',
            createdAt: serverTS
        };

        const batch = database.batch();
        batch.set(ventaRef, ventaDoc);

        if (ctx.modo === 'cita' && ctx.cita?.id) {
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

        try {
            await batch.commit();
        } catch (e) {
            console.error('❌ Cobro atómico falló:', e);
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = orig; }
            if (typeof window.showToast === 'function') {
                // Mensaje específico para el caso más común: cita vieja sin sedeId
                const msg = ctx.modo === 'cita'
                    ? 'No se pudo cobrar. ¿La cita es vieja sin sede? Pedile al admin que la asigne.'
                    : 'No se pudo registrar la venta';
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
        if (ctx.modo === 'cita' && typeof window.onRecepCobroCita === 'function') {
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
    window.cobrarSubmit = submit;

    console.log('✓ RecepcionistaCobrarUI (F3) loaded');
})();
