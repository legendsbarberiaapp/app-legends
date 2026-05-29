/**
 * LEGENDS BARBERIA - ADMIN: PRODUCTOS UI (F3)
 *
 * Overlay para que el admin gestione el catálogo de productos que la
 * recepcionista podrá vender desde el panel de caja.
 *
 * F3 decisión: catálogo GLOBAL (no por sede) + precio único. El stock por
 * sede llega en F4.
 *
 * Extiende BarberManager.prototype (mismo patrón que sedes-ui).
 */
(function () {
    'use strict';

    if (typeof BarberManager === 'undefined') {
        console.error('❌ productos-ui: BarberManager no está definido.');
        return;
    }

    // Nota: `this.productos` está inicializado en el constructor de BarberManager
    // (barber-manager.js) — NO se asigna al prototype para evitar state compartido
    // entre instancias.

    BarberManager.prototype.loadProductos = async function () {
        try {
            if (typeof ProductosService === 'undefined') {
                this.productos = [];
                return;
            }
            this.productos = await ProductosService.list();
        } catch (e) {
            console.error('❌ Error cargando productos:', e);
            this.productos = [];
        }
    };

    BarberManager.prototype.openGestionarProductos = async function () {
        await this.loadProductos();

        const existing = document.getElementById('productos-manage-overlay');
        if (existing) existing.remove();

        const html = `
        <div id="productos-manage-overlay" class="barber-modal-overlay" style="z-index:160">
            <div class="barber-confirm-dialog" style="max-width:480px">
                <div class="flex items-center gap-3 mb-5">
                    <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1">inventory_2</span>
                    </div>
                    <div>
                        <h3 class="text-white font-black text-base">Gestionar Productos</h3>
                        <p class="text-white/40 text-[10px] uppercase tracking-wider font-bold">Catálogo para vender en caja</p>
                    </div>
                </div>

                <div id="productos-list" class="space-y-2 mb-4 max-h-64 overflow-y-auto" style="scrollbar-width:none"></div>

                <div class="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] mb-4">
                    <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-2 pl-1">Agregar producto</p>
                    <div class="flex gap-2">
                        <input type="text" id="producto-new-nombre" maxlength="40" placeholder="Ej: Cera mate"
                            class="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium outline-none focus:border-primary/50 transition-colors placeholder:text-white/20">
                        <div class="relative w-28">
                            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-black text-sm pointer-events-none">$</div>
                            <input type="text" inputmode="numeric" id="producto-new-precio" placeholder="0"
                                class="price-input w-full px-3 py-2.5 pl-7 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold outline-none focus:border-primary/50 transition-colors placeholder:text-white/20">
                        </div>
                        <button onclick="barberManager.handleAddProducto()" class="px-3 py-2.5 rounded-xl bg-primary text-black text-xs font-black uppercase hover:bg-yellow-500 transition-all active:scale-[0.97]">
                            <span class="material-symbols-outlined text-base">add</span>
                        </button>
                    </div>
                </div>

                <button onclick="barberManager.closeGestionarProductos()" class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                    Cerrar
                </button>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => {
            document.getElementById('productos-manage-overlay')?.classList.add('visible');
        });

        if (typeof window.attachPriceInput === 'function') {
            document.querySelectorAll('#productos-manage-overlay .price-input')
                .forEach(el => window.attachPriceInput(el));
        }

        this.renderProductosList();
    };

    BarberManager.prototype.renderProductosList = function () {
        const container = document.getElementById('productos-list');
        if (!container) return;

        if (!this.productos || this.productos.length === 0) {
            container.innerHTML = '<p class="text-white/30 text-xs text-center py-4">No hay productos en el catálogo</p>';
            return;
        }

        container.innerHTML = this.productos.map(p => {
            const safeName = (p.nombre || '').replace(/"/g, '&quot;');
            const precioTxt = (typeof window.formatCOP === 'function') ? window.formatCOP(p.precio || 0) : `$${p.precio || 0}`;
            const activo = p.activo !== false;
            return `
            <div class="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5 group ${activo ? '' : 'opacity-50'}">
                <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1">shopping_bag</span>
                <div class="flex-1 min-w-0">
                    <p class="text-white text-sm font-bold truncate">${safeName}</p>
                    <p class="text-primary text-xs font-black tabular-nums">${precioTxt}</p>
                </div>
                <button onclick="barberManager.openStockProducto('${p.id}', '${safeName}')"
                    title="Stock por sede"
                    class="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-primary/15 hover:border-primary/30 transition-all active:scale-90">
                    <span class="material-symbols-outlined text-white/60 text-sm hover:text-primary">inventory_2</span>
                </button>
                <button onclick="barberManager.openEditarProducto('${p.id}')"
                    title="Editar"
                    class="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-primary/15 hover:border-primary/30 transition-all active:scale-90">
                    <span class="material-symbols-outlined text-white/60 text-sm hover:text-primary">edit</span>
                </button>
                <button onclick="barberManager.toggleProductoActivo('${p.id}', this)"
                    title="${activo ? 'Desactivar' : 'Activar'}"
                    class="w-8 h-8 rounded-lg ${activo ? 'bg-green-500/10 border border-green-500/25' : 'bg-white/5 border border-white/10'} flex items-center justify-center transition-all active:scale-90">
                    <span class="material-symbols-outlined ${activo ? 'text-green-400' : 'text-white/40'} text-sm" style="font-variation-settings: 'FILL' ${activo ? 1 : 0}">${activo ? 'check_circle' : 'visibility_off'}</span>
                </button>
                <button onclick="barberManager.confirmDeleteProducto('${p.id}', '${safeName}')"
                    title="Eliminar"
                    class="w-8 h-8 rounded-lg bg-transparent flex items-center justify-center hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100 active:scale-90">
                    <span class="material-symbols-outlined text-red-400 text-sm">close</span>
                </button>
            </div>`;
        }).join('');
    };

    BarberManager.prototype.handleAddProducto = async function () {
        const nombreInput = document.getElementById('producto-new-nombre');
        const precioInput = document.getElementById('producto-new-precio');
        const nombre = (nombreInput?.value || '').trim();
        const precio = (typeof window.parsePriceInput === 'function')
            ? window.parsePriceInput(precioInput)
            : (parseFloat(precioInput?.value) || 0);

        if (!nombre) { this.showToast('Ingresá el nombre del producto', 'error'); nombreInput?.focus(); return; }
        if (precio <= 0) { this.showToast('Precio inválido', 'error'); precioInput?.focus(); return; }
        if (this.productos.some(p => p.nombre.toLowerCase() === nombre.toLowerCase())) {
            this.showToast('Ya existe un producto con ese nombre', 'error');
            return;
        }

        const ok = await ProductosService.create({ nombre, precio, ordenActual: this.productos.length });
        if (!ok) { this.showToast('Error al crear', 'error'); return; }

        this.showToast(`"${nombre}" agregado ✓`, 'success');
        if (nombreInput) nombreInput.value = '';
        if (precioInput) precioInput.value = '';
        await this.loadProductos();
        this.renderProductosList();
    };

    BarberManager.prototype.openEditarProducto = function (id) {
        const p = this.productos.find(x => x.id === id);
        if (!p) return;
        const existing = document.getElementById('producto-edit-overlay');
        if (existing) existing.remove();

        const safeName = (p.nombre || '').replace(/"/g, '&quot;');
        const html = `
        <div id="producto-edit-overlay" class="barber-modal-overlay" style="z-index:170">
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
                        <input id="producto-edit-nombre" type="text" maxlength="40" value="${safeName}"
                            class="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold outline-none focus:border-primary/50 transition-colors">
                    </div>
                    <div>
                        <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1.5 pl-1">Precio</p>
                        <div class="relative">
                            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-black text-sm pointer-events-none">$</div>
                            <input id="producto-edit-precio" type="text" inputmode="numeric" value="${p.precio || 0}"
                                class="price-input w-full px-3 py-2.5 pl-7 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold outline-none focus:border-primary/50 transition-colors">
                        </div>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="barberManager.closeEditarProducto()" class="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Cancelar
                    </button>
                    <button onclick="barberManager.saveProductoEdit('${id}')" class="flex-1 px-4 py-3 rounded-xl bg-primary text-black text-sm font-black uppercase tracking-wider hover:bg-yellow-500 transition-all active:scale-[0.97]">
                        Guardar
                    </button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => document.getElementById('producto-edit-overlay')?.classList.add('visible'));

        if (typeof window.attachPriceInput === 'function') {
            const el = document.getElementById('producto-edit-precio');
            if (el) window.attachPriceInput(el);
        }
    };

    BarberManager.prototype.closeEditarProducto = function () {
        const overlay = document.getElementById('producto-edit-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 250);
        }
    };

    BarberManager.prototype.saveProductoEdit = async function (id) {
        const nombreInput = document.getElementById('producto-edit-nombre');
        const precioInput = document.getElementById('producto-edit-precio');
        const nombre = (nombreInput?.value || '').trim();
        const precio = (typeof window.parsePriceInput === 'function')
            ? window.parsePriceInput(precioInput)
            : (parseFloat(precioInput?.value) || 0);

        if (!nombre) { this.showToast('Nombre obligatorio', 'error'); return; }
        if (precio <= 0) { this.showToast('Precio inválido', 'error'); return; }

        const ok = await ProductosService.update(id, { nombre, precio: Number(precio) });
        if (!ok) { this.showToast('Error al guardar', 'error'); return; }

        this.showToast('Producto actualizado ✓', 'success');
        this.closeEditarProducto();
        await this.loadProductos();
        this.renderProductosList();
    };

    BarberManager.prototype.toggleProductoActivo = async function (id, btnEl) {
        const p = this.productos.find(x => x.id === id);
        if (!p) return;
        const nuevoEstado = p.activo === false;
        const ok = await ProductosService.update(id, { activo: nuevoEstado });
        if (!ok) { this.showToast('Error guardando', 'error'); return; }
        p.activo = nuevoEstado;
        this.renderProductosList();
        this.showToast(nuevoEstado ? `"${p.nombre}" activado ✓` : `"${p.nombre}" oculto del catálogo`, 'success');
    };

    BarberManager.prototype.confirmDeleteProducto = async function (id, nombre) {
        if (!confirm(`¿Eliminar el producto "${nombre}"? Las ventas históricas que lo incluyan se conservan.`)) return;
        const ok = await ProductosService.remove(id);
        if (!ok) { this.showToast('Error eliminando', 'error'); return; }
        this.showToast(`"${nombre}" eliminado`, 'success');
        await this.loadProductos();
        this.renderProductosList();
    };

    BarberManager.prototype.closeGestionarProductos = function () {
        const overlay = document.getElementById('productos-manage-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 250);
        }
    };

    // ============================================
    // F4: Stock por sede (sub-overlay desde un producto)
    // ============================================

    BarberManager.prototype.openStockProducto = async function (productoId, nombre) {
        if (typeof StockService === 'undefined' || typeof SedesService === 'undefined') {
            this.showToast('Servicios de stock no cargados', 'error');
            return;
        }
        // Aseguramos cache de sedes
        await this.loadSedes();
        if (!this.sedes || this.sedes.length === 0) {
            this.showToast('No hay sedes configuradas', 'error');
            return;
        }

        // Cargamos el stock actual de cada sede para este producto en paralelo
        const stockRows = await Promise.all(
            this.sedes.map(s => StockService.get(productoId, s.id))
        );
        const stockBySedeId = {};
        this.sedes.forEach((s, i) => {
            stockBySedeId[s.id] = stockRows[i] || { cantidad: 0, minimo: 0 };
        });

        const existing = document.getElementById('producto-stock-overlay');
        if (existing) existing.remove();

        const sedesHTML = this.sedes.map(s => {
            const row = stockBySedeId[s.id];
            const cantidad = Number(row.cantidad) || 0;
            const minimo = Number(row.minimo) || 0;
            return `
            <div class="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]" data-sede-id="${s.id}">
                <div class="flex items-center gap-2 mb-3">
                    <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1">storefront</span>
                    <p class="flex-1 text-white text-sm font-black truncate">${s.nombre}</p>
                </div>
                <div class="grid grid-cols-2 gap-2 mb-2">
                    <div>
                        <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1 pl-1">Cantidad</p>
                        <input id="stock-cantidad-${s.id}" type="number" inputmode="numeric" min="0" value="${cantidad}"
                            class="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-black tabular-nums outline-none focus:border-primary/50 transition-colors">
                    </div>
                    <div>
                        <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1 pl-1">Mínimo (alerta)</p>
                        <input id="stock-minimo-${s.id}" type="number" inputmode="numeric" min="0" value="${minimo}"
                            class="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold tabular-nums outline-none focus:border-primary/50 transition-colors">
                    </div>
                </div>
                <button onclick="barberManager.saveStockSede('${productoId}', '${s.id}', this)"
                    class="w-full px-3 py-2 rounded-lg bg-primary/15 border border-primary/25 text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/25 transition-all active:scale-95">
                    Guardar ${s.nombre}
                </button>
            </div>`;
        }).join('');

        const safeName = (nombre || '').replace(/"/g, '&quot;');
        const html = `
        <div id="producto-stock-overlay" class="barber-modal-overlay" style="z-index:170">
            <div class="barber-confirm-dialog" style="max-width:480px">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1">inventory_2</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="text-white font-black text-base truncate">Stock — ${safeName}</h3>
                        <p class="text-white/40 text-[10px] uppercase tracking-wider font-bold">Cantidad y mínimo por sede</p>
                    </div>
                </div>
                <div class="space-y-3 mb-4 max-h-80 overflow-y-auto" style="scrollbar-width:none">
                    ${sedesHTML}
                </div>
                <div class="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] mb-4">
                    <div class="flex items-start gap-2">
                        <span class="material-symbols-outlined text-amber-400/80 text-base shrink-0 mt-0.5" style="font-variation-settings: 'FILL' 1">info</span>
                        <p class="text-white/55 text-[11px] leading-relaxed">
                            "Cantidad" = stock actual. Si bajás el valor, queda registrado como un ajuste. Las ventas decrementan solas. El "Mínimo" pinta la alerta en rojo en el panel de la recepcionista cuando se llega o se baja del umbral.
                        </p>
                    </div>
                </div>
                <button onclick="barberManager.closeStockProducto()" class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                    Cerrar
                </button>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => document.getElementById('producto-stock-overlay')?.classList.add('visible'));
    };

    BarberManager.prototype.saveStockSede = async function (productoId, sedeId, btnEl) {
        const cantInput = document.getElementById(`stock-cantidad-${sedeId}`);
        const minInput = document.getElementById(`stock-minimo-${sedeId}`);
        const cantidad = parseInt(cantInput?.value || '0', 10);
        const minimo = parseInt(minInput?.value || '0', 10);

        if (isNaN(cantidad) || cantidad < 0) { this.showToast('Cantidad inválida', 'error'); return; }
        if (isNaN(minimo) || minimo < 0) { this.showToast('Mínimo inválido', 'error'); return; }

        const user = (typeof firebaseAdapter !== 'undefined') ? null : null;
        const currentUser = (typeof roleManager !== 'undefined') ? roleManager.currentUser : null;

        const origText = btnEl?.innerHTML;
        if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '...'; }

        try {
            const okAjuste = await StockService.ajustar({
                productoId,
                sedeId,
                nuevaCantidad: cantidad,
                notas: 'Ajuste desde admin',
                creadoPor: currentUser?.uid || null,
                creadoPorNombre: currentUser?.displayName || ''
            });
            const okMin = await StockService.setMinimo({ productoId, sedeId, minimo });

            if (!okAjuste || !okMin) {
                this.showToast('Error al guardar', 'error');
                if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = origText; }
                return;
            }
            this.showToast('Stock actualizado ✓', 'success');
            if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = origText; }
        } catch (e) {
            console.error('❌ Error guardando stock:', e);
            this.showToast('Error al guardar', 'error');
            if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = origText; }
        }
    };

    BarberManager.prototype.closeStockProducto = function () {
        const overlay = document.getElementById('producto-stock-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 250);
        }
    };

    console.log('✓ admin/productos-ui loaded');
})();
