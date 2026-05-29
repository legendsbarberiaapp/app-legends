/**
 * LEGENDS BARBERIA - RECEPCIONISTA: INVENTARIO (F4)
 *
 * Tab "Inventario" del rol recepcionista. Muestra:
 *   - Alertas de productos por debajo del mínimo (rojo)
 *   - Lista de productos con cantidad actual + mínimo + indicador visual
 *   - Movimientos recientes (últimos 20)
 *   - FAB "Entrada" → modal para registrar mercancía recibida
 *
 * Las ventas decrementan automáticamente desde el batch de cobrar-ui.
 * Acá la recepcionista solo registra ENTRADAS (recibir pedido) — los ajustes
 * los hace el admin.
 */
(function () {
    'use strict';

    function getCurrentUser() {
        return (typeof roleManager !== 'undefined') ? roleManager.currentUser : null;
    }
    function fmtCantidad(n) { return String(Number(n) || 0); }

    const state = {
        sedeId: null,
        sedeNombre: '',
        productos: [],            // catálogo (todos los activos)
        stockBySedeIdProductoId: {}, // productoId → { cantidad, minimo }
        movimientos: []
    };

    async function init() {
        const sub = document.getElementById('inv-sub-label');
        const list = document.getElementById('inv-productos-list');
        const movs = document.getElementById('inv-movimientos-list');

        const user = getCurrentUser();
        if (!user || user.role !== 'recepcionista') {
            if (list) list.innerHTML = renderError('Pantalla solo para recepcionistas');
            return;
        }
        state.sedeId = user.sedeId || null;
        if (!state.sedeId) {
            if (sub) sub.textContent = 'Sin sede asignada';
            if (list) list.innerHTML = renderError('No tenés sede asignada');
            return;
        }

        if (list) list.innerHTML = `
            <div class="flex flex-col items-center gap-3 py-10">
                <div class="auth-checking-spinner"></div>
                <p class="text-white/50 text-xs">Cargando inventario...</p>
            </div>`;
        if (movs) movs.innerHTML = '';

        try {
            const [sedes, productos, stockRows, movimientos] = await Promise.all([
                (typeof SedesService !== 'undefined') ? SedesService.list() : Promise.resolve([]),
                (typeof ProductosService !== 'undefined') ? ProductosService.list({ soloActivos: true }) : Promise.resolve([]),
                (typeof StockService !== 'undefined') ? StockService.listBySede(state.sedeId) : Promise.resolve([]),
                (typeof StockService !== 'undefined') ? StockService.listMovimientos(state.sedeId, 20) : Promise.resolve([])
            ]);

            state.sedeNombre = (typeof SedesService !== 'undefined')
                ? SedesService.nombreById(sedes, state.sedeId)
                : '';
            state.productos = productos;
            state.stockBySedeIdProductoId = {};
            (stockRows || []).forEach(s => {
                state.stockBySedeIdProductoId[s.productoId] = {
                    cantidad: Number(s.cantidad) || 0,
                    minimo: Number(s.minimo) || 0
                };
            });
            state.movimientos = movimientos || [];

            if (sub) {
                sub.textContent = state.sedeNombre ? `Sede ${state.sedeNombre}` : 'Sin sede';
            }

            renderAlertas();
            renderProductos();
            renderMovimientos();
        } catch (e) {
            console.error('❌ Error cargando inventario:', e);
            if (list) list.innerHTML = renderError('No se pudo cargar el inventario');
        }
    }

    // ============================================
    // RENDER: ALERTAS
    // ============================================

    function getEstadoStock(productoId) {
        const data = state.stockBySedeIdProductoId[productoId];
        if (!data) return { cantidad: undefined, minimo: 0, nivel: 'sin-registro' };
        const { cantidad, minimo } = data;
        if (cantidad === 0) return { cantidad, minimo, nivel: 'agotado' };
        if (minimo > 0 && cantidad <= minimo) return { cantidad, minimo, nivel: 'bajo' };
        if (cantidad < 0) return { cantidad, minimo, nivel: 'negativo' };
        return { cantidad, minimo, nivel: 'ok' };
    }

    function renderAlertas() {
        const container = document.getElementById('inv-alertas');
        if (!container) return;
        const criticos = state.productos
            .map(p => ({ p, e: getEstadoStock(p.id) }))
            .filter(({ e }) => e.nivel === 'agotado' || e.nivel === 'bajo' || e.nivel === 'negativo');

        if (criticos.length === 0) {
            container.innerHTML = '';
            return;
        }

        const items = criticos.slice(0, 5).map(({ p, e }) => {
            const cls = e.nivel === 'bajo' ? 'text-amber-400' : 'text-red-400';
            const label = e.nivel === 'agotado'
                ? 'Agotado'
                : (e.nivel === 'negativo' ? `Sobrevendido (${e.cantidad})` : `Bajo: ${e.cantidad} / mín ${e.minimo}`);
            return `
                <div class="flex items-center justify-between gap-3 py-1.5">
                    <p class="text-white text-sm font-bold truncate flex-1">${p.nombre}</p>
                    <span class="${cls} text-[10px] font-black uppercase tracking-wider shrink-0">${label}</span>
                </div>`;
        }).join('');

        container.innerHTML = `
            <div class="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25">
                <div class="flex items-center gap-2 mb-2">
                    <span class="material-symbols-outlined text-red-400 text-base" style="font-variation-settings: 'FILL' 1">warning</span>
                    <p class="text-red-400 text-[10px] font-black uppercase tracking-[0.2em]">Atención al inventario</p>
                    <span class="ml-auto px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-black">${criticos.length}</span>
                </div>
                <div class="divide-y divide-red-500/10">${items}</div>
            </div>`;
    }

    // ============================================
    // RENDER: LISTA DE PRODUCTOS
    // ============================================

    function renderProductos() {
        const container = document.getElementById('inv-productos-list');
        if (!container) return;
        if (!state.productos || state.productos.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center gap-3 py-10 px-6 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <span class="material-symbols-outlined text-white/20 text-4xl" style="font-variation-settings: 'FILL' 1">inventory_2</span>
                    <p class="text-white/50 text-sm font-bold text-center">No hay productos en el catálogo</p>
                    <p class="text-white/25 text-[11px] text-center">Pedile al admin que agregue desde Barberos → Productos</p>
                </div>`;
            return;
        }
        container.innerHTML = state.productos.map(p => {
            const e = getEstadoStock(p.id);
            const cantTxt = e.cantidad === undefined ? '—' : fmtCantidad(e.cantidad);
            const mintxt = e.minimo > 0 ? `mín ${e.minimo}` : 'sin mínimo';

            let badgeCls, badgeIcon, badgeLabel;
            if (e.nivel === 'sin-registro') {
                badgeCls = 'bg-white/5 text-white/40 border-white/10';
                badgeIcon = 'help';
                badgeLabel = 'Sin registro';
            } else if (e.nivel === 'agotado' || e.nivel === 'negativo') {
                badgeCls = 'bg-red-500/15 text-red-400 border-red-500/30';
                badgeIcon = 'error';
                badgeLabel = e.nivel === 'negativo' ? 'Sobrevendido' : 'Agotado';
            } else if (e.nivel === 'bajo') {
                badgeCls = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
                badgeIcon = 'warning';
                badgeLabel = 'Bajo';
            } else {
                badgeCls = 'bg-green-500/10 text-green-400 border-green-500/20';
                badgeIcon = 'check_circle';
                badgeLabel = 'OK';
            }

            return `
            <div class="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1">shopping_bag</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-white text-sm font-bold truncate">${p.nombre}</p>
                        <p class="text-white/45 text-[11px]">${mintxt}</p>
                    </div>
                    <div class="text-right shrink-0">
                        <p class="text-white text-xl font-black tabular-nums leading-none">${cantTxt}</p>
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 mt-1 rounded-md border text-[9px] font-black uppercase tracking-wider ${badgeCls}">
                            <span class="material-symbols-outlined text-[10px]" style="font-variation-settings: 'FILL' 1">${badgeIcon}</span>
                            ${badgeLabel}
                        </span>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    // ============================================
    // RENDER: MOVIMIENTOS
    // ============================================

    const TIPO_META = {
        venta:   { label: 'Venta',    icon: 'point_of_sale', color: 'text-red-400'   },
        entrada: { label: 'Entrada',  icon: 'add_box',       color: 'text-green-400' },
        ajuste:  { label: 'Ajuste',   icon: 'tune',          color: 'text-blue-400'  }
    };

    function nombreDeProducto(productoId) {
        const p = state.productos.find(x => x.id === productoId);
        return p?.nombre || 'Producto';
    }

    function renderMovimientos() {
        const container = document.getElementById('inv-movimientos-list');
        if (!container) return;
        if (!state.movimientos || state.movimientos.length === 0) {
            container.innerHTML = `
                <div class="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <p class="text-white/40 text-xs text-center">Sin movimientos aún</p>
                </div>`;
            return;
        }
        container.innerHTML = state.movimientos.map(m => {
            const meta = TIPO_META[m.tipo] || TIPO_META.ajuste;
            const cant = Number(m.cantidad) || 0;
            const signo = cant > 0 ? '+' : '';
            const hora = m.createdAt && m.createdAt.toDate
                ? m.createdAt.toDate().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
                : (m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
            const notas = m.notas ? `<span class="text-white/35 text-[10px] truncate"> · ${m.notas}</span>` : '';

            return `
                <div class="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div class="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined ${meta.color} text-sm" style="font-variation-settings: 'FILL' 1">${meta.icon}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-white text-xs font-bold truncate">${nombreDeProducto(m.productoId)}${notas}</p>
                        <p class="text-white/35 text-[10px]">${meta.label} · ${hora}</p>
                    </div>
                    <span class="${meta.color} text-sm font-black tabular-nums shrink-0">${signo}${cant}</span>
                </div>`;
        }).join('');
    }

    function renderError(msg) {
        return `
            <div class="text-center py-10 px-6 rounded-xl bg-red-500/5 border border-red-500/15">
                <span class="material-symbols-outlined text-red-400 text-4xl mb-2">error</span>
                <p class="text-red-400 text-sm font-bold">${msg}</p>
                <button onclick="initRecepcionistaInventario()" class="mt-4 px-4 py-2 bg-primary/20 text-primary text-xs font-black rounded-lg border border-primary/30">
                    Reintentar
                </button>
            </div>`;
    }

    // ============================================
    // MODAL: REGISTRAR ENTRADA
    // ============================================

    function openEntradaModal() {
        if (!state.productos || state.productos.length === 0) {
            if (typeof window.showToast === 'function') window.showToast('No hay productos en el catálogo', 'error');
            return;
        }
        const existing = document.getElementById('entrada-overlay');
        if (existing) existing.remove();

        const productosOptions = state.productos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

        const html = `
        <div id="entrada-overlay" class="barber-modal-overlay" style="z-index:160">
            <div class="barber-confirm-dialog" style="max-width:420px">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center">
                        <span class="material-symbols-outlined text-green-400 text-lg" style="font-variation-settings: 'FILL' 1">add_box</span>
                    </div>
                    <div>
                        <h3 class="text-white font-black text-base">Registrar entrada</h3>
                        <p class="text-white/40 text-[10px] uppercase tracking-wider font-bold">Mercancía recibida</p>
                    </div>
                </div>

                <div class="space-y-3 mb-4">
                    <div>
                        <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1.5 pl-1">Producto</p>
                        <select id="entrada-producto" class="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold outline-none focus:border-primary/50 transition-colors">
                            <option value="">Seleccionar producto...</option>
                            ${productosOptions}
                        </select>
                    </div>
                    <div>
                        <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1.5 pl-1">Cantidad recibida</p>
                        <input id="entrada-cantidad" type="number" inputmode="numeric" min="1" placeholder="0"
                            class="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-base font-black tabular-nums outline-none focus:border-primary/50 transition-colors">
                    </div>
                    <div>
                        <p class="text-white/45 text-[10px] font-bold uppercase tracking-wider mb-1.5 pl-1">Notas <span class="text-white/30 text-[10px] font-normal">(opcional)</span></p>
                        <input id="entrada-notas" type="text" maxlength="100" placeholder="Ej: Pedido proveedor #45"
                            class="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium outline-none focus:border-primary/50 transition-colors placeholder:text-white/20">
                    </div>
                </div>

                <div class="flex gap-2">
                    <button onclick="closeEntradaModal()" class="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Cancelar
                    </button>
                    <button id="entrada-submit" onclick="submitEntrada()" class="flex-1 px-4 py-3 rounded-xl bg-green-500 text-black text-sm font-black uppercase tracking-wider hover:bg-green-400 transition-all active:scale-[0.97]">
                        Registrar
                    </button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        requestAnimationFrame(() => {
            document.getElementById('entrada-overlay')?.classList.add('visible');
            document.getElementById('entrada-producto')?.focus();
        });
    }

    function closeEntradaModal() {
        const overlay = document.getElementById('entrada-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 250);
        }
    }

    async function submitEntrada() {
        const productoId = document.getElementById('entrada-producto')?.value;
        const cantidad = parseInt(document.getElementById('entrada-cantidad')?.value || '0', 10);
        const notas = (document.getElementById('entrada-notas')?.value || '').trim();

        if (!productoId) {
            if (typeof window.showToast === 'function') window.showToast('Elegí un producto', 'error');
            return;
        }
        if (!cantidad || cantidad <= 0) {
            if (typeof window.showToast === 'function') window.showToast('Cantidad inválida', 'error');
            return;
        }

        const user = getCurrentUser();
        const btn = document.getElementById('entrada-submit');
        const orig = btn?.innerHTML;
        if (btn) { btn.disabled = true; btn.innerHTML = '...'; }

        const ok = await StockService.registrarEntrada({
            productoId,
            sedeId: state.sedeId,
            cantidad,
            notas,
            creadoPor: user?.uid || null,
            creadoPorNombre: user?.displayName || ''
        });

        if (btn) { btn.disabled = false; btn.innerHTML = orig; }

        if (!ok) {
            if (typeof window.showToast === 'function') window.showToast('No se pudo registrar', 'error');
            return;
        }

        const nombre = nombreDeProducto(productoId);
        if (typeof window.showToast === 'function') window.showToast(`+${cantidad} ${nombre} ✓`, 'success');
        closeEntradaModal();
        init(); // re-fetch para reflejar el nuevo stock y movimiento
    }

    window.initRecepcionistaInventario = init;
    window.reloadRecepcionistaInventario = init;
    window.openEntradaModal = openEntradaModal;
    window.closeEntradaModal = closeEntradaModal;
    window.submitEntrada = submitEntrada;

    console.log('✓ RecepcionistaInventarioUI (F4) loaded');
})();
