/**
 * ADMIN - Dashboard
 * Carga de estadísticas reales desde Firestore para el tab admin-dashboard.
 */

async function loadDashboardStats() {
    try {
        if (!firebaseAdapter || !firebaseAdapter.db) return;

        const usersSnapshot = await firebaseAdapter.db.collection('users').get();
        const totalUsers = usersSnapshot.size;
        const el1 = document.getElementById('dash-usuarios');
        if (el1) el1.textContent = totalUsers;

        const barbersSnapshot = await firebaseAdapter.db.collection('barberos').get();
        const totalBarbers = barbersSnapshot.size;
        const el2 = document.getElementById('dash-barberos');
        if (el2) el2.textContent = totalBarbers;

        // Fechas locales (YYYY-MM-DD) para "este mes" y "hoy".
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const hoy = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const inicioMes = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;

        // INGRESOS del mes = ventas COBRADAS del mes (todas las sedes). Se excluye
        // lo vendido a deuda (aún sin cobrar), igual que el reporte "Ingresos
        // cobrados", para que el Panel y Reportes muestren la misma cifra.
        const ventasMesSnap = await firebaseAdapter.db.collection('ventas')
            .where('fecha', '>=', inicioMes)
            .where('fecha', '<=', hoy)
            .get();
        let ingresosMes = 0;
        ventasMesSnap.forEach(doc => {
            const v = doc.data();
            if (v.metodoPago !== 'deuda') ingresosMes += Number(v.total) || 0;
        });
        const elIng = document.getElementById('dash-ingresos');
        if (elIng) elIng.textContent = (typeof window.formatCOP === 'function')
            ? window.formatCOP(ingresosMes)
            : ('$' + ingresosMes.toLocaleString('es-CO'));

        // CITAS HOY = citas programadas para hoy (excluye las canceladas).
        const citasHoySnap = await firebaseAdapter.db.collection('citas')
            .where('fecha', '==', hoy)
            .get();
        let citasHoy = 0;
        citasHoySnap.forEach(doc => { if (doc.data().estado !== 'cancelada') citasHoy++; });
        const elCitas = document.getElementById('dash-citas');
        if (elCitas) elCitas.textContent = citasHoy;

    } catch (error) {
        console.error('Error cargando stats del dashboard:', error);
    }
}

window.loadDashboardStats = loadDashboardStats;

// ============================================
// AJUSTES (config global) — toggle de comentarios de reseñas
// ============================================

function pintarToggleResenas(visible) {
    const btn = document.getElementById('toggle-resenas-comentarios');
    if (!btn) return;
    const knob = btn.querySelector('.toggle-knob');
    btn.setAttribute('aria-checked', visible ? 'true' : 'false');
    if (visible) {
        btn.classList.add('bg-primary', 'border-primary');
        btn.classList.remove('bg-white/10', 'border-white/15');
        if (knob) { knob.classList.add('left-[26px]', 'bg-black'); knob.classList.remove('left-0.5', 'bg-white/80'); }
    } else {
        btn.classList.remove('bg-primary', 'border-primary');
        btn.classList.add('bg-white/10', 'border-white/15');
        if (knob) { knob.classList.remove('left-[26px]', 'bg-black'); knob.classList.add('left-0.5', 'bg-white/80'); }
    }
}

async function loadAdminAjustes() {
    if (typeof ConfigService === 'undefined') return;
    try {
        const visible = await ConfigService.getResenasComentariosVisibles();
        pintarToggleResenas(visible);
    } catch (e) {
        console.error('Error cargando ajustes admin:', e);
    }
}

async function toggleResenasComentarios() {
    if (typeof ConfigService === 'undefined') return;
    const btn = document.getElementById('toggle-resenas-comentarios');
    const actual = btn ? btn.getAttribute('aria-checked') === 'true' : true;
    const nuevo = !actual;
    pintarToggleResenas(nuevo); // optimista
    const ok = await ConfigService.set({ resenasComentariosVisibles: nuevo });
    if (!ok) {
        pintarToggleResenas(actual); // revertir
        if (typeof window.showToast === 'function') window.showToast('No se pudo guardar el ajuste', 'error');
        return;
    }
    if (typeof window.showToast === 'function') {
        window.showToast(nuevo ? 'Comentarios visibles para los barberos' : 'Comentarios ocultos para los barberos', 'success');
    }
}

window.loadAdminAjustes = loadAdminAjustes;
window.toggleResenasComentarios = toggleResenasComentarios;

// ============================================
// RECORDATORIOS DE PAGO (P8) — gestión + alerta
// ============================================

const _recState = { recordatorios: [], sedes: [] };

function _recTodayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function _recFmtCOP(n) {
    return (typeof window.formatCOP === 'function') ? window.formatCOP(n || 0) : `$${n || 0}`;
}
function _recEsc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function _recSedeNombre(sedeId) {
    const s = _recState.sedes.find(x => x.id === sedeId);
    return s ? s.nombre : 'Sede';
}

async function loadAdminRecordatorios() {
    if (typeof RecordatoriosService === 'undefined') return;
    try {
        const [recs, sedes] = await Promise.all([
            RecordatoriosService.list(),
            (typeof SedesService !== 'undefined') ? SedesService.list() : Promise.resolve([])
        ]);
        _recState.recordatorios = (recs || []).filter(r => r.activo !== false);
        _recState.sedes = sedes || [];
        renderRecordatoriosAlert();
        renderRecordatoriosList();
    } catch (e) {
        console.error('Error cargando recordatorios:', e);
    }
}

function renderRecordatoriosAlert() {
    const cont = document.getElementById('admin-recordatorios-alert');
    if (!cont) return;
    const hoy = _recTodayISO();
    const vencidos = _recState.recordatorios.filter(r => (r.proximaFecha || '') <= hoy)
        .sort((a, b) => (a.proximaFecha || '').localeCompare(b.proximaFecha || ''));
    if (vencidos.length === 0) { cont.classList.add('hidden'); cont.innerHTML = ''; return; }
    cont.classList.remove('hidden');
    const items = vencidos.map(r => `
        <div class="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-amber-500/15">
            <div class="flex-1 min-w-0">
                <p class="text-white text-sm font-bold truncate">${_recEsc(r.nombre)}${r.monto ? ` · ${_recFmtCOP(r.monto)}` : ''}</p>
                <p class="text-amber-200/70 text-[11px] truncate">${_recSedeNombre(r.sedeId)} · vence ${r.proximaFecha}</p>
            </div>
            <button onclick="marcarRecordatorioPagado('${r.id}')"
                class="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider hover:bg-amber-400 transition-all active:scale-95">
                Pagado
            </button>
        </div>`).join('');
    cont.innerHTML = `
        <div class="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 border border-amber-500/30">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-amber-400 text-lg" style="font-variation-settings: 'FILL' 1">notification_important</span>
                <h2 class="text-amber-300 text-xs font-black uppercase tracking-widest">Pagos por hacer</h2>
                <span class="ml-auto px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black">${vencidos.length}</span>
            </div>
            <div class="space-y-2">${items}</div>
        </div>`;
}

function renderRecordatoriosList() {
    const cont = document.getElementById('admin-recordatorios-list');
    if (!cont) return;
    if (_recState.recordatorios.length === 0) {
        cont.innerHTML = `<div class="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]"><p class="text-white/40 text-xs text-center">Sin recordatorios. Agregá el arriendo, servicios, etc.</p></div>`;
        return;
    }
    const freqLabel = (f) => (RecordatoriosService.FRECUENCIAS[f]?.label) || f;
    cont.innerHTML = _recState.recordatorios
        .sort((a, b) => (a.proximaFecha || '').localeCompare(b.proximaFecha || ''))
        .map(r => `
        <div class="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div class="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-primary text-sm" style="font-variation-settings: 'FILL' 1">event_repeat</span>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-white text-sm font-bold truncate">${_recEsc(r.nombre)}${r.monto ? ` · ${_recFmtCOP(r.monto)}` : ''}</p>
                <p class="text-white/40 text-[11px] truncate">${_recSedeNombre(r.sedeId)} · ${freqLabel(r.frecuencia)} · próx. ${r.proximaFecha}</p>
            </div>
            <button onclick="openRecordatorioModal('${r.id}')" class="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:border-primary/40 transition-all active:scale-90" title="Editar">
                <span class="material-symbols-outlined text-white/60 text-base hover:text-primary">edit</span>
            </button>
            <button onclick="deleteRecordatorio('${r.id}')" class="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:border-red-500/40 transition-all active:scale-90" title="Eliminar">
                <span class="material-symbols-outlined text-white/60 text-base hover:text-red-400">delete</span>
            </button>
        </div>`).join('');
}

function openRecordatorioModal(id) {
    const rec = id ? _recState.recordatorios.find(r => r.id === id) : null;
    const existing = document.getElementById('recordatorio-overlay');
    if (existing) existing.remove();
    const sedeOpts = _recState.sedes.map(s => `<option value="${s.id}" ${rec && rec.sedeId === s.id ? 'selected' : ''}>${_recEsc(s.nombre)}</option>`).join('');
    const FR = RecordatoriosService.FRECUENCIAS;
    const freqOpts = Object.keys(FR).map(k => `<option value="${k}" ${rec && rec.frecuencia === k ? 'selected' : ''}>${FR[k].label}</option>`).join('');
    const html = `
    <div id="recordatorio-overlay" class="barber-modal-overlay" style="z-index:160">
        <div class="barber-modal">
            <div class="barber-modal-header">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-primary text-xl" style="font-variation-settings: 'FILL' 1">event_repeat</span>
                    </div>
                    <h2 class="text-lg font-black text-white truncate">${rec ? 'Editar recordatorio' : 'Nuevo recordatorio'}</h2>
                </div>
                <button onclick="closeRecordatorioModal()" class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/20 transition-all active:scale-90">
                    <span class="material-symbols-outlined text-white/60 text-lg">close</span>
                </button>
            </div>
            <div class="barber-modal-body">
                <input type="hidden" id="rec-id" value="${rec ? rec.id : ''}">
                <div class="barber-form-section">
                    <div class="barber-form-label"><span class="material-symbols-outlined text-primary text-sm">label</span><span>Nombre del pago</span></div>
                    <input type="text" id="rec-nombre" maxlength="80" placeholder="Ej: Arriendo" value="${rec ? _recEsc(rec.nombre) : ''}" class="barber-form-input">
                </div>
                <div class="barber-form-section">
                    <div class="barber-form-label"><span class="material-symbols-outlined text-primary text-sm">storefront</span><span>Sede</span></div>
                    <select id="rec-sede" class="barber-form-select"><option value="">Seleccionar sede...</option>${sedeOpts}</select>
                </div>
                <div class="barber-form-section">
                    <div class="barber-form-label"><span class="material-symbols-outlined text-primary text-sm">payments</span><span>Monto (opcional)</span></div>
                    <input type="number" id="rec-monto" inputmode="numeric" min="0" placeholder="0" value="${rec && rec.monto != null ? rec.monto : ''}" class="barber-form-input">
                </div>
                <div class="barber-form-section">
                    <div class="barber-form-label"><span class="material-symbols-outlined text-primary text-sm">repeat</span><span>Frecuencia</span></div>
                    <select id="rec-frecuencia" class="barber-form-select">${freqOpts}</select>
                </div>
                <div class="barber-form-section">
                    <div class="barber-form-label"><span class="material-symbols-outlined text-primary text-sm">event</span><span>Próximo pago</span></div>
                    <input type="date" id="rec-fecha" value="${rec ? rec.proximaFecha : _recTodayISO()}" class="barber-form-input">
                </div>
            </div>
            <div class="barber-modal-footer">
                <button onclick="closeRecordatorioModal()" class="flex-1 px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">Cancelar</button>
                <button id="rec-submit" onclick="submitRecordatorio()" class="flex-[2] px-5 py-3.5 rounded-xl bg-primary text-black text-sm font-black uppercase tracking-wider hover:bg-primary-light transition-all active:scale-[0.97]">Guardar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    requestAnimationFrame(() => document.getElementById('recordatorio-overlay')?.classList.add('visible'));
}

function closeRecordatorioModal() {
    const ov = document.getElementById('recordatorio-overlay');
    if (ov) { ov.classList.remove('visible'); setTimeout(() => ov.remove(), 250); }
}

async function submitRecordatorio() {
    const id = document.getElementById('rec-id')?.value || '';
    const nombre = (document.getElementById('rec-nombre')?.value || '').trim();
    const sedeId = document.getElementById('rec-sede')?.value || '';
    const montoRaw = document.getElementById('rec-monto')?.value;
    const frecuencia = document.getElementById('rec-frecuencia')?.value || '';
    const proximaFecha = document.getElementById('rec-fecha')?.value || '';
    if (!nombre) { if (typeof window.showToast === 'function') window.showToast('Escribí el nombre del pago', 'error'); return; }
    if (!sedeId) { if (typeof window.showToast === 'function') window.showToast('Elegí una sede', 'error'); return; }
    if (!proximaFecha) { if (typeof window.showToast === 'function') window.showToast('Elegí la fecha del próximo pago', 'error'); return; }
    const monto = (montoRaw === '' || montoRaw == null) ? null : Number(montoRaw) || 0;
    const user = (typeof roleManager !== 'undefined') ? roleManager.currentUser : null;
    let ok;
    if (id) {
        ok = await RecordatoriosService.update(id, { nombre, sedeId, monto, frecuencia, proximaFecha });
    } else {
        ok = await RecordatoriosService.create({ nombre, sedeId, monto, frecuencia, proximaFecha, createdBy: user?.uid || null, createdByNombre: user?.displayName || '' });
    }
    if (!ok) { if (typeof window.showToast === 'function') window.showToast('No se pudo guardar', 'error'); return; }
    if (typeof window.showToast === 'function') window.showToast('Recordatorio guardado ✓', 'success');
    closeRecordatorioModal();
    loadAdminRecordatorios();
}

async function marcarRecordatorioPagado(id) {
    const rec = _recState.recordatorios.find(r => r.id === id);
    if (!rec) return;
    const ok = await RecordatoriosService.marcarPagado(rec);
    if (!ok) { if (typeof window.showToast === 'function') window.showToast('No se pudo actualizar', 'error'); return; }
    if (typeof window.showToast === 'function') window.showToast(`"${rec.nombre}" marcado como pagado ✓`, 'success');
    loadAdminRecordatorios();
}

// H1: abre un mini-modal de confirmación antes de borrar (no borra de una).
function deleteRecordatorio(id) {
    const rec = _recState.recordatorios.find(r => r.id === id);
    if (!rec) return;
    const existing = document.getElementById('rec-del-overlay');
    if (existing) existing.remove();
    const html = `
    <div id="rec-del-overlay" class="barber-modal-overlay" style="z-index:170">
        <div class="barber-modal" style="max-width:380px">
            <div class="barber-modal-body" style="text-align:center; padding-top:1.5rem">
                <div class="w-12 h-12 mx-auto rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center mb-3">
                    <span class="material-symbols-outlined text-red-400 text-2xl" style="font-variation-settings: 'FILL' 1">delete</span>
                </div>
                <h2 class="text-white text-lg font-black mb-1">¿Eliminar recordatorio?</h2>
                <p class="text-white/55 text-sm">Se quitará "<b class="text-white">${_recEsc(rec.nombre)}</b>". No se puede deshacer.</p>
            </div>
            <div class="barber-modal-footer">
                <button onclick="closeDeleteRecordatorio()" class="flex-1 px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-[0.97]">Cancelar</button>
                <button onclick="confirmDeleteRecordatorio('${id}')" class="flex-1 px-5 py-3.5 rounded-xl bg-red-500 text-white text-sm font-black uppercase tracking-wider hover:bg-red-400 transition-all active:scale-[0.97]">Eliminar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    requestAnimationFrame(() => document.getElementById('rec-del-overlay')?.classList.add('visible'));
}

function closeDeleteRecordatorio() {
    const ov = document.getElementById('rec-del-overlay');
    if (ov) { ov.classList.remove('visible'); setTimeout(() => ov.remove(), 250); }
}

async function confirmDeleteRecordatorio(id) {
    const ok = await RecordatoriosService.remove(id);
    closeDeleteRecordatorio();
    if (!ok) { if (typeof window.showToast === 'function') window.showToast('No se pudo eliminar', 'error'); return; }
    if (typeof window.showToast === 'function') window.showToast('Recordatorio eliminado', 'success');
    loadAdminRecordatorios();
}

window.loadAdminRecordatorios = loadAdminRecordatorios;
window.openRecordatorioModal = openRecordatorioModal;
window.closeRecordatorioModal = closeRecordatorioModal;
window.submitRecordatorio = submitRecordatorio;
window.marcarRecordatorioPagado = marcarRecordatorioPagado;
window.deleteRecordatorio = deleteRecordatorio;
window.closeDeleteRecordatorio = closeDeleteRecordatorio;
window.confirmDeleteRecordatorio = confirmDeleteRecordatorio;
