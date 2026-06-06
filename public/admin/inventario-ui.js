/**
 * LEGENDS BARBERIA - ADMIN: INVENTARIO (F8)
 *
 * Tab admin con vista de inventario por sede. Reemplaza la navegación
 * profunda (Barberos → 📦 Productos → 📦 Stock) por una pantalla dedicada
 * donde el admin ve todo de un solo vistazo y edita inline.
 *
 * Bloques:
 *   1. Botón "+ Agregar Producto" (modal pide nombre + precio + UMBRAL mínimo)
 *   2. Filtro sede (Todas / Sede 1 / Sede 2 / ...)
 *   3. Card resumen de alertas (productos bajo stock, agotados, sobrevendidos)
 *   4. Lista de productos:
 *      - Si filtro = sede específica: card por producto con cantidad + mínimo
 *        editables inline para ESA sede.
 *      - Si filtro = Todas: card por producto con un sub-row por cada sede.
 *
 * Datos: ProductosService (catálogo) + SedesService + StockService.
 * Independiente de BarberManager (no necesita que la tab Barberos cargue).
 */
(function () {
    'use strict';

    const state = {
        productos: [],       // F9: solo los de la sede seleccionada
        sedes: [],
        // Map<productoId, Map<sedeId, {cantidad, minimo}>>
        stockByProductoSede: new Map(),
        // F9: sede activa. SIN opción "Todas" — cada sede maneja su propio
        // catálogo separado (el admin decidió que es el modelo real).
        sedeFilter: null,    // sedeId (se setea a primera sede al cargar)
        loading: false,
        fetchToken: 0        // anti-race (mismo patrón que F5)
    };

    function fmtCOP(n) {
        return (typeof window.formatCOP === 'function') ? window.formatCOP(n || 0) : `$${n || 0}`;
    }
    function getCurrentUser() {
        return (typeof roleManager !== 'undefined') ? roleManager.currentUser : null;
    }
    function toast(msg, type) {
        if (typeof window.showToast === 'function') window.showToast(msg, type || 'success');
    }

    // ============================================
    // INIT
    // ============================================

    async function init() {
        const list = document.getElementById('inv-admin-list');
        if (!list) return;

        const myToken = ++state.fetchToken;
        const isCurrent = () => state.fetchToken === myToken;

        renderFiltro();

        list.innerHTML = `
            <div class="flex flex-col items-center gap-3 py-12">
                <div class="auth-checking-spinner"></div>
                <p class="text-white/50 text-xs">Cargando inventario...</p>
            </div>`;

        try {
            // F9: primero cargo sedes y aseguro que haya una seleccionada.
            // Después cargo productos SOLO de esa sede.
            if (state.sedes.length === 0 && typeof SedesService !== 'undefined') {
                state.sedes = (await SedesService.list()) || [];
            }
            if (!isCurrent()) return;

            // Auto-seleccionar primera sede si no hay una seteada
            if (!state.sedeFilter && state.sedes.length > 0) {
                state.sedeFilter = state.sedes[0].id;
            }

            if (!state.sedeFilter) {
                if (!isCurrent()) return;
                list.innerHTML = renderError('No hay sedes configuradas todavía');
                return;
            }

            // Cargar productos de la sede seleccionada + stock de esa sede
            const [productos, stockRows] = await Promise.all([
                (typeof ProductosService !== 'undefined')
                    ? ProductosService.listBySede(state.sedeFilter)
                    : Promise.resolve([]),
                (typeof StockService !== 'undefined')
                    ? StockService.listBySede(state.sedeFilter)
                    : Promise.resolve([])
            ]);
            if (!isCurrent()) return;

            state.productos = productos || [];

            // Indexar stock por producto (solo de esta sede)
            state.stockByProductoSede = new Map();
            (stockRows || []).forEach(row => {
                if (!state.stockByProductoSede.has(row.productoId)) {
                    state.stockByProductoSede.set(row.productoId, new Map());
                }
                state.stockByProductoSede.get(row.productoId).set(state.sedeFilter, {
                    cantidad: Number(row.cantidad) || 0,
                    minimo: Number(row.minimo) || 0
                });
            });

            renderFiltro();
            renderAlertas();
            renderLista();
        } catch (e) {
            console.error('❌ Error cargando inventario admin:', e);
            if (!isCurrent()) return;
            list.innerHTML = renderError('No se pudo cargar el inventario');
        }
    }

    function renderError(msg) {
        return `
            <div class="text-center py-10 px-6 rounded-xl bg-red-500/5 border border-red-500/15">
                <span class="material-symbols-outlined text-red-400 text-4xl mb-2">error</span>
                <p class="text-red-400 text-sm font-bold">${msg}</p>
                <button onclick="initInventarioAdmin()" class="mt-4 px-4 py-2 bg-primary/20 text-primary text-xs font-black rounded-lg border border-primary/30">
                    Reintentar
                </button>
            </div>`;
    }

    // ============================================
    // FILTRO SEDE
    // ============================================

    function renderFiltro() {
        const container = document.getElementById('inv-admin-sede-filter');
        if (!container) return;
        // F9: SIN opción "Todas" — cada sede tiene su propio catálogo.
        const pill = (label, value, icon) => {
            const active = state.sedeFilter === value;
            return `
                <button onclick="setInvAdminSedeFilter('${value}')" aria-pressed="${active}"
                    class="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-[0.97]
                        ${active ? 'bg-primary text-black shadow-[0_4px_15px_rgba(201,167,74,0.25)]' : 'bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-white/[0.07]'}">
                    <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1" aria-hidden="true">${icon}</span>
                    <span class="truncate">${label}</span>
                </button>`;
        };
        const pills = (state.sedes || []).map(s => pill(s.nombre, s.id, 'storefront')).join('');
        container.innerHTML = pills;
    }

    function setSedeFilter(value) {
        if (state.sedeFilter === value) return;
        state.sedeFilter = value;
        // F9: cambiar de sede = reload completo (productos son por sede).
        init();
    }

    // ============================================
    // ALERTAS
    // ============================================

    function getEstado(cantidad, minimo) {
        if (cantidad < 0) return 'negativo';
        if (cantidad === 0) return 'agotado';
        if (minimo > 0 && cantidad <= minimo) return 'bajo';
        return 'ok';
    }

    function alertasCount() {
        let agotados = 0, bajos = 0, neg = 0;
        // F9: el filtro es siempre 1 sede específica.
        state.productos.forEach(p => {
            const data = state.stockByProductoSede.get(p.id)?.get(state.sedeFilter);
            if (!data) return;
            const e = getEstado(data.cantidad, data.minimo);
            if (e === 'negativo') neg++;
            else if (e === 'agotado') agotados++;
            else if (e === 'bajo') bajos++;
        });
        return { agotados, bajos, neg };
    }

    function renderAlertas() {
        const container = document.getElementById('inv-admin-alertas');
        if (!container) return;
        const { agotados, bajos, neg } = alertasCount();
        const total = agotados + bajos + neg;
        if (total === 0) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = `
            <div class="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25">
                <div class="flex items-center gap-2 mb-2">
                    <span class="material-symbols-outlined text-red-400 text-base" style="font-variation-settings: 'FILL' 1">warning</span>
                    <p class="text-red-400 text-[10px] font-black uppercase tracking-[0.2em]">Atención al inventario</p>
                </div>
                <div class="flex items-center gap-3 text-[11px] flex-wrap">
                    ${neg > 0 ? `<span class="text-red-400 font-black">${neg} sobrevendido${neg > 1 ? 's' : ''}</span>` : ''}
                    ${agotados > 0 ? `<span class="text-red-400 font-black">${agotados} agotado${agotados > 1 ? 's' : ''}</span>` : ''}
                    ${bajos > 0 ? `<span class="text-amber-400 font-black">${bajos} bajo${bajos > 1 ? 's' : ''}</span>` : ''}
                </div>
            </div>`;
    }

    // ============================================
    // LISTA DE PRODUCTOS
    // ============================================

    function renderLista() {
        const container = document.getElementById('inv-admin-list');
        if (!container) return;
        if (state.productos.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center gap-3 py-10 px-6 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <span class="material-symbols-outlined text-white/20 text-5xl" style="font-variation-settings: 'FILL' 1">inventory_2</span>
                    <p class="text-white/50 text-sm font-bold text-center">No hay productos en el catálogo</p>
                    <p class="text-white/25 text-[11px] text-center">Tocá "+ Agregar Producto" para empezar</p>
                </div>`;
            return;
        }
        container.innerHTML = state.productos.map(productoCard).join('');
    }

    function badgeForEstado(estado) {
        if (estado === 'sin-registro') return { cls: 'bg-white/5 text-white/40 border-white/10', icon: 'help', label: 'Sin registro' };
        if (estado === 'agotado') return { cls: 'bg-red-500/15 text-red-400 border-red-500/30', icon: 'error', label: 'Agotado' };
        if (estado === 'negativo') return { cls: 'bg-red-500/15 text-red-400 border-red-500/30', icon: 'error', label: 'Sobrevendido' };
        if (estado === 'bajo') return { cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: 'warning', label: 'Bajo' };
        return { cls: 'bg-green-500/10 text-green-400 border-green-500/20', icon: 'check_circle', label: 'OK' };
    }

    function productoCard(p) {
        const activo = p.activo !== false;
        // F9: solo la sede del filtro (siempre 1).
        const sedesVisibles = state.sedes.filter(s => s.id === state.sedeFilter);

        const safeName = (p.nombre || '').replace(/"/g, '&quot;');
        const headerActions = `
            <div class="flex items-center gap-1">
                <button onclick="openEditarProductoModal('${p.id}')"
                    title="Editar nombre/precio"
                    class="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:border-primary/30 transition-all active:scale-95">
                    <span class="material-symbols-outlined text-white/60 text-sm hover:text-primary">edit</span>
                </button>
                <button onclick="toggleProductoActivoInv('${p.id}', this)"
                    title="${activo ? 'Desactivar' : 'Activar'}"
                    class="w-8 h-8 rounded-lg ${activo ? 'bg-green-500/10 border border-green-500/25' : 'bg-white/5 border border-white/10'} flex items-center justify-center transition-all active:scale-95">
                    <span class="material-symbols-outlined ${activo ? 'text-green-400' : 'text-white/40'} text-sm" style="font-variation-settings: 'FILL' ${activo ? 1 : 0}">${activo ? 'check_circle' : 'visibility_off'}</span>
                </button>
                <button onclick="confirmDeleteProductoInv('${p.id}', '${safeName}')"
                    title="Eliminar"
                    class="w-8 h-8 rounded-lg bg-transparent flex items-center justify-center hover:bg-red-500/20 transition-all active:scale-95">
                    <span class="material-symbols-outlined text-red-400 text-sm">close</span>
                </button>
            </div>`;

        const rowsSede = sedesVisibles.map(s => {
            const data = state.stockByProductoSede.get(p.id)?.get(s.id);
            const cantidad = data ? data.cantidad : 0;
            const minimo = data ? data.minimo : 0;
            const sinRegistro = !data;
            const estado = sinRegistro ? 'sin-registro' : getEstado(cantidad, minimo);
            const b = badgeForEstado(estado);

            return `
                <div class="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1">storefront</span>
                        <p class="flex-1 text-white text-sm font-black truncate">${s.nombre}</p>
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${b.cls}">
                            <span class="material-symbols-outlined text-[10px]" style="font-variation-settings: 'FILL' 1">${b.icon}</span>
                            ${b.label}
                        </span>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1 pl-1">Cantidad</p>
                            <input id="inv-cant-${p.id}-${s.id}" type="number" inputmode="numeric" min="0" value="${cantidad}"
                                class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-black tabular-nums outline-none focus:border-primary/50 transition-colors">
                        </div>
                        <div>
                            <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1 pl-1">Mín. alerta</p>
                            <input id="inv-min-${p.id}-${s.id}" type="number" inputmode="numeric" min="0" value="${minimo}"
                                class="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-bold tabular-nums outline-none focus:border-primary/50 transition-colors">
                        </div>
                    </div>
                    <button onclick="saveStockInv('${p.id}', '${s.id}', this)"
                        class="w-full mt-2 px-3 py-2 rounded-lg bg-primary/15 border border-primary/25 text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/25 transition-all active:scale-95">
                        Guardar
                    </button>
                </div>`;
        }).join('');

        return `
            <div class="mb-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] ${activo ? '' : 'opacity-60'}">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1">shopping_bag</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-white text-sm font-black truncate">${safeName}</p>
                        <p class="text-primary text-xs font-bold tabular-nums">${fmtCOP(p.precio || 0)}</p>
                    </div>
                    ${headerActions}
                </div>
                <div class="space-y-2">${rowsSede}</div>
            </div>`;
    }

    // ============================================
    // ACTIONS POR FILA SEDE
    // ============================================

    async function saveStock(productoId, sedeId, btnEl) {
        const cantInput = document.getElementById(`inv-cant-${productoId}-${sedeId}`);
        const minInput = document.getElementById(`inv-min-${productoId}-${sedeId}`);
        const cantidad = parseInt(cantInput?.value || '0', 10);
        const minimo = parseInt(minInput?.value || '0', 10);

        if (isNaN(cantidad) || cantidad < 0) { toast('Cantidad inválida', 'error'); return; }
        if (isNaN(minimo) || minimo < 0) { toast('Mínimo inválido', 'error'); return; }

        const user = getCurrentUser();
        const orig = btnEl?.innerHTML;
        if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '...'; }

        try {
            // F4 patrón: setMinimo PRIMERO, ajustar después
            const okMin = await StockService.setMinimo({ productoId, sedeId, minimo });
            if (!okMin) {
                toast('Error guardando el mínimo', 'error');
                if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = orig; }
                return;
            }
            const okAj = await StockService.ajustar({
                productoId, sedeId, nuevaCantidad: cantidad,
                notas: 'Ajuste desde Inventario admin',
                creadoPor: user?.uid || null,
                creadoPorNombre: user?.displayName || ''
            });
            if (!okAj) {
                toast('Error guardando cantidad (mínimo sí se guardó)', 'error');
                if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = orig; }
                return;
            }
            // Actualizar cache local
            if (!state.stockByProductoSede.has(productoId)) {
                state.stockByProductoSede.set(productoId, new Map());
            }
            state.stockByProductoSede.get(productoId).set(sedeId, { cantidad, minimo });
            renderAlertas();
            renderLista();
            toast('Stock actualizado ✓', 'success');
        } catch (e) {
            console.error('❌ Error guardando stock:', e);
            toast('Error al guardar', 'error');
            if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = orig; }
        }
    }

    async function toggleActivo(id, btnEl) {
        const p = state.productos.find(x => x.id === id);
        if (!p) return;
        const nuevoEstado = p.activo === false;
        const ok = await ProductosService.update(id, { activo: nuevoEstado });
        if (!ok) { toast('Error guardando', 'error'); return; }
        p.activo = nuevoEstado;
        renderLista();
        toast(nuevoEstado ? `"${p.nombre}" activado ✓` : `"${p.nombre}" oculto del catálogo`, 'success');
    }

    async function confirmDelete(id, nombre) {
        // F9: el producto pertenece a 1 sola sede, chequeamos solo esa.
        const data = state.stockByProductoSede.get(id)?.get(state.sedeFilter);
        if (data && (data.cantidad || 0) > 0) {
            toast(`No se puede eliminar "${nombre}": tiene ${data.cantidad} en stock. Ponelo en 0 o desactivá el producto.`, 'error');
            return;
        }
        const ok0 = await window.uiConfirm({ title: `¿Eliminar "${nombre}"?`, message: 'Las ventas históricas se conservan.', confirmText: 'Sí, eliminar', danger: true, icon: 'delete' });
        if (!ok0) return;
        const ok = await ProductosService.remove(id);
        if (!ok) { toast('Error eliminando', 'error'); return; }
        toast(`"${nombre}" eliminado`, 'success');
        init();
    }

    // ============================================
    // MODAL: AGREGAR PRODUCTO
    // ============================================

    function openAgregar() {
        if (!state.sedeFilter || state.sedes.length === 0) {
            toast('No hay sedes configuradas', 'error');
            return;
        }
        const existing = document.getElementById('inv-agregar-overlay');
        if (existing) existing.remove();

        // F9: selector de sede (default = sede actualmente filtrada).
        const sedesOptions = state.sedes.map(s => {
            const selected = s.id === state.sedeFilter ? 'selected' : '';
            return `<option value="${s.id}" ${selected}>${s.nombre}</option>`;
        }).join('');

        const html = `
        <div id="inv-agregar-overlay" class="barber-modal-overlay" style="z-index:160">
            <div class="barber-confirm-dialog" style="max-width:460px">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1">add_box</span>
                    </div>
                    <div>
                        <h3 class="text-white font-black text-base">Agregar Producto</h3>
                        <p class="text-white/40 text-[10px] uppercase tracking-wider font-bold">Para una sede específica</p>
                    </div>
                </div>

                <div class="space-y-3 mb-4">
                    <div>
                        <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1.5 pl-1">Sede</p>
                        <select id="inv-new-sede" class="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold outline-none focus:border-primary/50 transition-colors">
                            ${sedesOptions}
                        </select>
                        <p class="text-white/35 text-[10px] mt-1.5 pl-1">El producto se crea solo en esta sede. Si lo querés también en la otra, lo agregás aparte (cada sede maneja su propio inventario).</p>
                    </div>
                    <div>
                        <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1.5 pl-1">Nombre</p>
                        <input id="inv-new-nombre" type="text" maxlength="40" placeholder="Ej: Cera mate"
                            class="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold outline-none focus:border-primary/50 transition-colors">
                    </div>
                    <div>
                        <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1.5 pl-1">Precio</p>
                        <div class="relative">
                            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-black text-sm pointer-events-none">$</div>
                            <input id="inv-new-precio" type="text" inputmode="numeric" placeholder="0"
                                class="price-input w-full px-3 py-2.5 pl-7 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold outline-none focus:border-primary/50 transition-colors">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1.5 pl-1">Cantidad inicial</p>
                            <input id="inv-new-cantidad" type="number" inputmode="numeric" min="0" placeholder="0" value="0"
                                class="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-black tabular-nums outline-none focus:border-primary/50 transition-colors">
                        </div>
                        <div>
                            <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1.5 pl-1">Avisar si quedan ≤</p>
                            <input id="inv-new-minimo" type="number" inputmode="numeric" min="0" placeholder="5" value="5"
                                class="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-black tabular-nums outline-none focus:border-primary/50 transition-colors">
                        </div>
                    </div>
                </div>

                <div class="flex gap-2">
                    <button onclick="closeAgregarProductoModal()" class="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Cancelar
                    </button>
                    <button id="inv-new-submit" onclick="submitAgregarProducto()" class="flex-1 px-4 py-3 rounded-xl bg-primary text-black text-sm font-black uppercase tracking-wider hover:bg-yellow-500 transition-all active:scale-[0.97]">
                        Crear
                    </button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => document.getElementById('inv-agregar-overlay')?.classList.add('visible'));

        if (typeof window.attachPriceInput === 'function') {
            const el = document.getElementById('inv-new-precio');
            if (el) window.attachPriceInput(el);
        }
        document.getElementById('inv-new-nombre')?.focus();
    }

    function closeAgregar() {
        const overlay = document.getElementById('inv-agregar-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 250);
        }
    }

    async function submitAgregar() {
        const sedeSelect = document.getElementById('inv-new-sede');
        const nombreInput = document.getElementById('inv-new-nombre');
        const precioInput = document.getElementById('inv-new-precio');
        const cantInput = document.getElementById('inv-new-cantidad');
        const minInput = document.getElementById('inv-new-minimo');
        const submitBtn = document.getElementById('inv-new-submit');

        const sedeId = sedeSelect?.value || '';
        const nombre = (nombreInput?.value || '').trim();
        const precio = (typeof window.parsePriceInput === 'function')
            ? window.parsePriceInput(precioInput)
            : (parseFloat(precioInput?.value) || 0);
        const cantidad = parseInt(cantInput?.value || '0', 10);
        const minimo = parseInt(minInput?.value || '0', 10);

        if (!sedeId) { toast('Elegí una sede', 'error'); sedeSelect?.focus(); return; }
        if (!nombre) { toast('Ingresá un nombre', 'error'); nombreInput?.focus(); return; }
        if (!precio || precio <= 0) { toast('Precio inválido', 'error'); precioInput?.focus(); return; }
        if (isNaN(cantidad) || cantidad < 0) { toast('Cantidad inválida', 'error'); cantInput?.focus(); return; }
        if (isNaN(minimo) || minimo < 0) { toast('Mínimo inválido', 'error'); minInput?.focus(); return; }

        // F9: chequear duplicado SOLO en la sede destino (puede existir el
        // mismo nombre en otra sede sin conflicto — son inventarios separados).
        if (state.sedeFilter === sedeId
            && state.productos.some(p => p.nombre.toLowerCase() === nombre.toLowerCase())) {
            toast('Ya existe ese producto en esta sede', 'error');
            return;
        }
        if (state.sedeFilter !== sedeId && typeof ProductosService !== 'undefined') {
            const existentesEnSede = await ProductosService.listBySede(sedeId);
            if (existentesEnSede.some(p => p.nombre.toLowerCase() === nombre.toLowerCase())) {
                toast(`Ya existe ese producto en esa sede`, 'error');
                return;
            }
        }

        const orig = submitBtn?.innerHTML;
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '...'; }

        // 1. Crear producto con sede asignada
        const productoId = await ProductosService.create({
            nombre, precio, sedeId,
            ordenActual: state.productos.length
        });
        if (!productoId) {
            toast('Error al crear', 'error');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = orig; }
            return;
        }

        // 2. Setear cantidad inicial + mínimo en esa sede (única sede ahora)
        if (typeof StockService !== 'undefined') {
            const user = getCurrentUser();
            if (cantidad > 0) {
                await StockService.ajustar({
                    productoId, sedeId, nuevaCantidad: cantidad,
                    notas: 'Cantidad inicial al crear producto',
                    creadoPor: user?.uid || null,
                    creadoPorNombre: user?.displayName || ''
                });
            }
            if (minimo > 0) {
                await StockService.setMinimo({ productoId, sedeId, minimo });
            }
        }

        toast(`"${nombre}" agregado a ${sedeNombrePorId(sedeId)} ✓`, 'success');
        closeAgregar();

        // Si lo creó en otra sede, cambiamos el filtro para que lo vea
        if (sedeId !== state.sedeFilter) {
            state.sedeFilter = sedeId;
        }
        init();
    }

    function sedeNombrePorId(sedeId) {
        const s = (state.sedes || []).find(x => x.id === sedeId);
        return s?.nombre || '';
    }

    // ============================================
    // MODAL: EDITAR PRODUCTO
    // ============================================

    function openEditar(productoId) {
        const p = state.productos.find(x => x.id === productoId);
        if (!p) return;
        const existing = document.getElementById('inv-editar-overlay');
        if (existing) existing.remove();

        const safeName = (p.nombre || '').replace(/"/g, '&quot;');
        const html = `
        <div id="inv-editar-overlay" class="barber-modal-overlay" style="z-index:165">
            <div class="barber-confirm-dialog" style="max-width:400px">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1">edit</span>
                    </div>
                    <h3 class="text-white font-black text-base">Editar producto</h3>
                </div>
                <div class="space-y-3 mb-4">
                    <div>
                        <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1.5 pl-1">Nombre</p>
                        <input id="inv-edit-nombre" type="text" maxlength="40" value="${safeName}"
                            class="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold outline-none focus:border-primary/50 transition-colors">
                    </div>
                    <div>
                        <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1.5 pl-1">Precio</p>
                        <div class="relative">
                            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-black text-sm pointer-events-none">$</div>
                            <input id="inv-edit-precio" type="text" inputmode="numeric" value="${p.precio || 0}"
                                class="price-input w-full px-3 py-2.5 pl-7 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold outline-none focus:border-primary/50 transition-colors">
                        </div>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="closeEditarProductoModal()" class="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Cancelar
                    </button>
                    <button onclick="submitEditarProducto('${productoId}')" class="flex-1 px-4 py-3 rounded-xl bg-primary text-black text-sm font-black uppercase tracking-wider hover:bg-yellow-500 transition-all active:scale-[0.97]">
                        Guardar
                    </button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => document.getElementById('inv-editar-overlay')?.classList.add('visible'));

        if (typeof window.attachPriceInput === 'function') {
            const el = document.getElementById('inv-edit-precio');
            if (el) window.attachPriceInput(el);
        }
    }

    function closeEditar() {
        const overlay = document.getElementById('inv-editar-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 250);
        }
    }

    async function submitEditar(productoId) {
        const nombre = (document.getElementById('inv-edit-nombre')?.value || '').trim();
        const precioRaw = document.getElementById('inv-edit-precio');
        const precio = (typeof window.parsePriceInput === 'function')
            ? window.parsePriceInput(precioRaw)
            : (parseFloat(precioRaw?.value) || 0);
        if (!nombre) { toast('Nombre obligatorio', 'error'); return; }
        if (!precio || precio <= 0) { toast('Precio inválido', 'error'); return; }

        const ok = await ProductosService.update(productoId, { nombre, precio });
        if (!ok) { toast('Error al guardar', 'error'); return; }
        const p = state.productos.find(x => x.id === productoId);
        if (p) { p.nombre = nombre; p.precio = precio; }
        renderLista();
        closeEditar();
        toast('Producto actualizado ✓', 'success');
    }

    // ============================================
    // EXPONER GLOBALES
    // ============================================

    window.initInventarioAdmin = init;
    window.reloadInventarioAdmin = init;
    window.setInvAdminSedeFilter = setSedeFilter;
    window.saveStockInv = saveStock;
    window.toggleProductoActivoInv = toggleActivo;
    window.confirmDeleteProductoInv = confirmDelete;
    window.openAgregarProductoModal = openAgregar;
    window.closeAgregarProductoModal = closeAgregar;
    window.submitAgregarProducto = submitAgregar;
    window.openEditarProductoModal = openEditar;
    window.closeEditarProductoModal = closeEditar;
    window.submitEditarProducto = submitEditar;

    console.log('✓ admin/inventario-ui (F8) loaded');
})();
