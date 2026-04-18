/**
 * LEGENDS BARBERIA - ADMIN: CITAS PENDIENTES
 * Lista las citas con estado 'pendiente' y permite al admin confirmarlas
 * (pasan a 'confirmada') o rechazarlas (pasan a 'cancelada').
 * Se muestra en el dashboard del admin.
 */

(function () {
    'use strict';

    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    function formatearFecha(isoDate) {
        if (!isoDate) return '';
        const [y, m, d] = isoDate.split('-').map(Number);
        const fecha = new Date(y, m - 1, d);
        return `${DIAS_SEMANA[fecha.getDay()]} ${fecha.getDate()} ${MESES[fecha.getMonth()]}`;
    }

    /**
     * Genera el href de WhatsApp con mensaje preformateado.
     * Limpia cualquier caracter no numérico del teléfono (espacios, +, guiones).
     */
    function whatsappHref(cita) {
        if (!cita.clientePhone) return null;
        const numero = String(cita.clientePhone).replace(/\D/g, '');
        if (numero.length < 7) return null;
        const texto = `Hola ${cita.clienteNombre || ''}! Te confirmamos tu cita con ${cita.barberoNombre || 'tu barbero'} para ${formatearFecha(cita.fecha)} a las ${cita.hora}. ¿Todo bien? — Legends Barbería`;
        return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
    }

    /**
     * Para citas legacy creadas antes del flujo de captura de teléfono,
     * intenta recuperar el `phone` desde el doc del usuario en Firestore.
     * Hace las lecturas en paralelo (una por cliente único). Si el usuario
     * tampoco tiene teléfono guardado, la cita queda como "sin teléfono".
     *
     * Este enriquecimiento es SOLO en memoria — no modifica los docs de
     * citas en Firestore. La próxima reserva del cliente ya guardará el
     * teléfono directamente en la cita.
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
                // Silencioso — si no podemos leer, la cita queda sin teléfono
                console.warn(`No se pudo leer phone del usuario ${uid}:`, error?.message || error);
            }
        }));

        citas.forEach(c => {
            if (!c.clientePhone && phoneByUid[c.clienteId]) {
                c.clientePhone = phoneByUid[c.clienteId];
                c._phoneFromUser = true; // flag para indicar que vino del doc de usuario (opcional)
            }
        });

        const recuperadas = faltantes.filter(c => c.clientePhone).length;
        if (recuperadas > 0) {
            console.log(`✓ Teléfono recuperado desde users para ${recuperadas}/${faltantes.length} citas legacy`);
        }

        return citas;
    }

    function renderCitaCard(cita) {
        const foto = cita.clientePhotoURL
            || `https://ui-avatars.com/api/?name=${encodeURIComponent(cita.clienteNombre || 'Cliente')}&background=c9a74a&color=000`;
        const waHref = whatsappHref(cita);

        const whatsappBtn = waHref
            ? `<a href="${waHref}" target="_blank" rel="noopener"
                class="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-green-600/15 border border-green-600/30 text-green-400 text-[11px] font-black uppercase tracking-wide hover:bg-green-600/25 transition-all active:scale-95">
                <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1">chat</span>
                WhatsApp
            </a>`
            : `<div class="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white/30 text-[10px] font-bold italic">
                sin teléfono
            </div>`;

        return `
            <div class="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div class="flex items-start gap-3">
                    <img src="${foto}" alt=""
                        class="w-10 h-10 rounded-full object-cover border-2 border-primary/30 shrink-0">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-2 mb-1">
                            <p class="text-white text-xs font-black truncate">${cita.clienteNombre || 'Cliente'}</p>
                            <span class="text-primary text-xs font-black shrink-0">${typeof window.formatCOP === 'function' ? window.formatCOP(cita.servicioPrecio || 0) : '$' + (cita.servicioPrecio || 0)}</span>
                        </div>
                        <p class="text-white/50 text-[11px] truncate">${cita.servicioNombre || 'Servicio'} con ${cita.barberoNombre || 'Barbero'}</p>
                        <div class="flex items-center gap-1.5 mt-1.5">
                            <span class="material-symbols-outlined text-white/30 text-xs">event</span>
                            <span class="text-white/60 text-[10px] font-semibold">${formatearFecha(cita.fecha)} • ${cita.hora || ''}</span>
                        </div>
                    </div>
                </div>
                <!-- Fila 1: contactar por WhatsApp (acción primaria) -->
                <div class="mt-3">
                    ${whatsappBtn}
                </div>
                <!-- Fila 2: confirmar o rechazar -->
                <div class="flex gap-2 mt-2">
                    <button onclick="adminConfirmarCita('${cita.id}')"
                        class="flex-1 px-3 py-2 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-[11px] font-black uppercase tracking-wide hover:bg-green-500/25 transition-all active:scale-95">
                        <span class="material-symbols-outlined text-xs align-middle mr-1" style="font-variation-settings: 'FILL' 1">check</span>
                        Confirmar
                    </button>
                    <button onclick="adminRechazarCita('${cita.id}')"
                        class="flex-1 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400/80 text-[11px] font-black uppercase tracking-wide hover:bg-red-500/20 transition-all active:scale-95">
                        <span class="material-symbols-outlined text-xs align-middle mr-1" style="font-variation-settings: 'FILL' 1">close</span>
                        Rechazar
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
            const pendientes = await CitasService.listPendientes();
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

            // Enriquecer citas sin teléfono con el phone del doc del usuario (para citas legacy)
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
    window.adminConfirmarCita = adminConfirmarCita;
    window.adminRechazarCita = adminRechazarCita;
    console.log('✓ AdminCitasUI loaded');
})();
