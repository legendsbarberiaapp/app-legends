/**
 * LEGENDS BARBERIA - BOOKING UI (CLIENTE)
 * Reserva de cita en 3 pasos: servicio, barbero, fecha/hora.
 * Al confirmar crea un documento en la colección `citas` vía CitasService.
 *
 * TODO: los servicios principales están hardcodeados aquí. Cuando agreguemos
 * un catálogo admin de servicios con precio/duración, mover esta lista a Firestore.
 */

(function () {
    'use strict';

    // =====================================================
    // CATÁLOGO DE SERVICIOS (temporal, hasta mover a admin)
    // =====================================================
    const SERVICIOS = [
        { id: 'corte-clasico', nombre: 'Corte Clásico', precio: 40 },
        { id: 'corte-barba', nombre: 'Corte + Barba', precio: 60 },
        { id: 'afeitado', nombre: 'Afeitado Premium', precio: 35 },
        { id: 'degradado', nombre: 'Degradado', precio: 45 }
    ];

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

    // =====================================================
    // RENDERERS
    // =====================================================

    function renderServicios() {
        const container = document.getElementById('booking-servicios');
        if (!container) return;

        container.innerHTML = SERVICIOS.map(s => {
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

        container.innerHTML = HORARIOS.map(h => {
            const isSelected = state.hora === h;
            const classes = isSelected
                ? 'relative py-3 rounded-xl bg-gradient-to-br from-primary to-primary-light text-black text-sm font-black border-2 border-primary shadow-[0_4px_20px_rgba(201,167,74,0.4)] transition-all active:scale-95'
                : 'py-3 rounded-xl bg-background-dark/80 text-white text-sm font-semibold border-2 border-white/10 hover:border-primary/40 hover:bg-surface-dark transition-all active:scale-95';
            return `<button data-hora="${h}" class="${classes}">${h}</button>`;
        }).join('');

        container.querySelectorAll('[data-hora]').forEach(btn => {
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
        state.servicio = SERVICIOS.find(s => s.id === id) || null;
        renderServicios();
        renderResumen();
    }

    function selectBarbero(id, barberos) {
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
        renderBarberos();
        renderResumen();
    }

    function selectFecha(iso) {
        state.fecha = iso;
        renderFechas();
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

    async function confirmarReserva() {
        if (!state.servicio || !state.barbero || !state.fecha || !state.hora) return;

        const user = roleManager && roleManager.currentUser;
        if (!user) {
            alert('Necesitas iniciar sesión para reservar.');
            return;
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

    async function initBooking() {
        resetState();
        renderServicios();
        renderFechas();
        renderHorarios();
        renderResumen();
        await renderBarberos();
    }

    window.initBooking = initBooking;
    window.confirmarReserva = confirmarReserva;
    console.log('✓ BookingUI loaded');
})();
