/**
 * LEGENDS BARBERIA - ADMIN: CITAS PENDIENTES (STEPPER)
 *
 * Lista las citas con estado 'pendiente' y obliga al admin a completar un
 * flujo de 3 pasos antes de poder confirmarlas:
 *   1) Contactar al cliente por WhatsApp
 *   2) Enviar la info de la cita al barbero por WhatsApp
 *   3) Confirmar la cita (sólo se habilita tras 1 y 2)
 *
 * También puede rechazarla (pasa a 'cancelada').
 * Se muestra en el dashboard del admin.
 */

(function () {
    'use strict';

    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    // Cache de barberos. Nota: en una cita `barberoId` es el userId (Firebase
    // Auth UID), NO el docId de Firestore — así lo guarda booking-ui.js.
    // Por eso el lookup es por `userId`, no por el id del documento.
    let barberosCache = [];

    function findBarberoByCitaId(citaBarberoId) {
        return barberosCache.find(b => b.userId === citaBarberoId) || null;
    }

    function formatearFecha(isoDate) {
        if (!isoDate) return '';
        const [y, m, d] = isoDate.split('-').map(Number);
        const fecha = new Date(y, m - 1, d);
        return `${DIAS_SEMANA[fecha.getDay()]} ${fecha.getDate()} ${MESES[fecha.getMonth()]}`;
    }

    // Limpia el número y si son 10 dígitos locales (Colombia) le antepone 57.
    function clean(phone) {
        const d = String(phone || '').replace(/\D/g, '');
        if (d.length === 10) return '57' + d;
        return d;
    }

    /**
     * Avatar con placeholder instantáneo (inicial + gradiente dorado).
     * La foto se hace fade-in cuando termina de cargar; si falla se elimina y
     * queda el placeholder. Para fotos de Google bajamos la resolución a s96
     * (más liviano para un círculo de 40px).
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

    /**
     * WhatsApp para cliente: mensaje de confirmación amable.
     */
    function whatsappClienteHref(cita) {
        const numero = clean(cita.clientePhone);
        if (numero.length < 7) return null;
        const texto =
            `Hola ${cita.clienteNombre || ''}! 👋\n` +
            `Te confirmamos tu cita con ${cita.barberoNombre || 'tu barbero'} ` +
            `para ${formatearFecha(cita.fecha)} a las ${cita.hora}.\n` +
            `¿Todo bien por tu lado? — Legends Barbería 👑`;
        return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
    }

    /**
     * WhatsApp para barbero: le envía la información completa de la reserva.
     */
    function whatsappBarberoHref(cita) {
        const barbero = findBarberoByCitaId(cita.barberoId);
        const numero = clean(barbero?.phone);
        if (numero.length < 7) return null;
        const tel = clean(cita.clientePhone);
        const telStr = tel ? `+${tel}` : 'sin teléfono';
        const texto =
            `Nueva cita confirmada 📅\n\n` +
            `Cliente: ${cita.clienteNombre || '—'}\n` +
            `Servicio: ${cita.servicioNombre || '—'}\n` +
            `Fecha: ${formatearFecha(cita.fecha)}\n` +
            `Hora: ${cita.hora}\n` +
            `Tel cliente: ${telStr}\n\n` +
            `— Legends Barbería`;
        return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
    }

    /**
     * Para citas legacy creadas antes del flujo de captura de teléfono,
     * intenta recuperar el `phone` desde el doc del usuario en Firestore.
     */
    async function enrichPhonesFromUsers(citas) {
        const faltantes = citas.filter(c => !c.clientePhone && c.clienteId);
        if (faltantes.length === 0) return citas;

        const idsUnicos = [...new Set(faltantes.map(c => c.clienteId))];
        const db = (typeof firebaseAdapter !== 'undefined' && firebaseAdapter.db) ? firebaseAdapter.db : null;
        if (!db) return citas;

        const phoneByUid = {};
        await Promise.all(idsUnicos.map(async (uid) => {
            try {
                const doc = await db.collection('users').doc(uid).get();
                if (doc.exists) {
                    const data = doc.data();
                    if (data && data.phone) phoneByUid[uid] = data.phone;
                }
            } catch (error) {
                console.warn(`No se pudo leer phone del usuario ${uid}:`, error?.message || error);
            }
        }));

        citas.forEach(c => {
            if (!c.clientePhone && phoneByUid[c.clienteId]) {
                c.clientePhone = phoneByUid[c.clienteId];
            }
        });
        return citas;
    }

    /**
     * Precarga los barberos una sola vez en caché para tener sus teléfonos.
     */
    async function loadBarberosCache() {
        try {
            barberosCache = await BarbersService.list() || [];
        } catch (error) {
            console.warn('No se pudo precargar barberos:', error);
            barberosCache = [];
        }
    }

    /**
     * Un paso del stepper: bullet numerado con tick verde si está hecho.
     */
    function stepBullet(num, done) {
        if (done) {
            return `<div class="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-green-400 text-[14px]" style="font-variation-settings: 'FILL' 1">check</span>
            </div>`;
        }
        return `<div class="w-6 h-6 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0">
            <span class="text-white/50 text-[11px] font-black">${num}</span>
        </div>`;
    }

    function renderCitaCard(cita) {
        const avatar = avatarHTML(cita.clienteNombre, cita.clientePhotoURL);

        // El nivel del barbero puede venir denormalizado en la cita (schema nuevo)
        // o recuperarse del cache de barberos (fallback para citas legacy).
        const barbero = findBarberoByCitaId(cita.barberoId);
        const nivel = cita.barberoNivel || (barbero && barbero.nivel) || null;
        const theme = (typeof window.nivelTheme === 'function') ? window.nivelTheme(nivel) : { textCls: 'text-white/70', borderLeft: '' };

        const waClienteHref = whatsappClienteHref(cita);
        const waBarberoHref = whatsappBarberoHref(cita);
        const barberoTienePhone = !!(barbero && clean(barbero.phone).length >= 7);

        const paso1Done = !!cita.adminContactoCliente;
        const paso2Done = !!cita.adminContactoBarbero;
        const paso2Disabled = !paso1Done;
        const confirmDisabled = !(paso1Done && paso2Done);

        // Paso 1: WhatsApp cliente
        const paso1Btn = waClienteHref
            ? `<a href="${waClienteHref}" target="_blank" rel="noopener"
                onclick="adminMarkContactoCliente('${cita.id}')"
                class="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg ${paso1Done ? 'bg-green-600/10 border-green-600/20 text-green-400/70' : 'bg-green-600/20 border-green-600/35 text-green-400'} border text-[11px] font-black uppercase tracking-wide hover:brightness-110 transition-all active:scale-95">
                <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1">chat</span>
                ${paso1Done ? 'Reabrir WA cliente' : 'Contactar cliente'}
            </a>`
            : `<div class="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white/30 text-[10px] font-bold italic">
                sin teléfono del cliente
            </div>`;

        // Paso 2: WhatsApp barbero
        let paso2Btn;
        if (!barberoTienePhone) {
            paso2Btn = `<button onclick="adminEditBarberoPhone('${cita.barberoId}')"
                class="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[11px] font-black uppercase tracking-wide hover:bg-orange-500/25 transition-all active:scale-95">
                <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1">edit</span>
                Cargar tel del barbero
            </button>`;
        } else if (paso2Disabled) {
            paso2Btn = `<div class="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white/25 text-[11px] font-black uppercase tracking-wide cursor-not-allowed">
                <span class="material-symbols-outlined text-xs">lock</span>
                Enviar al barbero
            </div>`;
        } else {
            paso2Btn = `<a href="${waBarberoHref}" target="_blank" rel="noopener"
                onclick="adminMarkContactoBarbero('${cita.id}')"
                class="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg ${paso2Done ? 'bg-green-600/10 border-green-600/20 text-green-400/70' : 'bg-green-600/20 border-green-600/35 text-green-400'} border text-[11px] font-black uppercase tracking-wide hover:brightness-110 transition-all active:scale-95">
                <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1">content_cut</span>
                ${paso2Done ? 'Reabrir WA barbero' : 'Enviar al barbero'}
            </a>`;
        }

        // Paso 3: confirmar
        const confirmBtn = confirmDisabled
            ? `<button onclick="adminAvisoConfirmacionBloqueada()" disabled
                class="w-full px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white/25 text-[11px] font-black uppercase tracking-wide cursor-not-allowed flex items-center justify-center gap-1.5">
                <span class="material-symbols-outlined text-xs">lock</span>
                Completa pasos 1 y 2 para confirmar
            </button>`
            : `<button onclick="adminConfirmarCita('${cita.id}')"
                class="w-full px-3 py-2.5 rounded-lg bg-primary text-black text-[11px] font-black uppercase tracking-wide shadow-[0_4px_20px_rgba(201,167,74,0.3)] hover:bg-yellow-500 transition-all active:scale-95 flex items-center justify-center gap-1.5">
                <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1">check_circle</span>
                Confirmar cita
            </button>`;

        return `
            <div class="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]" style="${theme.borderLeft}">
                <div class="flex items-start gap-3">
                    ${avatar}
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-2 mb-1">
                            <p class="text-white text-xs font-black truncate">${cita.clienteNombre || 'Cliente'}</p>
                            <span class="text-primary text-xs font-black shrink-0">${typeof window.formatCOP === 'function' ? window.formatCOP(cita.servicioPrecio || 0) : '$' + (cita.servicioPrecio || 0)}</span>
                        </div>
                        <p class="text-white/50 text-[11px] truncate">${cita.servicioNombre || 'Servicio'} con <span class="${theme.textCls} font-bold">${cita.barberoNombre || 'Barbero'}</span></p>
                        <div class="flex items-center gap-1.5 mt-1.5">
                            <span class="material-symbols-outlined text-white/30 text-xs">event</span>
                            <span class="text-white/60 text-[10px] font-semibold">${formatearFecha(cita.fecha)} • ${cita.hora || ''}</span>
                        </div>
                    </div>
                </div>

                <!-- Stepper de 3 pasos -->
                <div class="mt-3 space-y-2 pt-3 border-t border-white/[0.05]">
                    <!-- Paso 1 -->
                    <div class="flex items-center gap-2.5">
                        ${stepBullet(1, paso1Done)}
                        <div class="flex-1 min-w-0">
                            <p class="text-white/70 text-[10px] font-black uppercase tracking-wider leading-tight">Confirmar con cliente</p>
                        </div>
                        <div class="shrink-0">${paso1Btn}</div>
                    </div>
                    <!-- Paso 2 -->
                    <div class="flex items-center gap-2.5 ${paso2Disabled && barberoTienePhone ? 'opacity-60' : ''}">
                        ${stepBullet(2, paso2Done)}
                        <div class="flex-1 min-w-0">
                            <p class="text-white/70 text-[10px] font-black uppercase tracking-wider leading-tight">Avisar al barbero</p>
                        </div>
                        <div class="shrink-0">${paso2Btn}</div>
                    </div>
                    <!-- Paso 3 -->
                    <div class="flex items-start gap-2.5 ${confirmDisabled ? 'opacity-80' : ''}">
                        ${stepBullet(3, false)}
                        <div class="flex-1 min-w-0">
                            <p class="text-white/70 text-[10px] font-black uppercase tracking-wider leading-tight mb-1.5">Confirmar cita</p>
                            ${confirmBtn}
                        </div>
                    </div>
                </div>

                <!-- Rechazar (separado abajo) -->
                <div class="mt-2.5 pt-2.5 border-t border-white/[0.03]">
                    <button onclick="adminRechazarCita('${cita.id}')"
                        class="w-full px-3 py-1.5 rounded-lg bg-red-500/5 border border-red-500/15 text-red-400/70 text-[10px] font-bold uppercase tracking-wide hover:bg-red-500/15 transition-all active:scale-95">
                        <span class="material-symbols-outlined text-[13px] align-middle mr-1">close</span>
                        Rechazar cita
                    </button>
                </div>
            </div>
        `;
    }

    function updateCountBadge(count) {
        const badge = document.getElementById('admin-citas-pendientes-count');
        if (!badge) return;
        if (count > 0) {
            badge.textContent = String(count);
            badge.classList.remove('hidden');
            badge.classList.add('inline-flex');
        } else {
            badge.classList.add('hidden');
            badge.classList.remove('inline-flex');
        }
    }

    async function initCitasPendientes() {
        const container = document.getElementById('admin-citas-pendientes-container');
        if (!container) return;

        container.innerHTML = `
            <div class="flex flex-col items-center gap-3 py-8">
                <div class="auth-checking-spinner"></div>
                <p class="text-white/50 text-xs">Cargando citas pendientes...</p>
            </div>
        `;

        try {
            // Precargamos barberos (para tener el phone) y las citas pendientes en paralelo
            const [pendientes] = await Promise.all([
                CitasService.listPendientes(),
                loadBarberosCache()
            ]);
            updateCountBadge(pendientes.length);

            if (pendientes.length === 0) {
                container.innerHTML = `
                    <div class="flex flex-col items-center gap-2 py-8 px-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <span class="material-symbols-outlined text-white/20 text-4xl" style="font-variation-settings: 'FILL' 1">inbox</span>
                        <p class="text-white/40 text-xs font-medium text-center">Sin citas pendientes</p>
                        <p class="text-white/25 text-[10px] text-center">Cuando un cliente reserve aparecerá aquí</p>
                    </div>
                `;
                return;
            }

            await enrichPhonesFromUsers(pendientes);
            container.innerHTML = pendientes.map(renderCitaCard).join('');
            console.log(`✓ ${pendientes.length} citas pendientes renderizadas`);

        } catch (error) {
            console.error('❌ Error cargando citas pendientes:', error);
            container.innerHTML = `
                <div class="text-center py-6">
                    <span class="material-symbols-outlined text-red-400 text-4xl mb-2">error</span>
                    <p class="text-red-400 text-xs">Error al cargar citas pendientes</p>
                    <button onclick="initCitasPendientes()" class="mt-3 px-4 py-2 bg-primary/20 text-primary text-xs font-bold rounded-lg border border-primary/30">
                        Reintentar
                    </button>
                </div>
            `;
        }
    }

    // Handlers de los pasos — marcan el flag en Firestore y refrescan la card.

    async function adminMarkContactoCliente(citaId) {
        // El link ya abre WhatsApp (target=_blank). En paralelo marcamos el flag.
        await CitasService.markContactoCliente(citaId);
        setTimeout(initCitasPendientes, 400);
    }

    async function adminMarkContactoBarbero(citaId) {
        await CitasService.markContactoBarbero(citaId);
        setTimeout(initCitasPendientes, 400);
    }

    function adminAvisoConfirmacionBloqueada() {
        if (typeof window.showToast === 'function') {
            window.showToast('Primero contactá al cliente y al barbero', 'error');
        }
    }

    /**
     * Si el barbero no tiene phone, lleva al admin directo al modal de edición
     * de ESE barbero específico. En la cita guardamos el userId del barbero,
     * pero `openEditBarberModal` espera el docId de Firestore — hay que
     * traducir uno en el otro buscando en el cache de barberManager.
     */
    async function adminEditBarberoPhone(barberoUserId) {
        if (typeof barberManager === 'undefined') return;

        if (typeof window.showToast === 'function') {
            window.showToast('Cargá el teléfono del barbero', 'info');
        }

        // Cambiar a la pestaña de barberos (carga el partial si hace falta)
        if (typeof switchTab === 'function') {
            await switchTab('admin-barberos');
        }

        // Garantizar que los barberos estén cargados en memoria
        if (!barberManager.initialized) {
            await barberManager.init();
        } else if (!barberManager.barbers || barberManager.barbers.length === 0) {
            await barberManager.loadBarbers();
        }

        // userId (Auth UID) → docId (Firestore)
        const barbero = barberManager.barbers.find(b => b.userId === barberoUserId);
        if (!barbero) {
            if (typeof window.showToast === 'function') {
                window.showToast('No se encontró el barbero en el catálogo', 'error');
            }
            return;
        }

        if (typeof barberManager.openEditBarberModal === 'function') {
            barberManager.openEditBarberModal(barbero.id);
        }
    }

    async function adminConfirmarCita(citaId) {
        const adminUid = roleManager && roleManager.currentUser && roleManager.currentUser.uid;
        if (!adminUid) {
            alert('No se pudo identificar tu sesión admin.');
            return;
        }

        if (!confirm('¿Confirmar esta cita? El barbero y el cliente la verán como confirmada.')) return;

        const ok = await CitasService.confirmar(citaId, adminUid);
        if (ok) {
            if (typeof window.showToast === 'function') {
                window.showToast('Cita confirmada ✓', 'success');
            }
            await initCitasPendientes();
        } else {
            alert('No se pudo confirmar. Intenta de nuevo.');
        }
    }

    async function adminRechazarCita(citaId) {
        if (!confirm('¿Rechazar esta cita? El cliente verá la reserva como cancelada.')) return;

        const ok = await CitasService.cancelar(citaId);
        if (ok) {
            if (typeof window.showToast === 'function') {
                window.showToast('Cita rechazada', 'success');
            }
            await initCitasPendientes();
        } else {
            alert('No se pudo rechazar. Intenta de nuevo.');
        }
    }

    window.initCitasPendientes = initCitasPendientes;
    window.adminMarkContactoCliente = adminMarkContactoCliente;
    window.adminMarkContactoBarbero = adminMarkContactoBarbero;
    window.adminAvisoConfirmacionBloqueada = adminAvisoConfirmacionBloqueada;
    window.adminEditBarberoPhone = adminEditBarberoPhone;
    window.adminConfirmarCita = adminConfirmarCita;
    window.adminRechazarCita = adminRechazarCita;
    console.log('✓ AdminCitasUI (stepper) loaded');
})();
