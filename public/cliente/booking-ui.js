/**
 * LEGENDS BARBERIA - BOOKING UI (CLIENTE)
 * Reserva de cita en 3 pasos: servicio, barbero, fecha/hora.
 * Al confirmar crea un documento en la colección `citas` vía CitasService.
 * Los servicios los lee de window.SERVICIOS_CATALOG (servicios-catalog.js).
 */

(function () {
    'use strict';

    // Fuente única: public/cliente/servicios-catalog.js
    function getServicios() {
        return window.SERVICIOS_CATALOG || [];
    }

    const HORARIOS = [
        '09:00', '09:45', '10:30', '11:15',
        '12:00', '13:30', '14:15', '15:00',
        '15:45', '16:30', '17:15', '18:00'
    ];

    // =====================================================
    // ESTADO DE LA RESERVA
    // =====================================================
    const state = {
        servicio: null,   // { id, nombre, precio }
        barbero: null,    // { id, nombre, photoURL }
        fecha: null,      // "YYYY-MM-DD"
        hora: null        // "HH:mm"
    };

    // Permite que otros tabs (barbers, services) preseleccionen algo
    // ANTES de cambiar al tab booking. initBooking lo recoge y lo aplica.
    const pendingPreselection = {
        servicio: null,
        barbero: null
    };

    // Cache de slots ocupados para el par {barbero, fecha} actual.
    // Se refresca cuando cambia barbero o fecha.
    let occupiedSlots = [];

    // Mínimo 6 horas de anticipación para reservar
    const MIN_HORAS_ANTICIPACION = 6;

    // =====================================================
    // VALIDACIÓN DE SLOTS
    // =====================================================

    /**
     * Si la fecha+hora del slot está dentro de las próximas 6 horas,
     * NO se permite reservar (regla del negocio).
     */
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

    // =====================================================
    // RENDERERS
    // =====================================================

    function renderServicios() {
        const container = document.getElementById('booking-servicios');
        if (!container) return;

        container.innerHTML = getServicios().map(s => {
            const isSelected = state.servicio && state.servicio.id === s.id;
            const base = 'flex-shrink-0 px-7 py-4 rounded-2xl text-sm transition-all active:scale-95';
            const classes = isSelected
                ? `${base} bg-gradient-to-br from-primary to-primary-light text-black font-black shadow-[0_4px_20px_rgba(201,167,74,0.3)]`
                : `${base} bg-surface-card border-2 border-white/10 text-white font-semibold hover:border-primary/50 hover:bg-surface-dark`;
            return `
                <button data-servicio-id="${s.id}" class="${classes}">
                    <div class="flex flex-col items-start gap-0.5">
                        <span>${s.nombre}</span>
                        <span class="text-[11px] ${isSelected ? 'text-black/70' : 'text-primary'} font-bold">$${s.precio}</span>
                    </div>
                </button>
            `;
        }).join('');

        container.querySelectorAll('[data-servicio-id]').forEach(btn => {
            btn.addEventListener('click', () => selectServicio(btn.dataset.servicioId));
        });
    }

    async function renderBarberos() {
        const container = document.getElementById('booking-barberos');
        if (!container) return;

        container.innerHTML = `<p class="text-white/40 text-xs px-2">Cargando barberos…</p>`;

        const barberos = await BarbersService.list();

        if (barberos.length === 0) {
            container.innerHTML = `<p class="text-white/40 text-xs px-2">Aún no hay barberos disponibles.</p>`;
            return;
        }

        container.innerHTML = barberos.map(b => {
            const isSelected = state.barbero && state.barbero.id === b.id;
            const foto = b.photoURL || b.foto
                || `https://ui-avatars.com/api/?name=${encodeURIComponent(b.nombre || b.displayName || 'Barbero')}&background=c9a74a&color=000`;
            const nombre = b.nombre || b.displayName || 'Barbero';

            const wrapClass = isSelected
                ? 'relative flex-shrink-0 flex flex-col items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/50 shadow-[0_4px_20px_rgba(201,167,74,0.2)] transition-all active:scale-95'
                : 'flex-shrink-0 flex flex-col items-center gap-3 p-4 rounded-2xl bg-surface-card border-2 border-white/10 hover:border-primary/30 transition-all active:scale-95';

            const imgClass = isSelected
                ? 'relative w-20 h-20 rounded-full overflow-hidden ring-4 ring-primary shadow-xl'
                : 'w-20 h-20 rounded-full overflow-hidden border-2 border-white/20';

            return `
                <button data-barbero-id="${b.id}" class="${wrapClass}">
                    <div class="relative">
                        ${isSelected ? '<div class="absolute -inset-1 bg-primary/30 rounded-full blur-md"></div>' : ''}
                        <div class="${imgClass}">
                            <img src="${foto}" alt="${nombre}" class="w-full h-full object-cover">
                        </div>
                    </div>
                    <div class="text-center">
                        <span class="text-sm ${isSelected ? 'font-black text-white' : 'font-semibold text-white/70'} block">${nombre}</span>
                    </div>
                </button>
            `;
        }).join('');

        container.querySelectorAll('[data-barbero-id]').forEach(btn => {
            btn.addEventListener('click', () => selectBarbero(btn.dataset.barberoId, barberos));
        });
    }

    function renderFechas() {
        const container = document.getElementById('booking-fechas');
        if (!container) return;

        const dias = [];
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const diasSemanaCorto = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

        for (let i = 0; i < 14; i++) {
            const d = new Date(hoy);
            d.setDate(hoy.getDate() + i);
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            dias.push({
                iso,
                dia: d.getDate(),
                nombreCorto: diasSemanaCorto[d.getDay()],
                esHoy: i === 0
            });
        }

        container.innerHTML = dias.map(d => {
            const isSelected = state.fecha === d.iso;
            const classes = isSelected
                ? 'flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-xl bg-gradient-to-br from-primary to-primary-light text-black font-black shadow-[0_0_15px_rgba(201,167,74,0.4)] transition-all active:scale-95'
                : 'flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-xl bg-background-dark/80 border-2 border-white/10 text-white hover:border-primary/40 transition-all active:scale-95';
            return `
                <button data-fecha="${d.iso}" class="${classes}">
                    <span class="text-[10px] font-bold uppercase ${isSelected ? 'text-black/70' : 'text-white/60'}">${d.nombreCorto}</span>
                    <span class="text-lg font-black">${d.dia}</span>
                    ${d.esHoy ? `<span class="text-[9px] font-bold ${isSelected ? 'text-black/60' : 'text-primary'}">HOY</span>` : ''}
                </button>
            `;
        }).join('');

        container.querySelectorAll('[data-fecha]').forEach(btn => {
            btn.addEventListener('click', () => selectFecha(btn.dataset.fecha));
        });
    }

    function renderHorarios() {
        const container = document.getElementById('booking-horarios');
        if (!container) return;

        const necesitaSeleccion = !state.barbero || !state.fecha;

        container.innerHTML = HORARIOS.map(h => {
            const isSelected = state.hora === h;
            const ocupado = slotEstaOcupado(h);
            const muyPronto = state.fecha && !slotCumpleAnticipacion(state.fecha, h);
            const disabled = ocupado || muyPronto || necesitaSeleccion;

            let label = h;
            let classes;

            if (isSelected) {
                classes = 'relative py-3 rounded-xl bg-gradient-to-br from-primary to-primary-light text-black text-sm font-black border-2 border-primary shadow-[0_4px_20px_rgba(201,167,74,0.4)] transition-all active:scale-95';
            } else if (ocupado) {
                classes = 'relative py-3 rounded-xl bg-red-500/5 text-red-400/50 text-sm font-medium border-2 border-red-500/15 cursor-not-allowed';
                label = `<span class="line-through">${h}</span><br><span class="text-[9px] font-black uppercase tracking-wider">Ocupado</span>`;
            } else if (muyPronto) {
                classes = 'relative py-3 rounded-xl bg-white/[0.02] text-white/25 text-sm font-medium border-2 border-white/5 cursor-not-allowed';
                label = `<span>${h}</span><br><span class="text-[9px] font-bold uppercase tracking-wider">Muy pronto</span>`;
            } else if (necesitaSeleccion) {
                classes = 'relative py-3 rounded-xl bg-white/[0.02] text-white/40 text-sm font-semibold border-2 border-white/5 cursor-not-allowed';
            } else {
                classes = 'py-3 rounded-xl bg-background-dark/80 text-white text-sm font-semibold border-2 border-white/10 hover:border-primary/40 hover:bg-surface-dark transition-all active:scale-95';
            }

            return `<button data-hora="${h}" class="${classes}" ${disabled ? 'disabled' : ''}>${label}</button>`;
        }).join('');

        container.querySelectorAll('[data-hora]:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => selectHora(btn.dataset.hora));
        });
    }

    function renderResumen() {
        const total = document.getElementById('booking-total');
        const fechaResumen = document.getElementById('booking-fecha-resumen');
        const tagsResumen = document.getElementById('booking-tags-resumen');

        if (total) {
            total.innerHTML = state.servicio
                ? `$${state.servicio.precio}<span class="text-lg font-medium">.00</span>`
                : `$0`;
        }

        if (fechaResumen) {
            if (state.fecha && state.hora) {
                const [y, m, d] = state.fecha.split('-');
                const fecha = new Date(Number(y), Number(m) - 1, Number(d));
                const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                fechaResumen.innerHTML = `
                    <span class="material-symbols-outlined text-xs">event</span>
                    <span class="text-xs font-semibold">${fecha.getDate()} ${meses[fecha.getMonth()]} • ${state.hora}</span>
                `;
            } else {
                fechaResumen.innerHTML = `
                    <span class="material-symbols-outlined text-xs">event</span>
                    <span class="text-xs font-semibold">— —</span>
                `;
            }
        }

        if (tagsResumen) {
            const tags = [];
            if (state.servicio) tags.push(`<span class="px-2 py-1 bg-primary/20 border border-primary/30 rounded-md"><span class="text-primary text-[10px] font-black uppercase tracking-wide">${state.servicio.nombre}</span></span>`);
            if (state.barbero) tags.push(`<span class="px-2 py-1 bg-white/5 border border-white/10 rounded-md"><span class="text-white/80 text-[10px] font-bold">${state.barbero.nombre}</span></span>`);
            tagsResumen.innerHTML = tags.join('');
        }

        const btn = document.getElementById('booking-confirm-btn');
        if (btn) btn.disabled = !(state.servicio && state.barbero && state.fecha && state.hora);
    }

    // =====================================================
    // ACCIONES DE SELECCIÓN
    // =====================================================

    function selectServicio(id) {
        state.servicio = getServicios().find(s => s.id === id) || null;
        renderServicios();
        renderResumen();
    }

    async function selectBarbero(id, barberos) {
        const b = barberos.find(x => x.id === id);
        if (!b) return;
        state.barbero = {
            // Usamos userId del barbero (su UID de Firebase Auth) como identificador
            // de la cita. Esto alinea con las reglas de Firestore y permite al
            // barbero consultar sus propias citas con su UID.
            id: b.userId || b.id,
            nombre: b.nombre || b.displayName || 'Barbero',
            photoURL: b.photoURL || b.foto || null
        };
        state.hora = null; // la hora anterior puede estar ocupada por el nuevo barbero
        renderBarberos();
        await refreshOccupiedSlots();
        renderHorarios();
        renderResumen();
    }

    async function selectFecha(iso) {
        state.fecha = iso;
        state.hora = null; // la hora anterior puede no cumplir 6h o estar ocupada
        renderFechas();
        await refreshOccupiedSlots();
        renderHorarios();
        renderResumen();
    }

    function selectHora(h) {
        state.hora = h;
        renderHorarios();
        renderResumen();
    }

    // =====================================================
    // CONFIRMAR RESERVA
    // =====================================================

    /**
     * Modal para capturar el teléfono del cliente la primera vez que reserva.
     * Devuelve el teléfono (string) o null si el usuario cierra sin guardar.
     */
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
                            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1">phone_iphone</span>
                        </div>
                        <div>
                            <h3 class="text-white font-black text-lg">Tu WhatsApp</h3>
                            <p class="text-white/50 text-xs">Para confirmarte tu cita</p>
                        </div>
                    </div>

                    <p class="text-white/70 text-sm mb-4 leading-relaxed">
                        Déjanos tu número para poder confirmarte tu reserva vía WhatsApp. Solo lo pediremos esta vez.
                    </p>

                    <input id="phone-input" type="tel" inputmode="tel" placeholder="+57 300 123 4567"
                        class="w-full px-4 py-3 rounded-xl bg-black/40 border-2 border-white/10 text-white placeholder-white/30 focus:border-primary/50 focus:outline-none text-base font-semibold" />

                    <div class="flex gap-2 mt-5">
                        <button id="phone-cancel"
                            class="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm font-bold hover:bg-white/10 transition-all active:scale-95">
                            Cancelar
                        </button>
                        <button id="phone-save"
                            class="flex-[2] py-3 rounded-xl bg-gradient-to-r from-primary to-primary-light text-black text-sm font-black uppercase tracking-wide shadow-[0_4px_15px_rgba(201,167,74,0.3)] active:scale-95 transition-all">
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
        if (!state.servicio || !state.barbero || !state.fecha || !state.hora) return;

        const user = roleManager && roleManager.currentUser;
        if (!user) {
            alert('Necesitas iniciar sesión para reservar.');
            return;
        }

        // Asegurar que tenemos teléfono — lo pedimos la primera vez y lo guardamos en su perfil
        let phone = user.phone || null;
        if (!phone) {
            phone = await pedirTelefono();
            if (!phone) return; // canceló
            const ok = await firebaseAdapter.updateUserPhone(user.uid, phone);
            if (ok) user.phone = phone; // actualiza cache local del roleManager
        }

        const btn = document.getElementById('booking-confirm-btn');
        if (btn) {
            btn.disabled = true;
            btn.querySelector('span').textContent = 'Reservando…';
        }

        const citaId = await CitasService.create({
            clienteId: user.uid,
            clienteNombre: user.displayName || 'Cliente',
            clientePhotoURL: user.photoURL || null,
            clientePhone: phone,

            barberoId: state.barbero.id,
            barberoNombre: state.barbero.nombre,

            servicioNombre: state.servicio.nombre,
            servicioPrecio: state.servicio.precio,

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
            if (btn) {
                btn.disabled = false;
                btn.querySelector('span').textContent = 'Confirmar Reserva';
            }
        }
    }

    function resetState() {
        state.servicio = null;
        state.barbero = null;
        state.fecha = null;
        state.hora = null;
    }

    // =====================================================
    // INICIALIZACIÓN (la llama switchTab cuando abres 'booking')
    // =====================================================

    /**
     * Reemplaza el formulario con un mensaje cuando el cliente ya tiene
     * una cita activa. Solo se permite una reserva viva a la vez.
     */
    function renderBloqueoCitaActiva() {
        // Buscamos los contenedores principales del partial y vaciamos
        const main = document.querySelector('#booking-tab');
        if (!main) return;

        const mainContent = main.querySelector('.flex-1');
        const footer = main.querySelector('.fixed.bottom-\\[85px\\]');

        // Marcar el partial como NO cargado para que screen-loader re-inyecte
        // el formulario original la próxima vez que el cliente abra booking
        // (tras cancelar o completar la cita activa).
        if (main.dataset) main.dataset.loaded = 'false';

        if (mainContent) {
            mainContent.innerHTML = `
                <div class="px-6 pt-12 pb-32">
                    <div class="flex items-center gap-4 mb-8">
                        <button onclick="switchTab('home')"
                            class="p-3 rounded-2xl border border-white/10 bg-surface-dark/80 backdrop-blur-sm flex items-center justify-center text-white hover:text-primary hover:border-primary/30 transition-all active:scale-95">
                            <span class="material-symbols-outlined">arrow_back</span>
                        </button>
                        <h2 class="text-2xl font-black text-white tracking-tight">Agendar Cita</h2>
                    </div>

                    <div class="flex flex-col items-center gap-4 p-8 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/8 to-transparent border border-primary/30">
                        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/40 flex items-center justify-center text-primary shadow-lg">
                            <span class="material-symbols-outlined text-[32px]" style="font-variation-settings: 'FILL' 1">event_available</span>
                        </div>
                        <div class="text-center">
                            <h3 class="text-white font-black text-xl mb-2">Ya tienes una cita activa</h3>
                            <p class="text-white/60 text-sm leading-relaxed max-w-xs mx-auto">
                                Completa o cancela tu reserva actual antes de agendar otra. Solo permitimos una cita a la vez por cliente.
                            </p>
                        </div>
                        <button onclick="switchTab('profile')"
                            class="mt-2 flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-light text-black font-black text-sm uppercase tracking-wide shadow-[0_4px_15px_rgba(201,167,74,0.3)] active:scale-95 transition-all">
                            <span>Ver mi cita</span>
                            <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1">arrow_forward</span>
                        </button>
                    </div>
                </div>
            `;
        }
        // Ocultamos el footer sticky porque no hay formulario
        if (footer) footer.style.display = 'none';
    }

    async function initBooking() {
        resetState();
        occupiedSlots = [];

        // Regla: solo una cita activa por cliente
        const user = roleManager && roleManager.currentUser;
        if (user && user.uid) {
            const tieneActiva = await CitasService.hasActiveBooking(user.uid);
            if (tieneActiva) {
                renderBloqueoCitaActiva();
                return;
            }
        }

        // Aplicar preselecciones si otro tab envió algo
        if (pendingPreselection.servicio) {
            state.servicio = pendingPreselection.servicio;
            pendingPreselection.servicio = null;
        }
        if (pendingPreselection.barbero) {
            state.barbero = pendingPreselection.barbero;
            pendingPreselection.barbero = null;
        }

        renderServicios();
        renderFechas();
        renderHorarios();
        renderResumen();
        await renderBarberos();

        // Si la preselección trajo barbero, ya podemos cargar ocupados al renderizar horarios
        if (state.barbero) {
            await refreshOccupiedSlots();
            renderHorarios();
        }
    }

    /**
     * Llamado desde barbers-ui / services-ui antes de switchTab('booking').
     * Guarda la selección para que initBooking la aplique cuando se abra el tab.
     */
    function preselectBooking({ servicio = null, barbero = null } = {}) {
        if (servicio) pendingPreselection.servicio = servicio;
        if (barbero) pendingPreselection.barbero = barbero;
    }

    window.initBooking = initBooking;
    window.confirmarReserva = confirmarReserva;
    window.preselectBooking = preselectBooking;
    console.log('✓ BookingUI loaded');
})();
