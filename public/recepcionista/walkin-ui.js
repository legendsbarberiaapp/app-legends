/**
 * LEGENDS BARBERIA - RECEPCIONISTA: WALK-IN MODAL (F2)
 *
 * Modal para registrar una cita presencial (sin reserva previa).
 * Lee window.recepState (sede + barberos cacheados) y usa CitasService.createWalkin.
 *
 * Estado: minimal — el flujo es lineal y se cancela cerrando el overlay.
 *
 * Flujo:
 *   1. nombre del cliente (obligatorio)
 *   2. teléfono (opcional, COP +57)
 *   3. barbero (dropdown — solo de su sede)
 *   4. con/sin corte (toggle)
 *   5. adicionales (multi-select, según los del barbero)
 *   6. hora (slots del día de hoy del barbero, descontando ocupados)
 *
 * La cita nace en estado 'confirmada' y con fecha = hoy.
 *
 * F3 sumará: tomar pago al confirmar.
 */
(function () {
    'use strict';

    const DURACION_SLOT_MIN = 45;
    const DIAS_SEMANA_KEY = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

    function todayISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function diaKey(iso) {
        const [y, m, d] = iso.split('-').map(Number);
        return DIAS_SEMANA_KEY[new Date(y, m - 1, d).getDay()];
    }

    /** Limpia un teléfono local CO a "57XXXXXXXXXX". Null si inválido. */
    function normalizeCoPhone(raw) {
        const digits = String(raw || '').replace(/\D/g, '');
        if (digits.length === 0) return null;
        if (digits.length === 10) return '57' + digits;
        if (digits.startsWith('57') && digits.length === 12) return digits;
        return 'INVALID';
    }

    /** Genera slots HH:MM dado el horario del día del barbero. */
    function generarSlotsDelDia(horarioDia) {
        if (!horarioDia || !horarioDia.activo) return [];
        const [hD, mD] = (horarioDia.desde || '09:00').split(':').map(Number);
        const [hH, mH] = (horarioDia.hasta || '18:00').split(':').map(Number);
        const slots = [];
        let cur = hD * 60 + mD;
        const end = hH * 60 + mH;
        while (cur + DURACION_SLOT_MIN <= end) {
            const h = Math.floor(cur / 60);
            const m = cur % 60;
            slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            cur += DURACION_SLOT_MIN;
        }
        return slots;
    }

    // ============================================
    // ESTADO DEL MODAL
    // ============================================
    const form = {
        clienteNombre: '',
        clientePhone: '',
        barberoDocId: null,    // doc id del barbero
        conCorte: true,
        adicionalesIds: [],    // ids del catálogo de adicionales del barbero
        hora: null
    };

    function resetForm() {
        form.clienteNombre = '';
        form.clientePhone = '';
        form.barberoDocId = null;
        form.conCorte = true;
        form.adicionalesIds = [];
        form.hora = null;
    }

    function getBarberoSelected() {
        const recepState = window.recepState;
        if (!recepState || !form.barberoDocId) return null;
        return recepState.barberos.find(b => b.id === form.barberoDocId) || null;
    }

    function calcularTotal() {
        const b = getBarberoSelected();
        if (!b) return 0;
        const corte = form.conCorte ? (b.corte?.precio || 0) : 0;
        const adics = (b.adicionales || [])
            .filter(a => form.adicionalesIds.includes(a.id))
            .reduce((sum, a) => sum + (form.conCorte ? (a.precioConCorte || 0) : (a.precioSolo || 0)), 0);
        return corte + adics;
    }

    function buildServicioNombre() {
        const b = getBarberoSelected();
        if (!b) return 'Walk-in';
        const parts = [];
        if (form.conCorte) {
            const svcs = (b.corte?.servicios || []).map(s => s.nombre).join(' / ') || 'Corte';
            parts.push(svcs);
        }
        const adicNoms = (b.adicionales || [])
            .filter(a => form.adicionalesIds.includes(a.id))
            .map(a => a.nombre);
        if (adicNoms.length > 0) parts.push(adicNoms.join(' + '));
        return parts.join(' + ') || 'Walk-in';
    }

    // ============================================
    // RENDER
    // ============================================

    function open() {
        resetForm();
        const recepState = window.recepState;
        if (!recepState || !recepState.loaded) {
            if (typeof window.showToast === 'function') window.showToast('Esperá a que cargue la pantalla', 'info');
            return;
        }
        if (!recepState.barberos || recepState.barberos.length === 0) {
            if (typeof window.showToast === 'function') window.showToast('No hay barberos en tu sede', 'error');
            return;
        }

        const existing = document.getElementById('walkin-overlay');
        if (existing) existing.remove();

        const html = `
        <div id="walkin-overlay" class="barber-modal-overlay" style="z-index:150">
            <div class="barber-modal">
                <div class="barber-modal-header">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                            <span class="material-symbols-outlined text-primary text-xl" style="font-variation-settings: 'FILL' 1">person_add</span>
                        </div>
                        <div>
                            <h2 class="text-lg font-black text-white">Registrar Walk-in</h2>
                            <p class="text-white/40 text-xs">Cliente presencial — ${recepState.sedeNombre || 'sede'}</p>
                        </div>
                    </div>
                    <button onclick="closeWalkinModal()" class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/30 transition-all active:scale-90">
                        <span class="material-symbols-outlined text-white/60 text-lg hover:text-red-400">close</span>
                    </button>
                </div>

                <div class="barber-modal-body">
                    <!-- Cliente -->
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">person</span>
                            <span>Nombre del cliente</span>
                        </div>
                        <input id="walkin-cliente-nombre" type="text" placeholder="Ej: Carlos Pérez" maxlength="50"
                            class="barber-form-input" autocomplete="off">
                    </div>

                    <!-- Teléfono opcional -->
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">call</span>
                            <span>Teléfono <span class="text-white/30 text-[10px] font-normal">(opcional)</span></span>
                        </div>
                        <div class="relative">
                            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-black text-sm select-none">+57</div>
                            <input id="walkin-cliente-phone" type="tel" inputmode="tel" maxlength="14" placeholder="300 123 4567"
                                class="barber-form-input pl-12">
                        </div>
                    </div>

                    <!-- Barbero -->
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">content_cut</span>
                            <span>Barbero</span>
                        </div>
                        <select id="walkin-barbero" class="barber-form-select" onchange="walkinSelectBarbero(this.value)">
                            <option value="">Seleccionar barbero...</option>
                            ${recepState.barberos.map(b => `<option value="${b.id}">${b.userName || b.nombre || 'Barbero'} — ${(typeof window.formatCOP === 'function') ? window.formatCOP(b.corte?.precio || 0) : '$' + (b.corte?.precio || 0)}</option>`).join('')}
                        </select>
                    </div>

                    <!-- Con/sin corte -->
                    <div class="barber-form-section">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">cut</span>
                            <span>¿Quiere corte?</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <button id="walkin-corte-si" type="button" onclick="walkinToggleCorte(true)"
                                class="px-3 py-2.5 rounded-xl bg-primary/20 border-2 border-primary/40 text-primary text-xs font-black uppercase tracking-wider transition-all active:scale-95">
                                Sí, con corte
                            </button>
                            <button id="walkin-corte-no" type="button" onclick="walkinToggleCorte(false)"
                                class="px-3 py-2.5 rounded-xl bg-white/[0.04] border-2 border-white/[0.08] text-white/60 text-xs font-black uppercase tracking-wider transition-all active:scale-95">
                                Solo adicionales
                            </button>
                        </div>
                    </div>

                    <!-- Adicionales (dinámico según barbero) -->
                    <div id="walkin-adicionales-section" class="barber-form-section" style="display:none">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">add_circle</span>
                            <span>Adicionales</span>
                        </div>
                        <div id="walkin-adicionales-list" class="space-y-2"></div>
                    </div>

                    <!-- Hora (dinámico) -->
                    <div id="walkin-hora-section" class="barber-form-section" style="display:none">
                        <div class="barber-form-label">
                            <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">schedule</span>
                            <span>Hora</span>
                        </div>
                        <div id="walkin-hora-grid" class="grid grid-cols-4 gap-2"></div>
                        <p class="text-white/30 text-[10px] mt-2 pl-1">Solo aparecen horarios libres del barbero para hoy</p>
                    </div>

                    <!-- Total -->
                    <div id="walkin-total-bar" class="p-3 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-between" style="display:none">
                        <span class="text-white/65 text-xs font-bold uppercase tracking-wider">Total</span>
                        <span id="walkin-total-amount" class="text-primary text-lg font-black tabular-nums">$0</span>
                    </div>
                </div>

                <div class="barber-modal-footer">
                    <button onclick="closeWalkinModal()" class="flex-1 px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">
                        Cancelar
                    </button>
                    <button id="walkin-submit" onclick="walkinSubmit()" class="flex-[2] px-5 py-3.5 rounded-xl bg-primary text-black text-sm font-black uppercase tracking-wider shadow-[0_4px_20px_rgba(201,167,74,0.3)] hover:bg-yellow-500 transition-all active:scale-[0.97]">
                        <span class="flex items-center justify-center gap-2">
                            <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1">check_circle</span>
                            Registrar
                        </span>
                    </button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);

        // Hook para format de teléfono
        if (typeof window.attachPriceInput === 'function') {
            // no aplicamos al phone — solo a precios
        }

        requestAnimationFrame(() => {
            document.getElementById('walkin-overlay')?.classList.add('visible');
            document.getElementById('walkin-cliente-nombre')?.focus();
        });
    }

    function close() {
        const overlay = document.getElementById('walkin-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 250);
        }
    }

    // ============================================
    // INTERACCIÓN
    // ============================================

    function selectBarbero(barberoDocId) {
        form.barberoDocId = barberoDocId || null;
        form.adicionalesIds = [];
        form.hora = null;
        renderAdicionalesPanel();
        renderHoraPanel();
        renderTotal();
    }

    function toggleCorte(value) {
        form.conCorte = !!value;
        const si = document.getElementById('walkin-corte-si');
        const no = document.getElementById('walkin-corte-no');
        if (si && no) {
            si.className = form.conCorte
                ? 'px-3 py-2.5 rounded-xl bg-primary/20 border-2 border-primary/40 text-primary text-xs font-black uppercase tracking-wider transition-all active:scale-95'
                : 'px-3 py-2.5 rounded-xl bg-white/[0.04] border-2 border-white/[0.08] text-white/60 text-xs font-black uppercase tracking-wider transition-all active:scale-95';
            no.className = !form.conCorte
                ? 'px-3 py-2.5 rounded-xl bg-primary/20 border-2 border-primary/40 text-primary text-xs font-black uppercase tracking-wider transition-all active:scale-95'
                : 'px-3 py-2.5 rounded-xl bg-white/[0.04] border-2 border-white/[0.08] text-white/60 text-xs font-black uppercase tracking-wider transition-all active:scale-95';
        }
        // Cuando se desmarca corte, filtramos adicionales que requieren corte
        if (!form.conCorte) {
            const b = getBarberoSelected();
            if (b) {
                form.adicionalesIds = form.adicionalesIds.filter(id => {
                    const a = (b.adicionales || []).find(x => x.id === id);
                    return a && !a.soloConCorte;
                });
            }
        }
        renderAdicionalesPanel();
        renderTotal();
    }

    function toggleAdicional(id) {
        const idx = form.adicionalesIds.indexOf(id);
        if (idx >= 0) form.adicionalesIds.splice(idx, 1);
        else form.adicionalesIds.push(id);
        renderAdicionalesPanel();
        renderTotal();
    }

    function renderAdicionalesPanel() {
        const section = document.getElementById('walkin-adicionales-section');
        const list = document.getElementById('walkin-adicionales-list');
        if (!section || !list) return;
        const b = getBarberoSelected();
        const all = (b?.adicionales || []).filter(a => form.conCorte || !a.soloConCorte);
        if (all.length === 0) {
            section.style.display = 'none';
            return;
        }
        section.style.display = '';
        list.innerHTML = all.map(a => {
            const selected = form.adicionalesIds.includes(a.id);
            const precio = form.conCorte ? (a.precioConCorte || 0) : (a.precioSolo || 0);
            const precioTxt = (typeof window.formatCOP === 'function') ? window.formatCOP(precio) : `$${precio}`;
            return `
                <button type="button" onclick="walkinToggleAdicional('${a.id}')"
                    class="w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 ${selected ? 'bg-primary/15 border-primary/40' : 'bg-white/[0.03] border-white/[0.08]'} hover:border-primary/30 transition-all active:scale-[0.98]">
                    <span class="flex items-center gap-2 min-w-0">
                        <span class="material-symbols-outlined ${selected ? 'text-primary' : 'text-white/30'} text-base" style="font-variation-settings: 'FILL' ${selected ? 1 : 0}">${selected ? 'check_circle' : 'add_circle'}</span>
                        <span class="${selected ? 'text-white' : 'text-white/70'} text-sm font-bold truncate">${a.nombre}</span>
                    </span>
                    <span class="${selected ? 'text-primary' : 'text-white/50'} text-sm font-black tabular-nums shrink-0">${precioTxt}</span>
                </button>
            `;
        }).join('');
    }

    async function renderHoraPanel() {
        const section = document.getElementById('walkin-hora-section');
        const grid = document.getElementById('walkin-hora-grid');
        if (!section || !grid) return;
        const b = getBarberoSelected();
        if (!b) { section.style.display = 'none'; return; }

        const hoy = todayISO();
        const dia = diaKey(hoy);
        const horarioDia = b.horario?.[dia];
        const todosSlots = generarSlotsDelDia(horarioDia);

        // Filtrar slots ya pasados (más de 30min de margen)
        const now = new Date();
        const futuros = todosSlots.filter(s => {
            const [hh, mm] = s.split(':').map(Number);
            const slotDate = new Date();
            slotDate.setHours(hh, mm, 0, 0);
            return slotDate.getTime() > now.getTime() - 30 * 60000;
        });

        if (futuros.length === 0) {
            section.style.display = '';
            grid.innerHTML = `
                <div class="col-span-4 text-center py-6 text-white/40 text-xs">
                    <span class="material-symbols-outlined text-white/20 text-3xl block mb-2">event_busy</span>
                    Sin horarios disponibles hoy para este barbero
                </div>`;
            return;
        }

        // Restar ocupados
        let ocupados = [];
        try {
            ocupados = await CitasService.getOccupiedSlots(b.userId, hoy);
        } catch (e) {
            ocupados = [];
        }
        const libres = futuros.filter(s => !ocupados.includes(s));

        section.style.display = '';
        if (libres.length === 0) {
            grid.innerHTML = `
                <div class="col-span-4 text-center py-6 text-white/40 text-xs">
                    <span class="material-symbols-outlined text-white/20 text-3xl block mb-2">event_busy</span>
                    Todos los horarios de hoy ya están ocupados
                </div>`;
            return;
        }
        grid.innerHTML = libres.map(h => {
            const active = form.hora === h;
            return `
                <button type="button" onclick="walkinSelectHora('${h}')"
                    class="px-3 py-2.5 rounded-xl text-xs font-black tabular-nums transition-all active:scale-95
                        ${active ? 'bg-primary text-black' : 'bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08]'}">
                    ${h}
                </button>
            `;
        }).join('');
    }

    function selectHora(hora) {
        form.hora = hora;
        renderHoraPanel();
        renderTotal();
    }

    function renderTotal() {
        const bar = document.getElementById('walkin-total-bar');
        const amount = document.getElementById('walkin-total-amount');
        if (!bar || !amount) return;
        if (!form.barberoDocId) { bar.style.display = 'none'; return; }
        bar.style.display = '';
        amount.textContent = (typeof window.formatCOP === 'function')
            ? window.formatCOP(calcularTotal())
            : '$' + calcularTotal();
    }

    // ============================================
    // SUBMIT
    // ============================================

    async function submit() {
        const recepState = window.recepState;
        if (!recepState || !recepState.sedeId) {
            if (typeof window.showToast === 'function') window.showToast('Sin sede asignada', 'error');
            return;
        }

        const nombre = (document.getElementById('walkin-cliente-nombre')?.value || '').trim();
        if (!nombre) {
            if (typeof window.showToast === 'function') window.showToast('Ingresá el nombre del cliente', 'error');
            return;
        }

        const phoneRaw = document.getElementById('walkin-cliente-phone')?.value || '';
        const phoneNorm = normalizeCoPhone(phoneRaw);
        if (phoneNorm === 'INVALID') {
            if (typeof window.showToast === 'function') window.showToast('Teléfono inválido (10 dígitos)', 'error');
            return;
        }

        if (!form.barberoDocId) {
            if (typeof window.showToast === 'function') window.showToast('Elegí un barbero', 'error');
            return;
        }
        if (!form.hora) {
            if (typeof window.showToast === 'function') window.showToast('Elegí una hora', 'error');
            return;
        }
        if (!form.conCorte && form.adicionalesIds.length === 0) {
            if (typeof window.showToast === 'function') window.showToast('Si no hay corte, elegí al menos un adicional', 'error');
            return;
        }

        const b = getBarberoSelected();
        const total = calcularTotal();
        if (total <= 0) {
            if (typeof window.showToast === 'function') window.showToast('Total en 0 — revisá la selección', 'error');
            return;
        }

        const user = (typeof roleManager !== 'undefined') ? roleManager.currentUser : null;
        const submitBtn = document.getElementById('walkin-submit');
        const orig = submitBtn?.innerHTML;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="auth-checking-spinner" style="width:1.2rem;height:1.2rem;border-width:2px;margin:0 auto"></div>';
        }

        const citaId = await CitasService.createWalkin({
            sedeId: recepState.sedeId,
            barberoId: b.userId,
            barberoNombre: b.userName || b.nombre || 'Barbero',
            barberoNivel: b.nivel || null,
            clienteNombre: nombre,
            clientePhone: phoneNorm || null,
            servicioNombre: buildServicioNombre(),
            servicioPrecio: total,
            fecha: todayISO(),
            hora: form.hora,
            creadoPor: user?.uid || null
        });

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = orig;
        }

        if (!citaId) {
            if (typeof window.showToast === 'function') window.showToast('No se pudo registrar el walk-in', 'error');
            return;
        }

        if (typeof window.showToast === 'function') window.showToast(`Walk-in registrado ✓ ${form.hora}`, 'success');
        close();
        if (typeof window.onRecepWalkinCreated === 'function') {
            window.onRecepWalkinCreated();
        }
    }

    // ============================================
    // EXPONER
    // ============================================
    window.openWalkinModal = open;
    window.closeWalkinModal = close;
    window.walkinSelectBarbero = selectBarbero;
    window.walkinToggleCorte = toggleCorte;
    window.walkinToggleAdicional = toggleAdicional;
    window.walkinSelectHora = selectHora;
    window.walkinSubmit = submit;

    console.log('✓ RecepcionistaWalkinUI (F2) loaded');
})();
