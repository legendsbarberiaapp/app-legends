/**
 * LEGENDS BARBERIA - BOOKING UI (CLIENTE)
 * Reserva de cita en 4 pasos:
 *   1) Barbero (pantalla bonita con cards de nivel: Leyenda > Profesional > Experto)
 *   2) Corte (sí/no; muestra servicios incluidos + precio del barbero)
 *   3) Adicionales (precio con/sin corte; filtra soloConCorte si aplica)
 *   4) Fecha y hora (slots generados desde el horario real del barbero)
 *
 * Al confirmar crea un documento en la colección `citas` vía CitasService.
 * Mantiene retrocompatibilidad con el schema viejo (servicioNombre/servicioPrecio
 * derivados) para que admin, barbero y profile-ui sigan funcionando sin cambios.
 */

(function () {
    'use strict';

    // ==========================================================
    // CONSTANTES
    // ==========================================================

    const DIAS_SEMANA_KEY = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const DURACION_SLOT_MIN = 45; // duración del bloque de reserva

    // Mínimo 6 horas de anticipación para reservar
    const MIN_HORAS_ANTICIPACION = 6;

    // Domingo: bloqueado (solo cortes presenciales en la barbería, sin reserva)
    const DIA_DOMINGO_KEY = 'domingo';
    const MSG_DOMINGO = 'Ese día solo se reciben cortes en la barbería';

    /**
     * Hace que las fotos de Google vengan en mayor resolución.
     * Reemplaza el sufijo de tamaño (=s96-c, /s96-c/) por uno más grande.
     */
    function upscaleGooglePhoto(url, size = 400) {
        if (!url || typeof url !== 'string') return url;
        if (!/googleusercontent\.com/.test(url)) return url;
        return url
            .replace(/=s\d+(-c)?/g, `=s${size}-c`)
            .replace(/\/s\d+-c\//g, `/s${size}-c/`);
    }

    // Tema visual según nivel del barbero (Leyenda = premium dorado)
    const NIVEL_THEME = {
        Leyenda: {
            borderActive: 'border-primary',
            borderInactive: 'border-primary/40',
            bgOverlay: 'bg-gradient-to-br from-primary/25 via-primary/10 to-transparent',
            badge: 'bg-gradient-to-r from-primary to-primary-light text-black',
            glow: 'shadow-[0_10px_40px_rgba(201,167,74,0.35)]',
            ring: 'ring-primary',
            icon: 'emoji_events',
            label: 'LEYENDA',
            premiumDecor: true
        },
        Profesional: {
            borderActive: 'border-purple-400',
            borderInactive: 'border-purple-500/40',
            bgOverlay: 'bg-gradient-to-br from-purple-500/20 via-purple-500/8 to-transparent',
            badge: 'bg-gradient-to-r from-purple-500 to-purple-400 text-white',
            glow: 'shadow-[0_6px_25px_rgba(168,85,247,0.25)]',
            ring: 'ring-purple-400',
            icon: 'military_tech',
            label: 'PROFESIONAL',
            premiumDecor: false
        },
        Experto: {
            borderActive: 'border-blue-400',
            borderInactive: 'border-blue-500/40',
            bgOverlay: 'bg-gradient-to-br from-blue-500/20 via-blue-500/8 to-transparent',
            badge: 'bg-gradient-to-r from-blue-500 to-blue-400 text-white',
            glow: 'shadow-[0_6px_25px_rgba(59,130,246,0.25)]',
            ring: 'ring-blue-400',
            icon: 'workspace_premium',
            label: 'EXPERTO',
            premiumDecor: false
        }
    };
    const NIVEL_ORDER = { Leyenda: 0, Profesional: 1, Experto: 2 };

    function getTheme(nivel) {
        return NIVEL_THEME[nivel] || NIVEL_THEME.Experto;
    }

    // ==========================================================
    // ESTADO DE LA RESERVA
    // ==========================================================

    const state = {
        step: 1,
        barbero: null,       // {id (userId), docId, nombre, photoURL, nivel, corte, adicionalesConfig, horario}
        conCorte: null,      // true | false | null
        adicionales: [],     // [{id, nombre, precio}]  (precio recalculado si cambia conCorte)
        fecha: null,
        hora: null
    };

    // Preselección desde home (solo barbero; servicio legacy se ignora porque
    // el flujo nuevo no tiene catálogo estático)
    const pendingPreselection = {
        servicio: null,
        barbero: null
    };

    let occupiedSlots = [];
    let lastTotal = 0;
    let cachedBarberos = null; // evita doble fetch

    const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ==========================================================
    // HELPERS DE NEGOCIO
    // ==========================================================

    /** ¿La fecha+hora está dentro de las próximas 6 h? */
    function slotCumpleAnticipacion(fecha, hora) {
        if (!fecha || !hora) return true;
        const [y, m, d] = fecha.split('-').map(Number);
        const [hh, mm] = hora.split(':').map(Number);
        const slotDate = new Date(y, m - 1, d, hh, mm);
        const minAllowed = new Date();
        minAllowed.setHours(minAllowed.getHours() + MIN_HORAS_ANTICIPACION);
        return slotDate >= minAllowed;
    }

    function slotEstaOcupado(hora) {
        return occupiedSlots.includes(hora);
    }

    async function refreshOccupiedSlots() {
        if (!state.barbero || !state.fecha) {
            occupiedSlots = [];
            return;
        }
        try {
            occupiedSlots = await CitasService.getOccupiedSlots(state.barbero.id, state.fecha);
        } catch (error) {
            console.error('❌ Error refrescando ocupados:', error);
            occupiedSlots = [];
        }
    }

    /**
     * Genera slots "HH:MM" desde el horario del barbero para un día puntual.
     * Si el día no está activo devuelve lista vacía.
     */
    function generarSlotsDelDia(horarioDia, duracionMin = DURACION_SLOT_MIN) {
        if (!horarioDia || !horarioDia.activo) return [];
        const [hDesde, mDesde] = (horarioDia.desde || '09:00').split(':').map(Number);
        const [hHasta, mHasta] = (horarioDia.hasta || '18:00').split(':').map(Number);
        const slots = [];
        let currentMin = hDesde * 60 + mDesde;
        const endMin = hHasta * 60 + mHasta;
        while (currentMin + duracionMin <= endMin) {
            const h = Math.floor(currentMin / 60);
            const m = currentMin % 60;
            slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            currentMin += duracionMin;
        }
        return slots;
    }

    function diasActivosCount(horario) {
        if (!horario) return 0;
        return Object.values(horario).filter(d => d && d.activo).length;
    }

    /** Recalcula precio de cada adicional según conCorte actual y filtra los no permitidos. */
    function recomputarAdicionalesSegunCorte() {
        if (!state.barbero) return;
        const conCorte = state.conCorte === true;
        state.adicionales = state.adicionales
            .filter(a => {
                if (!conCorte) {
                    const cfg = state.barbero.adicionalesConfig.find(c => c.id === a.id);
                    if (cfg && cfg.soloConCorte) return false;
                }
                return true;
            })
            .map(a => {
                const cfg = state.barbero.adicionalesConfig.find(c => c.id === a.id);
                const precio = conCorte ? (cfg?.precioConCorte || 0) : (cfg?.precioSolo || 0);
                return { ...a, precio };
            });
    }

    function calcularTotal() {
        if (!state.barbero) return 0;
        const totalCorte = state.conCorte === true ? (state.barbero.corte?.precio || 0) : 0;
        const totalAdicionales = state.adicionales.reduce((sum, a) => sum + (a.precio || 0), 0);
        return totalCorte + totalAdicionales;
    }

    // ==========================================================
    // COUNT-UP ANIMADO EN EL TOTAL
    // ==========================================================

    function animateCountUp(element, from, to, duration = 420) {
        if (!element) return;
        const fmt = (v) => window.formatCOP ? window.formatCOP(v) : `$${v}`;

        if (from === to || reduceMotion()) {
            element.textContent = fmt(to);
            return;
        }

        const start = performance.now();
        const tick = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(from + (to - from) * eased);
            element.textContent = fmt(current);
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    // ==========================================================
    // RENDER: STEP 1 — BARBEROS
    // ==========================================================

    async function renderBarberosStep() {
        const container = document.getElementById('booking-barberos');
        if (!container) return;

        // Grid de 2 columnas (cards compactas)
        container.className = 'grid grid-cols-2 gap-3';

        if (!cachedBarberos) {
            container.innerHTML = `
                <div class="skeleton-shimmer aspect-[3/4] rounded-2xl"></div>
                <div class="skeleton-shimmer aspect-[3/4] rounded-2xl opacity-80"></div>
                <div class="skeleton-shimmer aspect-[3/4] rounded-2xl opacity-60"></div>
                <div class="skeleton-shimmer aspect-[3/4] rounded-2xl opacity-40"></div>
            `;
            try {
                cachedBarberos = await BarbersService.list();
            } catch (error) {
                console.error('❌ Error cargando barberos:', error);
                container.className = 'flex flex-col gap-4';
                container.innerHTML = renderEmptyError('Error al cargar barberos', 'initBooking()');
                return;
            }
        }

        if (!cachedBarberos || cachedBarberos.length === 0) {
            container.className = 'flex flex-col gap-4';
            container.innerHTML = `
                <div class="empty-state-premium fade-in-soft">
                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/25 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary/60 text-4xl" style="font-variation-settings: 'FILL' 1" aria-hidden="true">person_off</span>
                    </div>
                    <p class="text-white/85 text-sm font-bold">Aún no hay barberos disponibles</p>
                    <p class="text-white/50 text-xs">Pronto sumaremos a los mejores profesionales</p>
                </div>
            `;
            return;
        }

        // Orden: Leyenda primero, luego Profesional, luego Experto
        const ordenados = [...cachedBarberos].sort((a, b) => {
            return (NIVEL_ORDER[a.nivel] ?? 9) - (NIVEL_ORDER[b.nivel] ?? 9);
        });

        container.innerHTML = ordenados.map((b, i) => renderBarberoCard(b, i)).join('');

        container.querySelectorAll('[data-barbero-doc-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const barbero = cachedBarberos.find(x => x.id === btn.dataset.barberoDocId);
                if (!barbero) return;
                selectBarbero(barbero);
            });
        });
    }

    function renderBarberoCard(barbero, index) {
        const theme = getTheme(barbero.nivel);
        const nombre = barbero.userName || barbero.nombre || barbero.displayName || 'Barbero';
        const fallbackFoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=c9a74a&color=000&size=600&bold=true`;
        const rawFoto = barbero.userPhoto || barbero.photoURL || barbero.foto || fallbackFoto;
        const foto = upscaleGooglePhoto(rawFoto, 600);
        const precio = barbero.corte?.precio || 0;
        const isSelected = state.barbero?.docId === barbero.id;
        const borderClass = isSelected ? theme.borderActive : theme.borderInactive;

        const premiumDecor = theme.premiumDecor ? `
            <div class="absolute inset-0 pointer-events-none">
                <div class="absolute -top-8 -right-8 w-28 h-28 bg-primary/20 rounded-full blur-2xl"></div>
            </div>` : '';

        const checkMark = isSelected ? `
            <div class="absolute top-2 right-2 w-7 h-7 rounded-full ${theme.badge} flex items-center justify-center shadow-lg ring-2 ring-black/40">
                <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1" aria-hidden="true">check</span>
            </div>` : '';

        const selectedRing = isSelected ? `ring-2 ring-inset ${theme.ring}/70` : '';

        return `
            <button data-barbero-doc-id="${barbero.id}"
                aria-label="Elegir a ${nombre}, ${theme.label.toLowerCase()}, desde ${window.formatCOP(precio)}"
                aria-pressed="${isSelected}"
                style="--stagger-index: ${index};"
                class="stagger-item tap-card relative w-full rounded-2xl overflow-hidden border-2 ${borderClass} ${theme.glow} transition-all group">

                <div class="relative w-full" style="aspect-ratio: 3/4; background: linear-gradient(135deg, #2a2417, #121212);">
                    <img src="${foto}" alt="Foto de ${nombre}" loading="lazy"
                        referrerpolicy="no-referrer"
                        onerror="this.onerror=null;this.src='${fallbackFoto}';"
                        class="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-[1.05] transition-transform duration-500">

                    <!-- Overlay oscuro inferior para legibilidad -->
                    <div class="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent"></div>
                    <div class="absolute inset-0 ${theme.bgOverlay} opacity-30"></div>

                    ${premiumDecor}

                    <!-- Badge nivel arriba izquierda (compacto) -->
                    <div class="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full ${theme.badge} shadow-md">
                        <span class="material-symbols-outlined text-[11px]" style="font-variation-settings: 'FILL' 1" aria-hidden="true">${theme.icon}</span>
                        <span class="text-[8px] font-black uppercase tracking-wider">${theme.label}</span>
                    </div>

                    ${checkMark}

                    <!-- Nombre + precio abajo -->
                    <div class="absolute bottom-0 left-0 right-0 p-3">
                        <h3 class="text-white text-lg font-black leading-none tracking-tight mb-1.5 drop-shadow-lg truncate">${nombre}</h3>
                        <div class="flex items-center justify-between gap-1">
                            <span class="text-white/75 text-[10px] font-bold uppercase tracking-wider">Desde</span>
                            <span class="text-primary text-sm font-black tabular-nums drop-shadow">${window.formatCOP(precio)}</span>
                        </div>
                    </div>

                    ${isSelected ? `<div class="absolute inset-0 pointer-events-none rounded-2xl ${selectedRing}"></div>` : ''}
                </div>
            </button>
        `;
    }

    function renderEmptyError(mensaje, retryFn) {
        return `
            <div class="empty-state-premium fade-in-soft" style="border-color: rgba(239,68,68,0.2);">
                <div class="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center">
                    <span class="material-symbols-outlined text-red-400 text-3xl" aria-hidden="true">error</span>
                </div>
                <p class="text-red-400 text-sm font-bold">${mensaje}</p>
                <button onclick="${retryFn}" aria-label="Reintentar"
                    class="flex items-center gap-2 px-5 py-2.5 bg-primary/15 text-primary text-xs font-black uppercase tracking-wider rounded-xl border border-primary/30 hover:bg-primary/25 transition-all active:scale-95">
                    <span class="material-symbols-outlined text-base" aria-hidden="true">refresh</span>
                    <span>Reintentar</span>
                </button>
            </div>
        `;
    }

    function selectBarbero(barbero) {
        state.barbero = {
            id: barbero.userId || barbero.id,
            docId: barbero.id,
            nombre: barbero.userName || barbero.nombre || barbero.displayName || 'Barbero',
            photoURL: barbero.userPhoto || barbero.photoURL || barbero.foto || null,
            nivel: barbero.nivel || 'Experto',
            corte: barbero.corte || { servicios: [], precio: 0 },
            adicionalesConfig: barbero.adicionales || [],
            horario: barbero.horario || {}
        };
        // Reset estado aguas abajo porque cambia el barbero
        state.conCorte = null;
        state.adicionales = [];
        state.fecha = null;
        state.hora = null;
        occupiedSlots = [];

        renderBarberosStep();
        renderProgress();
        renderFooter();
    }

    // ==========================================================
    // RENDER: STEP 2 — ¿CORTE?
    // ==========================================================

    function renderCorteStep() {
        const container = document.getElementById('booking-corte-opciones');
        if (!container || !state.barbero) return;

        const servicios = state.barbero.corte?.servicios || [];
        const precio = state.barbero.corte?.precio || 0;

        const isCorteSelected = state.conCorte === true;
        const isSoloSelected = state.conCorte === false;

        // Disponibilidad de "solo adicionales": hay al menos un adicional NO soloConCorte
        const haySinCorte = (state.barbero.adicionalesConfig || []).some(a => !a.soloConCorte);

        const serviciosHTML = servicios.length > 0
            ? servicios.map(s => `
                <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/15 border border-primary/30">
                    <span class="material-symbols-outlined text-primary text-xs" style="font-variation-settings: 'FILL' 1" aria-hidden="true">check_circle</span>
                    <span class="text-primary text-[11px] font-bold">${s.nombre}</span>
                </div>
            `).join('')
            : '<p class="text-white/50 text-xs">Corte tradicional del barbero</p>';

        const corteCheck = isCorteSelected ? `
            <div class="absolute top-4 right-4 w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-lg">
                <span class="material-symbols-outlined text-black text-lg" style="font-variation-settings: 'FILL' 1" aria-hidden="true">check</span>
            </div>` : '';

        const soloCheck = isSoloSelected ? `
            <div class="absolute top-4 right-4 w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-lg">
                <span class="material-symbols-outlined text-black text-lg" style="font-variation-settings: 'FILL' 1" aria-hidden="true">check</span>
            </div>` : '';

        container.innerHTML = `
            <!-- OPCIÓN A: Con corte -->
            <button data-corte="si" aria-pressed="${isCorteSelected}"
                class="tap-card relative w-full text-left p-6 rounded-3xl border-2 transition-all ${
                    isCorteSelected
                        ? 'border-primary bg-gradient-to-br from-primary/20 via-primary/10 to-transparent shadow-[0_8px_30px_rgba(201,167,74,0.25)]'
                        : 'border-white/10 bg-gradient-to-br from-card-dark to-surface-dark hover:border-primary/40'
                }">
                <div class="flex items-start justify-between gap-3 mb-4 pr-12">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0">
                            <span class="material-symbols-outlined text-2xl" style="font-variation-settings: 'FILL' 1" aria-hidden="true">content_cut</span>
                        </div>
                        <div class="min-w-0">
                            <h4 class="text-white font-black text-lg leading-tight">Quiero el corte</h4>
                            <p class="text-white/60 text-xs mt-0.5">Servicio completo con todo incluido</p>
                        </div>
                    </div>
                    <p class="text-primary text-2xl font-black tabular-nums shrink-0">${window.formatCOP(precio)}</p>
                </div>
                ${servicios.length > 0 ? `
                    <p class="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-2">Incluye</p>
                    <div class="flex flex-wrap gap-1.5">
                        ${serviciosHTML}
                    </div>` : '<div class="mt-1">' + serviciosHTML + '</div>'}
                ${corteCheck}
            </button>

            <!-- OPCIÓN B: Solo adicionales -->
            <button data-corte="no" aria-pressed="${isSoloSelected}" ${!haySinCorte ? 'disabled' : ''}
                class="tap-card relative w-full text-left p-6 rounded-3xl border-2 transition-all ${
                    !haySinCorte
                        ? 'border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed'
                        : isSoloSelected
                            ? 'border-white/30 bg-gradient-to-br from-white/8 to-transparent shadow-[0_6px_20px_rgba(255,255,255,0.08)]'
                            : 'border-white/10 bg-gradient-to-br from-card-dark/60 to-surface-dark/60 hover:border-white/25'
                }">
                <div class="flex items-center justify-between gap-3 pr-12">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white/70 shrink-0">
                            <span class="material-symbols-outlined text-2xl" aria-hidden="true">add_circle</span>
                        </div>
                        <div class="min-w-0">
                            <h4 class="text-white font-black text-lg leading-tight">Solo adicionales</h4>
                            <p class="text-white/60 text-xs mt-0.5">${haySinCorte ? 'Barba, diseño u otros servicios sueltos' : 'Este barbero no ofrece servicios individuales'}</p>
                        </div>
                    </div>
                </div>
                ${soloCheck}
            </button>
        `;

        container.querySelectorAll('[data-corte]:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                const conCorte = btn.dataset.corte === 'si';
                if (state.conCorte === conCorte) return; // sin cambio, no tocamos nada
                state.conCorte = conCorte;
                recomputarAdicionalesSegunCorte();
                // Al cambiar la decisión de corte, los horarios pueden cambiar
                // (diferente duración implícita de servicio). Reset fecha/hora.
                state.fecha = null;
                state.hora = null;
                renderCorteStep();
                renderProgress();
                renderFooter();
            });
        });
    }

    // ==========================================================
    // RENDER: STEP 3 — ADICIONALES
    // ==========================================================

    function renderAdicionalesStep() {
        const container = document.getElementById('booking-adicionales');
        if (!container || !state.barbero) return;

        const conCorte = state.conCorte === true;
        const adicionalesDisponibles = (state.barbero.adicionalesConfig || []).filter(a => {
            if (a.soloConCorte && !conCorte) return false;
            return true;
        });

        if (adicionalesDisponibles.length === 0) {
            container.innerHTML = `
                <div class="empty-state-premium fade-in-soft">
                    <div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center">
                        <span class="material-symbols-outlined text-white/50 text-3xl" style="font-variation-settings: 'FILL' 1" aria-hidden="true">check_circle</span>
                    </div>
                    <p class="text-white/85 text-sm font-bold">Sin adicionales disponibles</p>
                    <p class="text-white/50 text-xs text-center">Continuá para elegir fecha y hora</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="space-y-2">
                ${adicionalesDisponibles.map((a, i) => {
                    const precio = conCorte ? (a.precioConCorte || 0) : (a.precioSolo || 0);
                    const isSelected = state.adicionales.some(x => x.id === a.id);
                    const precioFmt = window.formatCOP(precio);
                    return `
                        <button data-adicional-id="${a.id}" aria-pressed="${isSelected}"
                            aria-label="${isSelected ? 'Quitar' : 'Agregar'} ${a.nombre} por ${precioFmt}"
                            style="--stagger-index: ${i};"
                            class="stagger-item tap-card w-full text-left flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                                isSelected
                                    ? 'border-primary bg-primary/10 shadow-[0_4px_20px_rgba(201,167,74,0.15)]'
                                    : 'border-white/10 bg-card-dark hover:border-primary/30'
                            }">
                            <div class="w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                isSelected ? 'bg-primary text-black' : 'bg-white/10 border border-white/20 text-transparent'
                            }">
                                <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1" aria-hidden="true">check</span>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-white font-bold text-sm leading-tight">${a.nombre}</p>
                                ${a.soloConCorte ? '<p class="text-amber-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">Solo con corte</p>' : ''}
                            </div>
                            <p class="${isSelected ? 'text-primary' : 'text-white/85'} font-black text-base tabular-nums shrink-0">+${precioFmt}</p>
                        </button>
                    `;
                }).join('')}
            </div>
        `;

        container.querySelectorAll('[data-adicional-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.adicionalId;
                const adic = adicionalesDisponibles.find(a => a.id === id);
                if (!adic) return;
                const precio = conCorte ? (adic.precioConCorte || 0) : (adic.precioSolo || 0);
                const idx = state.adicionales.findIndex(x => x.id === id);
                if (idx >= 0) {
                    state.adicionales.splice(idx, 1);
                } else {
                    state.adicionales.push({ id: adic.id, nombre: adic.nombre, precio });
                }
                renderAdicionalesStep();
                renderFooter();
            });
        });
    }

    // ==========================================================
    // RENDER: STEP 4 — FECHA Y HORA
    // ==========================================================

    function renderFechas() {
        const container = document.getElementById('booking-fechas');
        if (!container || !state.barbero) return;

        const dias = [];
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const diasSemanaCorto = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

        for (let i = 0; i < 14; i++) {
            const d = new Date(hoy);
            d.setDate(hoy.getDate() + i);
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const diaKey = DIAS_SEMANA_KEY[d.getDay()];
            const esDomingo = diaKey === DIA_DOMINGO_KEY;
            const horarioDia = state.barbero.horario?.[diaKey];
            const disponible = !esDomingo && !!(horarioDia && horarioDia.activo);
            dias.push({
                iso,
                dia: d.getDate(),
                nombreCorto: diasSemanaCorto[d.getDay()],
                esHoy: i === 0,
                esDomingo,
                disponible
            });
        }

        container.innerHTML = dias.map(d => {
            const isSelected = state.fecha === d.iso;
            const disabled = !d.disponible;
            let classes;
            if (d.esDomingo) {
                classes = 'flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-xl bg-amber-500/5 border-2 border-amber-500/20 text-amber-400/70 cursor-not-allowed';
            } else if (disabled) {
                classes = 'flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-xl bg-white/[0.02] border-2 border-white/5 text-white/25 cursor-not-allowed';
            } else if (isSelected) {
                classes = 'tap-card flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-xl bg-gradient-to-br from-primary to-primary-light text-black font-black shadow-[0_0_15px_rgba(201,167,74,0.45)] transition-all';
            } else {
                classes = 'tap-card flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-xl bg-background-dark/80 border-2 border-white/10 text-white hover:border-primary/40 transition-all';
            }
            const ariaLabel = d.esDomingo
                ? `Domingo ${d.dia} · ${MSG_DOMINGO}`
                : `${d.nombreCorto} ${d.dia}${d.esHoy ? ' (hoy)' : ''}${disabled ? ' (barbero no trabaja)' : ''}`;
            const labelTop = d.esDomingo
                ? `<span class="text-[10px] font-bold uppercase text-amber-400/80">${d.nombreCorto}</span>`
                : `<span class="text-[10px] font-bold uppercase ${isSelected ? 'text-black/70' : disabled ? 'text-white/25' : 'text-white/65'}">${d.nombreCorto}</span>`;
            const labelHoy = d.esHoy && !d.esDomingo
                ? `<span class="text-[9px] font-bold ${isSelected ? 'text-black/60' : disabled ? 'text-white/25' : 'text-primary'}">HOY</span>`
                : '';
            const iconoDomingo = d.esDomingo
                ? '<span class="material-symbols-outlined text-amber-400/70 text-[10px] absolute -bottom-0.5 right-0.5" style="font-variation-settings: \'FILL\' 1" aria-hidden="true" title="' + MSG_DOMINGO + '">store</span>'
                : '';
            return `
                <button data-fecha="${d.iso}" data-dia-key="${d.esDomingo ? DIA_DOMINGO_KEY : ''}" aria-label="${ariaLabel}" aria-pressed="${isSelected}"
                    ${disabled ? 'disabled' : ''} class="relative ${classes}">
                    ${labelTop}
                    <span class="text-lg font-black">${d.dia}</span>
                    ${labelHoy}
                    ${iconoDomingo}
                </button>
            `;
        }).join('');

        container.querySelectorAll('[data-fecha]:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => selectFecha(btn.dataset.fecha));
        });

        // Tap en domingo: toast explicando por qué está bloqueado
        container.querySelectorAll('[data-dia-key="domingo"]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (typeof window.showToast === 'function') {
                    window.showToast(MSG_DOMINGO, 'info');
                }
            });
        });

        updateFechasArrows();
    }

    function renderHorarios() {
        const container = document.getElementById('booking-horarios');
        if (!container || !state.barbero) return;

        // Reset a clases de grid por defecto (por si el empty state cambió className)
        container.className = 'grid grid-cols-3 sm:grid-cols-4 gap-3';

        if (!state.fecha) {
            container.className = 'flex items-center justify-center py-2';
            container.innerHTML = `
                <p class="text-white/50 text-sm text-center">Elegí primero una fecha</p>
            `;
            return;
        }

        const [y, m, d] = state.fecha.split('-').map(Number);
        const fecha = new Date(y, m - 1, d);
        const diaKey = DIAS_SEMANA_KEY[fecha.getDay()];

        // Domingo: bloqueado siempre
        if (diaKey === DIA_DOMINGO_KEY) {
            container.className = 'flex flex-col items-center justify-center py-8 gap-3';
            container.innerHTML = `
                <div class="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                    <span class="material-symbols-outlined text-amber-400 text-3xl" style="font-variation-settings: 'FILL' 1" aria-hidden="true">store</span>
                </div>
                <div class="text-center">
                    <p class="text-amber-400 text-sm font-bold">${MSG_DOMINGO}</p>
                    <p class="text-white/50 text-xs mt-1">No se agendan reservas los domingos</p>
                </div>
            `;
            return;
        }

        const horarioDia = state.barbero.horario?.[diaKey];
        const todosSlots = generarSlotsDelDia(horarioDia, DURACION_SLOT_MIN);

        // Filtrar: ocultamos "muy pronto" y "ocupados" — solo mostramos los disponibles
        const slotsDisponibles = todosSlots.filter(h => {
            if (slotEstaOcupado(h)) return false;
            if (!slotCumpleAnticipacion(state.fecha, h)) return false;
            return true;
        });

        if (slotsDisponibles.length === 0) {
            container.className = 'flex flex-col items-center justify-center py-8 gap-3';
            const mensaje = todosSlots.length === 0
                ? 'El barbero no trabaja este día'
                : 'No hay disponibilidad para este día';
            const subMensaje = todosSlots.length === 0
                ? 'Probá otro día del calendario'
                : 'Todos los horarios están reservados o son muy pronto. Elegí otro día.';
            container.innerHTML = `
                <div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center">
                    <span class="material-symbols-outlined text-white/50 text-3xl" aria-hidden="true">event_busy</span>
                </div>
                <div class="text-center max-w-xs">
                    <p class="text-white/85 text-sm font-bold">${mensaje}</p>
                    <p class="text-white/50 text-xs mt-1">${subMensaje}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = slotsDisponibles.map(h => {
            const isSelected = state.hora === h;
            const classes = isSelected
                ? 'tap-card relative py-3 rounded-xl bg-gradient-to-br from-primary to-primary-light text-black text-sm font-black border-2 border-primary shadow-[0_4px_20px_rgba(201,167,74,0.45)] transition-all'
                : 'tap-card py-3 rounded-xl bg-background-dark/80 text-white text-sm font-semibold border-2 border-white/10 hover:border-primary/40 hover:bg-surface-dark transition-all';
            const ariaLabel = isSelected ? `${h} (seleccionado)` : `Horario ${h}`;
            return `<button data-hora="${h}" aria-label="${ariaLabel}" aria-pressed="${isSelected}" class="${classes}">${h}</button>`;
        }).join('');

        container.querySelectorAll('[data-hora]').forEach(btn => {
            btn.addEventListener('click', () => selectHora(btn.dataset.hora));
        });
    }

    /**
     * Conecta las flechas izquierda/derecha (visibles solo en desktop)
     * al scroll del contenedor de fechas. Actualiza el estado
     * enabled/disabled según la posición del scroll.
     */
    function updateFechasArrows() {
        const scroller = document.getElementById('booking-fechas');
        const prev = document.getElementById('booking-fechas-prev');
        const next = document.getElementById('booking-fechas-next');
        if (!scroller || !prev || !next) return;

        const refreshDisabled = () => {
            const atStart = scroller.scrollLeft <= 4;
            const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 4;
            prev.disabled = atStart;
            next.disabled = atEnd;
        };

        // Conectar una sola vez (idempotente usando dataset.wired)
        if (!prev.dataset.wired) {
            prev.addEventListener('click', () => {
                scroller.scrollBy({ left: -scroller.clientWidth * 0.8, behavior: 'smooth' });
            });
            prev.dataset.wired = 'true';
        }
        if (!next.dataset.wired) {
            next.addEventListener('click', () => {
                scroller.scrollBy({ left: scroller.clientWidth * 0.8, behavior: 'smooth' });
            });
            next.dataset.wired = 'true';
        }
        if (!scroller.dataset.wiredScroll) {
            scroller.addEventListener('scroll', refreshDisabled, { passive: true });
            scroller.dataset.wiredScroll = 'true';
        }
        // Pequeño delay para que el DOM tenga scrollWidth final
        requestAnimationFrame(refreshDisabled);
    }

    async function selectFecha(iso) {
        state.fecha = iso;
        state.hora = null;
        await refreshOccupiedSlots();
        renderFechas();
        renderHorarios();
        renderFooter();
    }

    function selectHora(h) {
        state.hora = h;
        renderHorarios();
        renderFooter();
    }

    // ==========================================================
    // RENDER: PROGRESS STEPPER (1-2-3-4)
    // ==========================================================

    function renderProgress() {
        const stepsEls = [1, 2, 3, 4].map(n => document.getElementById(`booking-step-${n}`));
        const linesEls = [1, 2, 3].map(i => document.getElementById(`booking-line-${i}`));
        if (stepsEls.some(el => !el)) return;

        stepsEls.forEach((el, idx) => {
            const n = idx + 1;
            el.classList.remove('done', 'current');
            if (n < state.step) {
                el.classList.add('done');
                el.innerHTML = '<span class="material-symbols-outlined text-sm" style="font-variation-settings: \'FILL\' 1" aria-hidden="true">check</span>';
            } else if (n === state.step) {
                el.classList.add('current');
                el.textContent = String(n);
            } else {
                el.textContent = String(n);
            }
        });

        linesEls.forEach((el, idx) => {
            if (!el) return;
            const pos = idx + 1;
            if (pos < state.step) el.classList.add('filled');
            else el.classList.remove('filled');
        });
    }

    // ==========================================================
    // FOOTER: total + botones Atrás/Siguiente
    // ==========================================================

    function renderFooter() {
        const totalEl = document.getElementById('booking-total');
        const backBtn = document.getElementById('booking-back-btn');
        const nextBtn = document.getElementById('booking-next-btn');
        const tagsEl = document.getElementById('booking-tags-resumen');
        const fechaEl = document.getElementById('booking-fecha-resumen');

        const total = calcularTotal();
        if (totalEl) {
            animateCountUp(totalEl, lastTotal, total);
            lastTotal = total;
        }

        // Tags del resumen
        if (tagsEl) {
            const tags = [];
            if (state.barbero) tags.push(`<span class="px-2 py-1 bg-primary/20 border border-primary/30 rounded-md"><span class="text-primary text-[10px] font-black uppercase tracking-wide truncate">${state.barbero.nombre}</span></span>`);
            if (state.conCorte === true) tags.push(`<span class="px-2 py-1 bg-white/5 border border-white/10 rounded-md"><span class="text-white/85 text-[10px] font-bold">Corte</span></span>`);
            if (state.adicionales.length > 0) tags.push(`<span class="px-2 py-1 bg-white/5 border border-white/10 rounded-md"><span class="text-white/85 text-[10px] font-bold">+${state.adicionales.length} ${state.adicionales.length === 1 ? 'extra' : 'extras'}</span></span>`);
            tagsEl.innerHTML = tags.join('');
        }

        if (fechaEl) {
            if (state.fecha && state.hora) {
                const [y, m, d] = state.fecha.split('-');
                const fecha = new Date(Number(y), Number(m) - 1, Number(d));
                const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                fechaEl.innerHTML = `
                    <span class="material-symbols-outlined text-xs" aria-hidden="true">event</span>
                    <span class="text-xs font-semibold">${fecha.getDate()} ${meses[fecha.getMonth()]} · ${state.hora}</span>
                `;
            } else {
                fechaEl.innerHTML = '';
            }
        }

        // Subtítulo del header
        const subtitle = document.getElementById('booking-step-subtitle');
        if (subtitle) {
            const subs = {
                1: 'Paso 1 de 4 · Elegí tu barbero',
                2: 'Paso 2 de 4 · ¿Corte o solo adicionales?',
                3: 'Paso 3 de 4 · Agregá extras (opcional)',
                4: 'Paso 4 de 4 · Fecha y hora'
            };
            subtitle.textContent = subs[state.step] || '';
        }

        // Back button
        if (backBtn) {
            if (state.step > 1) backBtn.classList.remove('hidden');
            else backBtn.classList.add('hidden');
        }

        // Next button: label + enabled
        if (nextBtn) {
            let label = 'Siguiente';
            let icon = 'arrow_forward';
            let enabled = false;

            if (state.step === 1) {
                enabled = !!state.barbero;
            } else if (state.step === 2) {
                enabled = state.conCorte !== null;
            } else if (state.step === 3) {
                // Si eligió "solo adicionales" exigimos al menos 1
                enabled = state.conCorte === true || state.adicionales.length > 0;
            } else if (state.step === 4) {
                label = 'Confirmar Reserva';
                icon = 'check_circle';
                enabled = !!(state.fecha && state.hora) && (state.conCorte === true || state.adicionales.length > 0);
            }

            nextBtn.disabled = !enabled;
            const labelEl = nextBtn.querySelector('.btn-label');
            const iconEl = nextBtn.querySelector('.btn-icon');
            if (labelEl) labelEl.textContent = label;
            if (iconEl) iconEl.textContent = icon;

            // Glow pulse cuando está habilitado
            if (enabled) nextBtn.classList.add('booking-next-ready');
            else nextBtn.classList.remove('booking-next-ready');
        }
    }

    // ==========================================================
    // NAVEGACIÓN ENTRE PASOS
    // ==========================================================

    async function goToStep(n) {
        if (n < 1 || n > 4) return;

        // Validación de pre-requisitos (por si alguien intenta saltar)
        if (n >= 2 && !state.barbero) return;
        if (n >= 3 && state.conCorte === null) return;
        if (n >= 4 && state.conCorte !== true && state.adicionales.length === 0) return;

        state.step = n;

        // Mostrar solo el contenido del paso actual
        [1, 2, 3, 4].forEach(i => {
            const el = document.getElementById(`booking-step-${i}-content`);
            if (!el) return;
            if (i === n) {
                el.classList.remove('hidden');
                el.classList.add('fade-in-soft');
            } else {
                el.classList.add('hidden');
                el.classList.remove('fade-in-soft');
            }
        });

        // Renderizar contenido del paso
        if (n === 1) await renderBarberosStep();
        else if (n === 2) renderCorteStep();
        else if (n === 3) renderAdicionalesStep();
        else if (n === 4) {
            await refreshOccupiedSlots();
            renderFechas();
            renderHorarios();
        }

        renderProgress();
        renderFooter();

        // Scroll al tope del contenido del tab
        const scrollable = document.querySelector('#booking-tab > div.flex-1') || document.querySelector('#booking-tab .overflow-y-auto');
        if (scrollable) scrollable.scrollTop = 0;
    }

    function nextStep() {
        if (state.step < 4) {
            goToStep(state.step + 1);
        } else {
            confirmarReserva();
        }
    }

    function prevStep() {
        if (state.step > 1) {
            goToStep(state.step - 1);
        }
    }

    // ==========================================================
    // CONFIRMAR RESERVA
    // ==========================================================

    function pedirTelefono() {
        return new Promise((resolve) => {
            const existing = document.getElementById('phone-capture-overlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'phone-capture-overlay';
            overlay.className = 'fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]';
            overlay.innerHTML = `
                <div class="w-full max-w-md bg-gradient-to-br from-surface-dark to-card-dark border border-primary/30 rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1" aria-hidden="true">phone_iphone</span>
                        </div>
                        <div>
                            <h3 class="text-white font-black text-lg">Tu WhatsApp</h3>
                            <p class="text-white/60 text-xs">Para confirmarte tu cita</p>
                        </div>
                    </div>

                    <p class="text-white/75 text-sm mb-4 leading-relaxed">
                        Déjanos tu número para poder confirmarte tu reserva vía WhatsApp. Solo lo pediremos esta vez.
                    </p>

                    <input id="phone-input" type="tel" inputmode="tel" placeholder="+57 300 123 4567" aria-label="Tu número de WhatsApp"
                        class="w-full px-4 py-3 rounded-xl bg-black/40 border-2 border-white/10 text-white placeholder-white/30 focus:border-primary/50 focus:outline-none text-base font-semibold" />

                    <div class="flex gap-2 mt-5">
                        <button id="phone-cancel" aria-label="Cancelar"
                            class="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white/65 text-sm font-bold hover:bg-white/10 transition-all active:scale-95">
                            Cancelar
                        </button>
                        <button id="phone-save" aria-label="Guardar y reservar"
                            class="flex-[2] py-3 rounded-xl bg-gradient-to-r from-primary to-primary-light text-black text-sm font-black uppercase tracking-wide shadow-[0_4px_15px_rgba(201,167,74,0.35)] active:scale-95 transition-all">
                            Guardar y reservar
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const input = overlay.querySelector('#phone-input');
            setTimeout(() => input && input.focus(), 100);

            overlay.querySelector('#phone-cancel').addEventListener('click', () => {
                overlay.remove();
                resolve(null);
            });
            overlay.querySelector('#phone-save').addEventListener('click', () => {
                const phone = input.value.trim();
                if (!phone || phone.replace(/\D/g, '').length < 7) {
                    input.classList.add('border-red-500/60');
                    input.focus();
                    return;
                }
                overlay.remove();
                resolve(phone);
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') overlay.querySelector('#phone-save').click();
            });
        });
    }

    async function confirmarReserva() {
        if (!state.barbero || !state.fecha || !state.hora) return;
        if (state.conCorte !== true && state.adicionales.length === 0) return;

        const user = roleManager && roleManager.currentUser;
        if (!user) {
            alert('Necesitas iniciar sesión para reservar.');
            return;
        }

        // Teléfono (se pide solo la primera vez)
        let phone = user.phone || null;
        if (!phone) {
            phone = await pedirTelefono();
            if (!phone) return;
            const ok = await firebaseAdapter.updateUserPhone(user.uid, phone);
            if (ok) user.phone = phone;
        }

        const nextBtn = document.getElementById('booking-next-btn');
        const labelEl = nextBtn?.querySelector('.btn-label');
        const iconEl = nextBtn?.querySelector('.btn-icon');
        if (nextBtn) {
            nextBtn.disabled = true;
            if (labelEl) labelEl.textContent = 'Reservando…';
            if (iconEl) iconEl.textContent = 'hourglass_top';
        }

        // Resumen textual (retrocompat con schema viejo)
        const partes = [];
        if (state.conCorte === true) partes.push('Corte');
        state.adicionales.forEach(a => partes.push(a.nombre));
        const servicioNombre = partes.join(' + ') || 'Servicio';
        const total = calcularTotal();

        const citaId = await CitasService.create({
            clienteId: user.uid,
            clienteNombre: user.displayName || 'Cliente',
            clientePhotoURL: user.photoURL || null,
            clientePhone: phone,

            barberoId: state.barbero.id,
            barberoNombre: state.barbero.nombre,

            // Schema nuevo (datos ricos)
            conCorte: state.conCorte === true,
            cortePrecio: state.conCorte === true ? (state.barbero.corte?.precio || 0) : 0,
            corteServicios: state.conCorte === true ? (state.barbero.corte?.servicios || []) : [],
            adicionales: state.adicionales,
            total,

            // Compatibilidad con schema viejo (admin/barbero/profile lo leen)
            servicioNombre,
            servicioPrecio: total,

            fecha: state.fecha,
            hora: state.hora
        });

        if (citaId) {
            if (typeof window.showToast === 'function') {
                window.showToast('¡Reserva enviada! El admin la confirmará pronto.', 'success');
            } else {
                alert('¡Reserva enviada! El admin la confirmará pronto.');
            }
            resetState();
            switchTab('profile');
        } else {
            alert('No se pudo crear la reserva. Intenta de nuevo.');
            if (nextBtn) {
                nextBtn.disabled = false;
                if (labelEl) labelEl.textContent = 'Confirmar Reserva';
                if (iconEl) iconEl.textContent = 'check_circle';
            }
        }
    }

    function resetState() {
        state.step = 1;
        state.barbero = null;
        state.conCorte = null;
        state.adicionales = [];
        state.fecha = null;
        state.hora = null;
        lastTotal = 0;
        occupiedSlots = [];
    }

    // ==========================================================
    // BLOQUEO SI YA HAY CITA ACTIVA
    // ==========================================================

    function renderBloqueoCitaActiva() {
        const main = document.querySelector('#booking-tab');
        if (!main) return;

        const mainContent = main.querySelector('.flex-1');
        const footer = main.querySelector('.fixed.bottom-\\[85px\\]');

        // Marcamos el partial como NO cargado para que screen-loader lo
        // re-inyecte la próxima vez (tras cancelar o completar la cita).
        if (main.dataset) main.dataset.loaded = 'false';

        if (mainContent) {
            mainContent.innerHTML = `
                <div class="px-6 pt-12 pb-32">
                    <div class="flex items-center gap-4 mb-8">
                        <button onclick="switchTab('home')" aria-label="Volver al inicio"
                            class="p-3 rounded-2xl border border-white/10 bg-surface-dark/80 backdrop-blur-sm flex items-center justify-center text-white hover:text-primary hover:border-primary/30 transition-all active:scale-95">
                            <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                        </button>
                        <h2 class="text-2xl font-black text-white tracking-tight">Agendar Cita</h2>
                    </div>

                    <div class="flex flex-col items-center gap-4 p-8 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/8 to-transparent border border-primary/30">
                        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/40 flex items-center justify-center text-primary shadow-lg">
                            <span class="material-symbols-outlined text-[32px]" style="font-variation-settings: 'FILL' 1" aria-hidden="true">event_available</span>
                        </div>
                        <div class="text-center">
                            <h3 class="text-white font-black text-xl mb-2">Ya tienes una cita activa</h3>
                            <p class="text-white/70 text-sm leading-relaxed max-w-xs mx-auto">
                                Completa o cancela tu reserva actual antes de agendar otra. Solo permitimos una cita a la vez por cliente.
                            </p>
                        </div>
                        <button onclick="switchTab('profile')" aria-label="Ver mi cita en el perfil"
                            class="mt-2 flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-light text-black font-black text-sm uppercase tracking-wide shadow-[0_4px_15px_rgba(201,167,74,0.35)] active:scale-95 transition-all">
                            <span>Ver mi cita</span>
                            <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1" aria-hidden="true">arrow_forward</span>
                        </button>
                    </div>
                </div>
            `;
        }
        if (footer) footer.style.display = 'none';
    }

    // ==========================================================
    // INICIALIZACIÓN
    // ==========================================================

    async function initBooking() {
        resetState();
        cachedBarberos = null;

        // Bloqueo: solo 1 cita activa por cliente
        const user = roleManager && roleManager.currentUser;
        if (user && user.uid) {
            const tieneActiva = await CitasService.hasActiveBooking(user.uid);
            if (tieneActiva) {
                renderBloqueoCitaActiva();
                return;
            }
        }

        // Asegurar footer visible (por si venimos de un reload con bloqueo previo)
        const footer = document.querySelector('#booking-tab .fixed.bottom-\\[85px\\]');
        if (footer) footer.style.display = '';

        // Conectar botones del footer (idempotente)
        const backBtn = document.getElementById('booking-back-btn');
        const nextBtn = document.getElementById('booking-next-btn');
        if (backBtn && !backBtn.dataset.wired) {
            backBtn.addEventListener('click', prevStep);
            backBtn.dataset.wired = 'true';
        }
        if (nextBtn && !nextBtn.dataset.wired) {
            nextBtn.addEventListener('click', nextStep);
            nextBtn.dataset.wired = 'true';
        }

        // Preselección desde home (solo barbero; el servicio legacy se ignora)
        if (pendingPreselection.barbero) {
            try {
                cachedBarberos = await BarbersService.list();
                const targetId = pendingPreselection.barbero.id;
                const full = cachedBarberos.find(b =>
                    (b.userId && b.userId === targetId) || b.id === targetId
                );
                pendingPreselection.barbero = null;
                pendingPreselection.servicio = null;
                if (full) {
                    selectBarbero(full);
                    await goToStep(2);
                    return;
                }
            } catch (error) {
                console.error('❌ Error aplicando preselección:', error);
                pendingPreselection.barbero = null;
            }
        }
        pendingPreselection.servicio = null;

        await goToStep(1);
    }

    /**
     * Llamado desde home-ui (secciones de servicios y barberos) antes de
     * switchTab('booking'). Guarda la selección para que initBooking la
     * aplique cuando se abra el tab. El servicio legacy se ignora porque
     * el flujo nuevo no tiene catálogo estático.
     */
    function preselectBooking({ servicio = null, barbero = null } = {}) {
        if (servicio) pendingPreselection.servicio = servicio;
        if (barbero) pendingPreselection.barbero = barbero;
    }

    window.initBooking = initBooking;
    window.confirmarReserva = confirmarReserva;
    window.preselectBooking = preselectBooking;
    console.log('✓ BookingUI loaded (wizard 4 pasos)');
})();
