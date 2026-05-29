/**
 * LEGENDS BARBERIA - ADMIN: AGENDA
 *
 * Vista día-por-día de todas las citas (confirmadas, completadas, no-show,
 * canceladas). El admin navega entre días con flechas; sólo se detienen
 * en días que tengan al menos una cita.
 *
 * Rendimiento:
 * - 1 query al entrar: trae citas del rango [hoy-90d, hoy+90d].
 * - Navegar entre días: cero queries, todo en memoria.
 * - Botón "Recargar" arriba a la derecha para re-fetch manual.
 *
 * Secciones del día (en este orden):
 *   🟡 Próximas      — confirmadas cuya hora aún no llegó
 *   🔴 Requiere      — confirmadas donde pasaron ≥90min desde la hora
 *                       y todavía no fueron marcadas como completada/no-show
 *   🟠 En curso      — confirmadas cerca de la hora actual (±90min)
 *   🟢 Completadas
 *   ⚫ No llegó
 *   ❌ Canceladas
 */

(function () {
    'use strict';

    const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    const BUFFER_COMPLETADA_MIN = 90; // tras esos minutos desde la hora, se pregunta "¿se completó?"
    const BUFFER_EN_CURSO_MIN = 30;   // antes+despues de la hora se considera "en curso"

    // Estado en memoria
    let citasDelRango = [];          // dataset cacheado
    let citasPorFecha = new Map();   // "YYYY-MM-DD" -> array de citas de ese día
    let fechasConCitas = [];         // lista ordenada de fechas que tienen ≥1 cita
    let fechaActual = null;          // "YYYY-MM-DD" del día visible
    let barberosCache = [];          // cache de barberos (para teléfono/nivel). Se indexa por userId al buscar.
    let sedesCache = [];             // F1: cache de sedes para el filtro
    let sedeFilter = 'all';          // F1: 'all' | <sedeId>. Filtra in-memory las citas visibles.

    function findBarberoByCitaId(citaBarberoId) {
        // En una cita, `barberoId` es el userId (Auth UID) del barbero, no el docId.
        return barberosCache.find(b => b.userId === citaBarberoId) || null;
    }

    // ---- Utils de fecha ----

    function toISO(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function todayISO() { return toISO(new Date()); }

    function parseFechaHora(fecha, hora) {
        const [y, m, d] = fecha.split('-').map(Number);
        const [hh, mm] = (hora || '00:00').split(':').map(Number);
        return new Date(y, m - 1, d, hh, mm);
    }

    function formatearFechaLarga(isoDate) {
        const [y, m, d] = isoDate.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        return `${DIAS_SEMANA[date.getDay()]} ${date.getDate()} de ${MESES[date.getMonth()]}`;
    }

    function esHoy(isoDate) { return isoDate === todayISO(); }

    function esAnterior(isoDate) { return isoDate < todayISO(); }

    function diasDesdeHoy(isoDate) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const [y, m, d] = isoDate.split('-').map(Number);
        const date = new Date(y, m - 1, d); date.setHours(0, 0, 0, 0);
        return Math.round((date - today) / 86400000);
    }

    // Limpia el número y si son 10 dígitos locales (Colombia) le antepone 57.
    function clean(phone) {
        const d = String(phone || '').replace(/\D/g, '').trim();
        if (d.length === 10) return '57' + d;
        return d;
    }

    /**
     * Avatar con placeholder instantáneo (inicial + gradiente dorado).
     * Fade-in cuando la foto termina de cargar; si falla queda la inicial.
     */
    function avatarHTML(name, photoURL) {
        const initial = ((name || 'C').trim().charAt(0) || 'C').toUpperCase();
        let src = photoURL || '';
        if (src && /googleusercontent\.com/.test(src)) {
            src = src.replace(/=s\d+(-c)?/g, '=s96-c').replace(/\/s\d+-c\//g, '/s96-c/');
        }
        const imgTag = src
            ? `<img src="${src}" alt="" referrerpolicy="no-referrer" loading="eager" decoding="async"
                 class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300"
                 onload="this.style.opacity=1" onerror="this.remove()">`
            : '';
        return `<div class="relative w-10 h-10 rounded-full border-2 border-primary/30 shrink-0 overflow-hidden bg-gradient-to-br from-primary/60 to-primary/20 flex items-center justify-center">
            <span class="text-black text-sm font-black">${initial}</span>
            ${imgTag}
        </div>`;
    }

    // ---- Clasificación del estado visible de una cita ----

    /**
     * Una cita 'confirmada' puede mostrarse como:
     *   - 'proxima'   : faltan >= 30min para la hora
     *   - 'en_curso'  : ±30min de la hora
     *   - 'requiere'  : pasaron ≥90min y sigue sin cerrarse
     *
     * Las demás mantienen su estado literal.
     */
    function categoriaCita(cita, now) {
        const estado = cita.estado;
        if (estado === 'completada') return 'completada';
        if (estado === 'no_show') return 'no_show';
        if (estado === 'cancelada') return 'cancelada';
        if (estado === 'pendiente') return 'pendiente'; // por si aparece — no filtramos aquí

        // Confirmada — categorizar por timing
        const fh = parseFechaHora(cita.fecha, cita.hora);
        const diffMin = (now - fh) / 60000;
        if (diffMin >= BUFFER_COMPLETADA_MIN) return 'requiere';
        if (diffMin >= -BUFFER_EN_CURSO_MIN && diffMin < BUFFER_COMPLETADA_MIN) return 'en_curso';
        return 'proxima';
    }

    // ---- WhatsApp ----

    function whatsappClienteHref(cita, customText) {
        const numero = clean(cita.clientePhone);
        if (numero.length < 7) return null;
        const texto = customText || `Hola ${cita.clienteNombre || ''}, te hablamos desde Legends Barbería 👑`;
        return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
    }

    function mensajeRecordatorio(cita) {
        return `Hola ${cita.clienteNombre || ''}! Te recordamos tu cita con ${cita.barberoNombre || 'tu barbero'} hoy a las ${cita.hora}. ¡Te esperamos en Legends Barbería! 👑`;
    }

    function mensajeNoShow(cita) {
        return `Hola ${cita.clienteNombre || ''}, notamos que no llegaste a tu cita de las ${cita.hora} con ${cita.barberoNombre || 'tu barbero'}. ¿Todo bien? Si querés reagendar, avísanos. — Legends Barbería`;
    }

    // ---- Carga de datos ----

    async function loadData() {
        const content = document.getElementById('agenda-content');
        if (content) {
            content.innerHTML = `
                <div class="flex flex-col items-center gap-3 py-12">
                    <div class="auth-checking-spinner"></div>
                    <p class="text-white/50 text-xs">Cargando agenda...</p>
                </div>`;
        }

        try {
            // 1 sola query cubriendo rango amplio + barberos + sedes en paralelo
            const [citas, barberos, sedes] = await Promise.all([
                CitasService.listByRange(),
                BarbersService.list(),
                (typeof SedesService !== 'undefined') ? SedesService.list() : Promise.resolve([])
            ]);

            citasDelRango = citas || [];
            barberosCache = barberos || [];
            sedesCache = sedes || [];

            // Agrupar por fecha (sin filtrar todavía — el filtro se aplica al render)
            recomputarAgrupacion();

            console.log(`✓ Agenda: ${citasDelRango.length} citas cargadas en ${fechasConCitas.length} fechas (${sedesCache.length} sedes)`);

            // Posicionarse en hoy por defecto (aunque no tenga citas)
            if (!fechaActual) fechaActual = todayISO();
            render();
        } catch (error) {
            console.error('❌ Error cargando agenda:', error);
            if (content) {
                content.innerHTML = `
                    <div class="text-center py-12 px-6 rounded-xl bg-red-500/5 border border-red-500/15">
                        <span class="material-symbols-outlined text-red-400 text-4xl mb-2">error</span>
                        <p class="text-red-400 text-sm font-bold">Error al cargar la agenda</p>
                        <button onclick="reloadAgenda()" class="mt-4 px-4 py-2 bg-primary/20 text-primary text-xs font-black rounded-lg border border-primary/30">
                            Reintentar
                        </button>
                    </div>`;
            }
        }
    }

    function reloadAgenda() {
        loadData();
    }

    /**
     * Determina si una cita pertenece a la sede actualmente filtrada.
     * Fallback de migración: citas sin sedeId aparecen en la primera sede
     * (la "default"), igual que los barberos legacy en el booking.
     */
    function citaMatchesSede(cita) {
        if (sedeFilter === 'all') return true;
        if (cita.sedeId === sedeFilter) return true;
        if (!cita.sedeId && sedesCache.length > 0 && sedesCache[0].id === sedeFilter) {
            return true;
        }
        return false;
    }

    /**
     * Reagrupa citasDelRango → citasPorFecha aplicando el filtro de sede.
     * Llamado tras cargar datos o tras cambiar el filtro.
     */
    function recomputarAgrupacion() {
        citasPorFecha = new Map();
        citasDelRango.forEach(c => {
            if (!c.fecha) return;
            if (!citaMatchesSede(c)) return;
            if (!citasPorFecha.has(c.fecha)) citasPorFecha.set(c.fecha, []);
            citasPorFecha.get(c.fecha).push(c);
        });
        citasPorFecha.forEach(arr => arr.sort((a, b) => (a.hora || '').localeCompare(b.hora || '')));
        fechasConCitas = [...citasPorFecha.keys()].sort();
    }

    /**
     * Render del segmented control de sedes en el header de la agenda.
     * Si solo hay 1 sede (o ninguna), no se muestra — sedeFilter queda 'all'.
     */
    function renderSedeFilter() {
        const container = document.getElementById('agenda-sede-filter');
        if (!container) return;
        if (!sedesCache || sedesCache.length <= 1) {
            container.innerHTML = '';
            return;
        }

        const pill = (label, value, icon) => {
            const active = sedeFilter === value;
            return `
                <button onclick="window.setAgendaSedeFilter('${value}')" aria-pressed="${active}"
                    class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-[0.97]
                        ${active
                            ? 'bg-primary text-black shadow-[0_4px_15px_rgba(201,167,74,0.25)]'
                            : 'bg-white/[0.04] border border-white/[0.08] text-white/55 hover:bg-white/[0.07] hover:text-white'}">
                    <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1" aria-hidden="true">${icon}</span>
                    <span class="truncate">${label}</span>
                </button>
            `;
        };

        const pills = [pill('Todas', 'all', 'select_all')]
            .concat(sedesCache.map(s => pill(s.nombre, s.id, 'storefront')))
            .join('');

        container.innerHTML = `
            <div class="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                <p class="text-white/35 text-[9px] font-black uppercase tracking-[0.3em] mb-2 pl-1">Sede</p>
                <div class="flex gap-1.5">${pills}</div>
            </div>
        `;
    }

    function setAgendaSedeFilter(value) {
        if (sedeFilter === value) return;
        sedeFilter = value;
        recomputarAgrupacion();
        // Si la fecha actual ya no tiene citas, intentar saltar a una que tenga
        if (fechaActual && !citasPorFecha.has(fechaActual) && fechasConCitas.length > 0) {
            // Mantener fechaActual si es hoy aunque esté vacío (el día vacío es válido)
            if (!esHoy(fechaActual)) {
                fechaActual = fechasConCitas.find(f => f >= todayISO()) || fechasConCitas[fechasConCitas.length - 1];
            }
        }
        render();
    }

    // ---- Navegación entre días ----

    function findPrevDateWithCitas(from) {
        for (let i = fechasConCitas.length - 1; i >= 0; i--) {
            if (fechasConCitas[i] < from) return fechasConCitas[i];
        }
        return null;
    }

    function findNextDateWithCitas(from) {
        for (let i = 0; i < fechasConCitas.length; i++) {
            if (fechasConCitas[i] > from) return fechasConCitas[i];
        }
        return null;
    }

    function agendaGoPrev() {
        const prev = findPrevDateWithCitas(fechaActual);
        if (prev) { fechaActual = prev; render(); }
    }

    function agendaGoNext() {
        const next = findNextDateWithCitas(fechaActual);
        if (next) { fechaActual = next; render(); }
    }

    function agendaGoToday() {
        fechaActual = todayISO();
        render();
    }

    // ---- Tarjeta de cita ----

    function citaCard(cita, cat) {
        const avatar = avatarHTML(cita.clienteNombre, cita.clientePhotoURL);
        const waHrefDefault = whatsappClienteHref(cita);

        // Tema del nivel del barbero: prioriza el valor denormalizado en la cita,
        // cae al cache de barberos si es una cita legacy (lookup por userId).
        const barberoFromCache = findBarberoByCitaId(cita.barberoId);
        const nivel = cita.barberoNivel || (barberoFromCache && barberoFromCache.nivel) || null;
        const theme = (typeof window.nivelTheme === 'function') ? window.nivelTheme(nivel) : { textCls: 'text-white/70', borderLeft: '' };

        // Colores y label según categoría
        const styles = {
            proxima:    { border: 'border-white/[0.08]',        dot: 'bg-blue-400',   label: 'Próxima',      labelCls: 'text-blue-400' },
            en_curso:   { border: 'border-orange-400/40',       dot: 'bg-orange-400', label: 'En curso',     labelCls: 'text-orange-400' },
            requiere:   { border: 'border-red-500/40 bg-red-500/[0.04]', dot: 'bg-red-400',    label: '¿Se completó?', labelCls: 'text-red-400' },
            completada: { border: 'border-green-500/20',        dot: 'bg-green-400',  label: 'Completada',   labelCls: 'text-green-400' },
            no_show:    { border: 'border-white/[0.08]',        dot: 'bg-white/40',   label: 'No llegó',     labelCls: 'text-white/50' },
            cancelada:  { border: 'border-white/[0.05]',        dot: 'bg-white/25',   label: 'Cancelada',    labelCls: 'text-white/40' },
            pendiente:  { border: 'border-amber-500/30',        dot: 'bg-amber-400',  label: 'Sin confirmar', labelCls: 'text-amber-400' }
        };
        const s = styles[cat] || styles.proxima;

        // Bloque de acciones según categoría
        let actions = '';
        if (cat === 'requiere') {
            actions = `
                <div class="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/25">
                    <p class="text-red-300 text-[10px] font-black uppercase tracking-wider text-center mb-2">Ya pasó la hora — ¿qué ocurrió?</p>
                    <div class="flex gap-2">
                        <button onclick="agendaMarcarCompletada('${cita.id}')"
                            class="flex-1 px-2 py-2 rounded-lg bg-green-500/20 border border-green-500/35 text-green-400 text-[10px] font-black uppercase tracking-wide hover:bg-green-500/30 transition-all active:scale-95 flex items-center justify-center gap-1">
                            <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1">check</span>
                            Sí, completada
                        </button>
                        <button onclick="agendaMarcarNoShow('${cita.id}')"
                            class="flex-1 px-2 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white/70 text-[10px] font-black uppercase tracking-wide hover:bg-white/[0.08] transition-all active:scale-95 flex items-center justify-center gap-1">
                            <span class="material-symbols-outlined text-xs">person_off</span>
                            No llegó
                        </button>
                    </div>
                </div>
            `;
        } else if (cat === 'proxima' || cat === 'en_curso') {
            const waRec = whatsappClienteHref(cita, mensajeRecordatorio(cita));
            actions = `
                <div class="mt-3 flex gap-2">
                    ${waRec
                        ? `<a href="${waRec}" target="_blank" rel="noopener"
                            class="flex-1 px-2 py-2 rounded-lg bg-green-600/15 border border-green-600/30 text-green-400 text-[10px] font-black uppercase tracking-wide hover:bg-green-600/25 transition-all active:scale-95 flex items-center justify-center gap-1">
                            <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1">chat</span>
                            Recordatorio
                        </a>`
                        : `<div class="flex-1 px-2 py-2 rounded-lg bg-white/[0.02] text-white/25 text-[10px] font-bold italic text-center">sin tel</div>`
                    }
                    <button onclick="agendaCancelar('${cita.id}')"
                        class="flex-1 px-2 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400/80 text-[10px] font-black uppercase tracking-wide hover:bg-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-1">
                        <span class="material-symbols-outlined text-xs">close</span>
                        Cancelar
                    </button>
                </div>
            `;
        } else if (cat === 'completada' || cat === 'no_show' || cat === 'cancelada') {
            // Sólo acceso rápido a WhatsApp (ya cerró el ciclo)
            actions = waHrefDefault
                ? `<div class="mt-3">
                    <a href="${waHrefDefault}" target="_blank" rel="noopener"
                        class="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/50 text-[10px] font-black uppercase tracking-wide hover:bg-green-600/10 hover:text-green-400 hover:border-green-600/20 transition-all active:scale-95">
                        <span class="material-symbols-outlined text-xs">chat</span>
                        WhatsApp cliente
                    </a>
                </div>`
                : '';
        }

        // Para citas completadas que pasaron por cobro, totalCobrado refleja
        // el monto real (incluyendo productos vendidos al cierre).
        const monto = cita.totalCobrado || cita.servicioPrecio || 0;
        const precioStr = typeof window.formatCOP === 'function'
            ? window.formatCOP(monto)
            : `$${monto}`;

        return `
            <div class="p-3.5 rounded-xl bg-white/[0.02] border ${s.border}" style="${theme.borderLeft}">
                <div class="flex items-start gap-3">
                    ${avatar}
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-2 mb-0.5">
                            <p class="text-white text-xs font-black truncate">${cita.clienteNombre || 'Cliente'}</p>
                            <div class="flex items-center gap-1.5 shrink-0">
                                <span class="w-1.5 h-1.5 rounded-full ${s.dot}"></span>
                                <span class="${s.labelCls} text-[9px] font-black uppercase tracking-wider">${s.label}</span>
                            </div>
                        </div>
                        <p class="text-white/50 text-[11px] truncate">${cita.servicioNombre || 'Servicio'} · <span class="${theme.textCls} font-bold">${cita.barberoNombre || '—'}</span></p>
                        <div class="flex items-center gap-3 mt-1.5">
                            <div class="flex items-center gap-1">
                                <span class="material-symbols-outlined text-white/30 text-xs">schedule</span>
                                <span class="text-white/70 text-[11px] font-black">${cita.hora || '—'}</span>
                            </div>
                            <span class="text-primary text-[10px] font-black">${precioStr}</span>
                        </div>
                    </div>
                </div>
                ${actions}
            </div>
        `;
    }

    // ---- Secciones del día ----

    function sectionBlock(title, icon, iconColor, citas, cat) {
        if (!citas || citas.length === 0) return '';
        return `
            <div>
                <h2 class="flex items-center gap-2 text-white/60 text-[10px] font-black uppercase tracking-widest mb-2.5 px-0.5">
                    <span class="material-symbols-outlined ${iconColor} text-sm" style="font-variation-settings: 'FILL' 1">${icon}</span>
                    ${title}
                    <span class="ml-auto text-white/30 text-[10px]">${citas.length}</span>
                </h2>
                <div class="space-y-2">
                    ${citas.map(c => citaCard(c, cat)).join('')}
                </div>
            </div>
        `;
    }

    function render() {
        renderSedeFilter();
        renderHeader();
        renderBody();
        renderNavButtons();
    }

    function renderHeader() {
        const label = document.getElementById('agenda-date-label');
        const sub = document.getElementById('agenda-date-sub');
        const todayBtn = document.getElementById('agenda-today-btn');
        if (!label || !sub) return;

        label.textContent = formatearFechaLarga(fechaActual);
        const delta = diasDesdeHoy(fechaActual);
        let subText;
        if (delta === 0) subText = 'Hoy';
        else if (delta === 1) subText = 'Mañana';
        else if (delta === -1) subText = 'Ayer';
        else if (delta > 0) subText = `En ${delta} días`;
        else subText = `Hace ${Math.abs(delta)} días`;

        const citasDia = citasPorFecha.get(fechaActual) || [];
        const totalTxt = citasDia.length > 0 ? ` · ${citasDia.length} cita${citasDia.length === 1 ? '' : 's'}` : '';
        sub.textContent = `${subText}${totalTxt}`;

        if (todayBtn) {
            if (esHoy(fechaActual)) todayBtn.classList.add('hidden');
            else todayBtn.classList.remove('hidden');
        }
    }

    function renderNavButtons() {
        const prevBtn = document.getElementById('agenda-prev-btn');
        const nextBtn = document.getElementById('agenda-next-btn');
        if (prevBtn) prevBtn.disabled = !findPrevDateWithCitas(fechaActual);
        if (nextBtn) nextBtn.disabled = !findNextDateWithCitas(fechaActual);
    }

    function renderBody() {
        const content = document.getElementById('agenda-content');
        if (!content) return;

        const citasDia = citasPorFecha.get(fechaActual) || [];
        if (citasDia.length === 0) {
            content.innerHTML = `
                <div class="flex flex-col items-center gap-3 py-12 px-6 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <span class="material-symbols-outlined text-white/20 text-5xl" style="font-variation-settings: 'FILL' 1">event_busy</span>
                    <p class="text-white/50 text-sm font-bold text-center">Sin cortes este día</p>
                    <p class="text-white/25 text-[11px] text-center">Usá las flechas para ir a un día con citas</p>
                </div>`;
            return;
        }

        // Clasificar cada cita en su categoría
        const now = new Date();
        const buckets = { proxima: [], en_curso: [], requiere: [], completada: [], no_show: [], cancelada: [], pendiente: [] };
        citasDia.forEach(c => {
            const cat = categoriaCita(c, now);
            if (buckets[cat]) buckets[cat].push(c);
        });

        // Orden específico: requiere (top, urgente) → en_curso → próximas → completadas → no_show → canceladas
        const html = [
            sectionBlock('Requiere atención', 'priority_high', 'text-red-400', buckets.requiere, 'requiere'),
            sectionBlock('En curso', 'pending', 'text-orange-400', buckets.en_curso, 'en_curso'),
            sectionBlock('Próximas', 'upcoming', 'text-blue-400', buckets.proxima, 'proxima'),
            sectionBlock('Sin confirmar', 'hourglass_top', 'text-amber-400', buckets.pendiente, 'pendiente'),
            sectionBlock('Completadas', 'task_alt', 'text-green-400', buckets.completada, 'completada'),
            sectionBlock('No llegó', 'person_off', 'text-white/40', buckets.no_show, 'no_show'),
            sectionBlock('Canceladas', 'cancel', 'text-white/30', buckets.cancelada, 'cancelada')
        ].filter(Boolean).join('');

        content.innerHTML = html;
    }

    // ---- Acciones sobre citas ----

    async function agendaMarcarCompletada(citaId) {
        if (!confirm('Marcar esta cita como completada?')) return;
        const ok = await CitasService.completar(citaId);
        if (ok) {
            if (typeof window.showToast === 'function') window.showToast('Cita completada ✓', 'success');
            // Actualizar el dataset local sin nueva query
            const cita = citasDelRango.find(c => c.id === citaId);
            if (cita) cita.estado = 'completada';
            render();
        } else {
            alert('No se pudo completar. Intentá de nuevo.');
        }
    }

    async function agendaMarcarNoShow(citaId) {
        const cita = citasDelRango.find(c => c.id === citaId);
        if (!cita) return;
        if (!confirm('Marcar que el cliente no llegó a la cita?')) return;

        const ok = await CitasService.markNoShow(citaId);
        if (ok) {
            if (typeof window.showToast === 'function') window.showToast('Marcado como no llegó', 'info');
            cita.estado = 'no_show';

            // Abrir WA con el mensaje automático
            const waHref = whatsappClienteHref(cita, mensajeNoShow(cita));
            if (waHref) window.open(waHref, '_blank', 'noopener');

            render();
        } else {
            alert('No se pudo marcar. Intentá de nuevo.');
        }
    }

    async function agendaCancelar(citaId) {
        if (!confirm('Cancelar esta cita?')) return;
        const ok = await CitasService.cancelar(citaId);
        if (ok) {
            if (typeof window.showToast === 'function') window.showToast('Cita cancelada', 'info');
            const cita = citasDelRango.find(c => c.id === citaId);
            if (cita) cita.estado = 'cancelada';
            render();
        } else {
            alert('No se pudo cancelar. Intentá de nuevo.');
        }
    }

    // ---- Exponer globalmente ----

    window.initAgenda = loadData;
    window.reloadAgenda = reloadAgenda;
    window.agendaGoPrev = agendaGoPrev;
    window.agendaGoNext = agendaGoNext;
    window.agendaGoToday = agendaGoToday;
    window.agendaMarcarCompletada = agendaMarcarCompletada;
    window.agendaMarcarNoShow = agendaMarcarNoShow;
    window.agendaCancelar = agendaCancelar;
    window.setAgendaSedeFilter = setAgendaSedeFilter;
    console.log('✓ AdminAgendaUI loaded');
})();
