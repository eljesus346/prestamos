/* ============================================================
   mantenimiento.js  –  Lógica de Mantenimiento de Equipos
   Sistema de Préstamos
   Fase 2: Integración con API real + fallback a localStorage
   ============================================================ */

/* ─────────────────────────────────────────────
   CONFIGURACIÓN DE API
   Ajusta BASE_URL según tu backend
───────────────────────────────────────────── */
const MANT_API = {
    BASE_URL: '/api',          // ← cambia esto por tu URL real, ej: 'https://tu-servidor.com/api'
    ENDPOINTS: {
        listar:  (equipoId) => `/mantenimientos?equipo_id=${equipoId}`,
        crear:   ()         => `/mantenimientos`,
        detalle: (id)       => `/mantenimientos/${id}`,
        eliminar:(id)       => `/mantenimientos/${id}`,
    }
};

/* ─────────────────────────────────────────────
   ESTADO GLOBAL
───────────────────────────────────────────── */
let equipoActivoMant = null;
let evidenciasBase64 = [];

/* ─────────────────────────────────────────────
   CAPA DE DATOS  (API → fallback localStorage)
───────────────────────────────────────────── */
const STORAGE_KEY = 'mantenimientos_equipos';

// ── localStorage helpers (fallback) ──
function _lsGetAll() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function _lsSaveAll(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

// ── API: obtener mantenimientos de un equipo ──
async function apiGetMantenimientos(equipoId) {
    try {
        const res = await fetch(MANT_API.BASE_URL + MANT_API.ENDPOINTS.listar(equipoId), {
            headers: _authHeaders()
        });
        if (!res.ok) throw new Error('API error ' + res.status);
        const data = await res.json();
        // Espera array en data.mantenimientos o data directamente
        return Array.isArray(data) ? data : (data.mantenimientos || data.data || []);
    } catch (err) {
        console.warn('[Mant] API no disponible, usando localStorage:', err.message);
        const all = _lsGetAll();
        return (all[equipoId] || []).sort((a,b) => new Date(b.fechaInicio) - new Date(a.fechaInicio));
    }
}

// ── API: guardar mantenimiento ──
async function apiCrearMantenimiento(registro) {
    try {
        const res = await fetch(MANT_API.BASE_URL + MANT_API.ENDPOINTS.crear(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ..._authHeaders() },
            body: JSON.stringify(registro)
        });
        if (!res.ok) throw new Error('API error ' + res.status);
        return await res.json();
    } catch (err) {
        console.warn('[Mant] API no disponible, guardando en localStorage:', err.message);
        const all = _lsGetAll();
        if (!all[registro.equipo.id]) all[registro.equipo.id] = [];
        all[registro.equipo.id].push(registro);
        _lsSaveAll(all);
        return registro;
    }
}

// ── API: eliminar mantenimiento ──
async function apiEliminarMantenimiento(mantId, equipoId) {
    try {
        const res = await fetch(MANT_API.BASE_URL + MANT_API.ENDPOINTS.eliminar(mantId), {
            method: 'DELETE',
            headers: _authHeaders()
        });
        if (!res.ok) throw new Error('API error ' + res.status);
        return true;
    } catch (err) {
        console.warn('[Mant] API no disponible, eliminando en localStorage:', err.message);
        const all = _lsGetAll();
        if (all[equipoId]) {
            all[equipoId] = all[equipoId].filter(r => r.id !== mantId);
            _lsSaveAll(all);
        }
        return true;
    }
}

// ── Token de autenticación (ajusta según tu sistema) ──
function _authHeaders() {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}


/* ─────────────────────────────────────────────
   ABRIR MODAL  –  FORMULARIO DE MANTENIMIENTO
───────────────────────────────────────────── */
function abrirModalMantenimiento(equipo) {
    equipoActivoMant = equipo;
    evidenciasBase64 = [];

    document.getElementById('mantNombreEquipo').textContent =
        `${equipo.nombre || 'Equipo'} — ${equipo.serial || ''}`;

    // Datos del equipo (solo lectura)
    document.getElementById('mantSerial').value  = equipo.serial         || '';
    document.getElementById('mantModelo').value  = equipo.nombre         || '';
    document.getElementById('mantCodigo').value  = equipo.codigo_interno || '';

    // Fecha inicio por defecto = ahora
    const ahora = new Date().toISOString().slice(0, 16);
    document.getElementById('mantFechaInicio').value = ahora;
    document.getElementById('mantFechaCierre').value = '';

    // Limpiar campos
    ['mantArea','mantEjecuta','mantVerifica','mantCargoEjecuta','mantCargoVerifica',
     'mantRam','mantProcesador','mantSo','mantUbicacion',
     'mantTrabajoRealizado','mantPlanMejora','mantRecursos','mantObsGenerales']
        .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });

    document.querySelectorAll('input[name="tipoMant"]').forEach(r => r.checked = false);
    document.querySelectorAll('.check-si, .check-no').forEach(cb => cb.checked = false);
    document.querySelectorAll('.check-resultado, .check-obs').forEach(inp => inp.value = '');

    // Exclusividad SI/NO en checklist
    _initChecklistExclusivos();

    actualizarGaleriaEvidencias();

    const ticket = 'TKT-' + Date.now().toString().slice(-6);
    document.getElementById('mantTicket').value = ticket;

    document.getElementById('modalMantenimiento').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function cerrarModalMantenimiento() {
    document.getElementById('modalMantenimiento').classList.remove('active');
    document.body.style.overflow = '';
    equipoActivoMant = null;
}

// Hace que SI y NO sean excluyentes dentro de cada fila
function _initChecklistExclusivos() {
    document.querySelectorAll('#tablaChecklist tbody tr').forEach(tr => {
        const si = tr.querySelector('.check-si');
        const no = tr.querySelector('.check-no');
        if (!si || !no) return;
        si.addEventListener('change', () => { if (si.checked) no.checked = false; });
        no.addEventListener('change', () => { if (no.checked) si.checked = false; });
    });
}


/* ─────────────────────────────────────────────
   EVIDENCIAS
───────────────────────────────────────────── */
function procesarEvidencias(event) {
    const files = Array.from(event.target.files);
    const MAX_MB = 5;
    files.forEach(file => {
        if (file.size > MAX_MB * 1024 * 1024) {
            alert(`"${file.name}" supera ${MAX_MB}MB y fue omitido.`);
            return;
        }
        const reader = new FileReader();
        reader.onload = e => {
            evidenciasBase64.push({
                nombre: file.name,
                tipo:   file.type,
                data:   e.target.result,
                fecha:  new Date().toISOString()
            });
            actualizarGaleriaEvidencias();
        };
        reader.readAsDataURL(file);
    });
    event.target.value = '';
}

function actualizarGaleriaEvidencias() {
    const galeria = document.getElementById('galeriaEvidencias');
    if (!galeria) return;
    if (evidenciasBase64.length === 0) {
        galeria.innerHTML = '<p class="ev-empty">Sin archivos adjuntos aún.</p>';
        return;
    }
    galeria.innerHTML = evidenciasBase64.map((ev, i) => {
        const esImg = ev.tipo.startsWith('image/');
        return `
        <div class="ev-item" id="ev-item-${i}">
            ${esImg
                ? `<img src="${ev.data}" alt="${ev.nombre}" class="ev-thumb"
                        onclick="verEvidenciaGrande(${i})">`
                : `<div class="ev-doc-icon">📄</div>`}
            <span class="ev-nombre" title="${ev.nombre}">${_truncar(ev.nombre, 18)}</span>
            <button class="ev-remove" onclick="quitarEvidencia(${i})" title="Eliminar">✕</button>
        </div>`;
    }).join('');
}

function quitarEvidencia(i) {
    evidenciasBase64.splice(i, 1);
    actualizarGaleriaEvidencias();
}

function verEvidenciaGrande(i) {
    const ev = evidenciasBase64[i];
    if (!ev) return;
    const win = window.open('', '_blank');
    win.document.write(`<html><body style="margin:0;background:#111">
        <img src="${ev.data}" style="max-width:100%;display:block;margin:auto">
        </body></html>`);
}


/* ─────────────────────────────────────────────
   LEER CHECKLIST
───────────────────────────────────────────── */
function leerChecklist() {
    const filas = document.querySelectorAll('#tablaChecklist tbody tr');
    return Array.from(filas).map(tr => ({
        actividad:   tr.dataset.actividad || '',
        realizado:   tr.querySelector('.check-si')?.checked ? 'SI'
                   : tr.querySelector('.check-no')?.checked ? 'NO' : '—',
        resultado:   tr.querySelector('.check-resultado')?.value?.trim() || '',
        observacion: tr.querySelector('.check-obs')?.value?.trim()       || ''
    }));
}


/* ─────────────────────────────────────────────
   GUARDAR FORMULARIO
───────────────────────────────────────────── */
async function guardarFormMantenimiento() {
    if (!equipoActivoMant) return;

    const tipoSeleccionado = document.querySelector('input[name="tipoMant"]:checked');
    if (!tipoSeleccionado) {
        alert('Por favor selecciona el tipo de mantenimiento.');
        return;
    }
    const fechaInicio = document.getElementById('mantFechaInicio').value;
    if (!fechaInicio) {
        alert('La fecha de inicio es obligatoria.');
        return;
    }
    const ejecuta = document.getElementById('mantEjecuta').value.trim();
    if (!ejecuta) {
        alert('El campo "Ejecuta" es obligatorio.');
        return;
    }

    const registro = {
        id:               'MANT-' + Date.now(),
        ticket:           document.getElementById('mantTicket').value,
        fechaInicio:      document.getElementById('mantFechaInicio').value,
        fechaCierre:      document.getElementById('mantFechaCierre').value,
        area:             document.getElementById('mantArea').value.trim(),
        ejecuta:          ejecuta,
        cargoEjecuta:     document.getElementById('mantCargoEjecuta').value.trim(),
        verifica:         document.getElementById('mantVerifica').value.trim(),
        cargoVerifica:    document.getElementById('mantCargoVerifica').value.trim(),
        tipoMantenimiento: tipoSeleccionado.value,
        equipo: {
            id:        equipoActivoMant.id,
            nombre:    equipoActivoMant.nombre,
            serial:    equipoActivoMant.serial,
            codigo:    equipoActivoMant.codigo_interno,
            ram:       document.getElementById('mantRam').value.trim(),
            procesador:document.getElementById('mantProcesador').value.trim(),
            so:        document.getElementById('mantSo').value.trim(),
            ubicacion: document.getElementById('mantUbicacion').value.trim(),
        },
        checklist:         leerChecklist(),
        trabajoRealizado:  document.getElementById('mantTrabajoRealizado').value.trim(),
        planMejora:        document.getElementById('mantPlanMejora').value.trim(),
        recursos:          document.getElementById('mantRecursos').value.trim(),
        observaciones:     document.getElementById('mantObsGenerales').value.trim(),
        evidencias:        evidenciasBase64,
        creadoEn:          new Date().toISOString()
    };

    // Mostrar indicador de carga
    const btnGuardar = document.querySelector('#modalMantenimiento .btn-primary');
    if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = '⏳ Guardando...'; }

    try {
        await apiCrearMantenimiento(registro);
        mostrarToast('✅ Mantenimiento registrado correctamente', 'success');
        cerrarModalMantenimiento();
    } catch (err) {
        mostrarToast('❌ Error al guardar: ' + err.message, 'error');
    } finally {
        if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = '💾 Guardar Mantenimiento'; }
    }
}


/* ─────────────────────────────────────────────
   MODAL HISTORIAL
───────────────────────────────────────────── */
function abrirHistorialMantenimiento(equipo) {
    equipoActivoMant = equipo;
    document.getElementById('historialNombreEquipo').textContent =
        `${equipo.nombre || 'Equipo'} — ${equipo.serial || ''}`;

    // Mostrar cargando
    document.getElementById('historialLista').innerHTML = `
        <div class="hist-empty">
            <span class="hist-empty-icon">⏳</span>
            <p>Cargando historial...</p>
        </div>`;

    document.getElementById('modalHistorialMant').classList.add('active');
    document.body.style.overflow = 'hidden';

    // Cargar datos async
    renderHistorial(equipo.id);
}

function cerrarHistorialMantenimiento() {
    document.getElementById('modalHistorialMant').classList.remove('active');
    document.body.style.overflow = '';
}

async function renderHistorial(equipoId) {
    const lista = await apiGetMantenimientos(equipoId);
    const cont  = document.getElementById('historialLista');

    if (!lista || lista.length === 0) {
        cont.innerHTML = `
            <div class="hist-empty">
                <span class="hist-empty-icon">🔧</span>
                <p>Este equipo no tiene registros de mantenimiento aún.</p>
            </div>`;
        return;
    }

    const badgeColor = { preventivo:'var(--color-green,#22c55e)', correctivo:'var(--color-red,#ef4444)', otro:'var(--color-yellow,#f59e0b)' };
    const badgeLabel = { preventivo:'Preventivo', correctivo:'Correctivo', otro:'Otro' };

    cont.innerHTML = lista.map(reg => {
        const color = badgeColor[reg.tipoMantenimiento] || '#3b82f6';
        const label = badgeLabel[reg.tipoMantenimiento] || reg.tipoMantenimiento;
        const nEv   = reg.evidencias?.length || 0;
        return `
        <div class="hist-card">
            <div class="hist-card-header">
                <div class="hist-info">
                    <span class="hist-ticket">${reg.ticket || reg.id}</span>
                    <span class="hist-fecha">📅 ${_formatFecha(reg.fechaInicio)}</span>
                    ${reg.fechaCierre ? `<span class="hist-fecha">→ ${_formatFecha(reg.fechaCierre)}</span>` : ''}
                </div>
                <span class="hist-badge" style="background:${color}20;color:${color};border:1px solid ${color}40">
                    ${label}
                </span>
            </div>
            <div class="hist-card-body">
                <div class="hist-meta">
                    <span>👤 <strong>${reg.ejecuta||'—'}</strong>${reg.cargoEjecuta?' · '+reg.cargoEjecuta:''}</span>
                    ${reg.area?`<span>🏢 ${reg.area}</span>`:''}
                </div>
                ${reg.trabajoRealizado?`<p class="hist-trabajo">${reg.trabajoRealizado}</p>`:''}
                <div class="hist-acciones">
                    <button class="btn btn-sm btn-secondary"
                            onclick="verDetalleMantenimiento('${reg.id}','${equipoId}')">
                        🔍 Ver detalle
                    </button>
                    ${nEv>0?`
                    <button class="btn btn-sm btn-secondary"
                            onclick="descargarEvidencias('${reg.id}','${equipoId}')">
                        📎 Evidencias (${nEv})
                    </button>`:''}
                    <button class="btn btn-sm btn-primary"
                            onclick="generarReporteMantenimiento('${reg.id}','${equipoId}')">
                        📄 Reporte PDF
                    </button>
                    <button class="btn btn-sm btn-danger"
                            onclick="eliminarMantenimiento('${reg.id}','${equipoId}')">
                        🗑️
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}


/* ─────────────────────────────────────────────
   VER DETALLE
───────────────────────────────────────────── */
async function verDetalleMantenimiento(mantId, equipoId) {
    const lista = await apiGetMantenimientos(equipoId);
    const reg   = lista.find(r => r.id === mantId);
    if (!reg) return;

    const checkHTML = (reg.checklist||[]).map(c => `
        <tr>
            <td>${c.actividad}</td>
            <td style="text-align:center;font-weight:700;color:${c.realizado==='SI'?'#22c55e':c.realizado==='NO'?'#ef4444':'#9ca3af'}">${c.realizado}</td>
            <td>${c.resultado||'—'}</td>
            <td>${c.observacion||'—'}</td>
        </tr>`).join('');

    const evHTML = (reg.evidencias||[]).map((ev,i) =>
        ev.tipo?.startsWith('image/')
            ? `<img src="${ev.data}" alt="${ev.nombre}"
                    style="height:80px;border-radius:6px;object-fit:cover;cursor:pointer;border:1px solid #e5e7eb"
                    onclick="verEvidenciaGrandeHistorial(${i},'${mantId}','${equipoId}')">`
            : `<a href="${ev.data}" download="${ev.nombre}" class="btn btn-sm btn-secondary">📄 ${ev.nombre}</a>`
    ).join('');

    document.getElementById('detalleContenido').innerHTML = `
        <div class="detalle-section">
            <h4>📋 Datos del Ticket</h4>
            <div class="detalle-grid">
                <div><label>Ticket</label><span>${reg.ticket||reg.id}</span></div>
                <div><label>Tipo</label><span>${reg.tipoMantenimiento}</span></div>
                <div><label>Inicio</label><span>${_formatFecha(reg.fechaInicio)}</span></div>
                <div><label>Cierre</label><span>${reg.fechaCierre?_formatFecha(reg.fechaCierre):'No definido'}</span></div>
                <div><label>Área</label><span>${reg.area||'—'}</span></div>
                <div><label>Ejecuta</label><span>${reg.ejecuta||'—'} ${reg.cargoEjecuta?'('+reg.cargoEjecuta+')':''}</span></div>
                <div><label>Verifica</label><span>${reg.verifica||'—'} ${reg.cargoVerifica?'('+reg.cargoVerifica+')':''}</span></div>
            </div>
        </div>
        <div class="detalle-section">
            <h4>💻 Información del Equipo</h4>
            <div class="detalle-grid">
                <div><label>Nombre</label><span>${reg.equipo?.nombre||'—'}</span></div>
                <div><label>Serial</label><span>${reg.equipo?.serial||'—'}</span></div>
                <div><label>Código</label><span>${reg.equipo?.codigo||'—'}</span></div>
                <div><label>RAM</label><span>${reg.equipo?.ram||'—'}</span></div>
                <div><label>Procesador</label><span>${reg.equipo?.procesador||'—'}</span></div>
                <div><label>SO</label><span>${reg.equipo?.so||'—'}</span></div>
                <div><label>Ubicación</label><span>${reg.equipo?.ubicacion||'—'}</span></div>
            </div>
        </div>
        ${checkHTML?`
        <div class="detalle-section">
            <h4>✅ Checklist de Actividades</h4>
            <div class="tabla-scroll">
                <table class="tabla" style="font-size:.85rem">
                    <thead><tr><th>Actividad</th><th>Realizado</th><th>Resultado</th><th>Observaciones</th></tr></thead>
                    <tbody>${checkHTML}</tbody>
                </table>
            </div>
        </div>`:''}
        ${reg.trabajoRealizado?`
        <div class="detalle-section">
            <h4>🔧 Trabajo Realizado</h4>
            <p style="white-space:pre-wrap;font-size:.85rem">${reg.trabajoRealizado}</p>
        </div>`:''}
        ${reg.planMejora?`
        <div class="detalle-section">
            <h4>📈 Plan de Mejora</h4>
            <p style="white-space:pre-wrap;font-size:.85rem">${reg.planMejora}</p>
        </div>`:''}
        ${reg.recursos?`
        <div class="detalle-section">
            <h4>🛠️ Recursos Utilizados</h4>
            <p style="font-size:.85rem">${reg.recursos}</p>
        </div>`:''}
        ${evHTML?`
        <div class="detalle-section">
            <h4>📎 Evidencias (${reg.evidencias.length})</h4>
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">${evHTML}</div>
        </div>`:''}
    `;

    window._evidenciasDetalle   = reg.evidencias || [];
    window._detalleEquipoId     = equipoId;
    window._detalleMantId       = mantId;

    document.getElementById('modalDetalleMantenimiento').classList.add('active');
}

function verEvidenciaGrandeHistorial(i) {
    const ev = (window._evidenciasDetalle||[])[i];
    if (!ev) return;
    const win = window.open('', '_blank');
    win.document.write(`<html><body style="margin:0;background:#111">
        <img src="${ev.data}" style="max-width:100%;display:block;margin:auto">
        </body></html>`);
}

function cerrarDetalleMantenimiento() {
    document.getElementById('modalDetalleMantenimiento').classList.remove('active');
}


/* ─────────────────────────────────────────────
   ELIMINAR MANTENIMIENTO
───────────────────────────────────────────── */
async function eliminarMantenimiento(mantId, equipoId) {
    if (!confirm('¿Eliminar este registro de mantenimiento? Esta acción no se puede deshacer.')) return;
    try {
        await apiEliminarMantenimiento(mantId, equipoId);
        mostrarToast('🗑️ Registro eliminado', 'warning');
        renderHistorial(equipoId);
    } catch(err) {
        mostrarToast('❌ Error al eliminar: ' + err.message, 'error');
    }
}


/* ─────────────────────────────────────────────
   DESCARGAR EVIDENCIAS
───────────────────────────────────────────── */
async function descargarEvidencias(mantId, equipoId) {
    const lista = await apiGetMantenimientos(equipoId);
    const reg   = lista.find(r => r.id === mantId);
    if (!reg || !reg.evidencias?.length) return;
    reg.evidencias.forEach(ev => {
        const a = document.createElement('a');
        a.href = ev.data; a.download = ev.nombre; a.click();
    });
}


/* ─────────────────────────────────────────────
   GENERAR REPORTE (HTML → Imprimir / PDF)
───────────────────────────────────────────── */
async function generarReporteMantenimiento(mantId, equipoId) {
    const lista = await apiGetMantenimientos(equipoId);
    const reg   = lista.find(r => r.id === mantId);
    if (!reg) return;

    const checkRows = (reg.checklist||[]).map(c => `
        <tr>
            <td>${c.actividad}</td>
            <td style="text-align:center">${c.realizado==='SI'?'✅':''}</td>
            <td style="text-align:center">${c.realizado==='NO'?'❌':''}</td>
            <td>${c.resultado||''}</td>
            <td>${c.observacion||''}</td>
        </tr>`).join('');

    const evImgs = (reg.evidencias||[])
        .filter(e=>e.tipo?.startsWith('image/'))
        .map(e=>`<img src="${e.data}" style="height:120px;object-fit:cover;border-radius:4px;border:1px solid #ddd">`).join('');

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Reporte ${reg.ticket}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;margin:30px;color:#222}
  h1{font-size:15px;text-align:center;color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:8px}
  h2{font-size:12px;background:#1e40af;color:#fff;padding:5px 10px;margin-top:18px}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th,td{border:1px solid #ccc;padding:5px 8px;text-align:left;font-size:11px}
  th{background:#e8f0fe;font-weight:700}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}
  .lbl{font-weight:700;color:#555;font-size:10px;display:block}
  .firmas{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:40px}
  .firma-box{border-top:1px solid #555;padding-top:8px;text-align:center;font-size:11px}
  @media print{.no-print{display:none}}
</style></head><body>
<button class="no-print" onclick="window.print()"
        style="float:right;padding:6px 16px;background:#1e40af;color:#fff;border:none;border-radius:6px;cursor:pointer;margin-bottom:10px">
    🖨️ Imprimir / Guardar PDF
</button>

<h1>REPORTE DE MANTENIMIENTO DE EQUIPO DE CÓMPUTO</h1>

<h2>📋 DATOS GENERALES DEL TICKET</h2>
<div class="grid">
  <div><span class="lbl">Ticket</span>${reg.ticket||reg.id}</div>
  <div><span class="lbl">Tipo de servicio</span>Mantenimiento ${reg.tipoMantenimiento}</div>
  <div><span class="lbl">Fecha inicio</span>${_formatFecha(reg.fechaInicio)}</div>
  <div><span class="lbl">Fecha cierre</span>${reg.fechaCierre?_formatFecha(reg.fechaCierre):'—'}</div>
  <div><span class="lbl">Área que recibe el servicio</span>${reg.area||'—'}</div>
  <div><span class="lbl">Sede</span>Sede Principal</div>
  <div><span class="lbl">Ejecuta</span>${reg.ejecuta||'—'} ${reg.cargoEjecuta?'('+reg.cargoEjecuta+')':''}</div>
  <div><span class="lbl">Verifica / Coordinador</span>${reg.verifica||'—'} ${reg.cargoVerifica?'('+reg.cargoVerifica+')':''}</div>
</div>

<h2>💻 INFORMACIÓN DEL EQUIPO</h2>
<div class="grid">
  <div><span class="lbl">Nombre / Modelo</span>${reg.equipo?.nombre||'—'}</div>
  <div><span class="lbl">Serial</span>${reg.equipo?.serial||'—'}</div>
  <div><span class="lbl">Código interno (etiqueta activo)</span>${reg.equipo?.codigo||'—'}</div>
  <div><span class="lbl">Ubicación</span>${reg.equipo?.ubicacion||'—'}</div>
  <div><span class="lbl">Memoria RAM</span>${reg.equipo?.ram||'—'}</div>
  <div><span class="lbl">Procesador</span>${reg.equipo?.procesador||'—'}</div>
  <div><span class="lbl">Sistema Operativo</span>${reg.equipo?.so||'—'}</div>
</div>

<h2>✅ CHECKLIST DE ACTIVIDADES REALIZADAS</h2>
<table>
  <thead>
    <tr>
      <th>Actividad</th>
      <th style="width:80px;text-align:center">Se realizó (SI)</th>
      <th style="width:80px;text-align:center">Se realizó (NO)</th>
      <th>Resultado</th>
      <th>Observaciones</th>
    </tr>
  </thead>
  <tbody>${checkRows}</tbody>
</table>

${reg.trabajoRealizado?`
<h2>🔧 TRABAJO REALIZADO / CAUSA</h2>
<p style="line-height:1.7">${reg.trabajoRealizado.replace(/\n/g,'<br>')}</p>`:''}

${reg.planMejora?`
<h2>📈 PLAN DE MEJORA Y OPTIMIZACIÓN</h2>
<p style="line-height:1.7">${reg.planMejora.replace(/\n/g,'<br>')}</p>`:''}

${reg.recursos?`
<h2>🛠️ RECURSOS UTILIZADOS</h2>
<p>${reg.recursos}</p>`:''}

${reg.observaciones?`
<h2>📝 OBSERVACIONES GENERALES</h2>
<p>${reg.observaciones}</p>`:''}

${evImgs?`
<h2>📎 EVIDENCIAS FOTOGRÁFICAS</h2>
<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">${evImgs}</div>`:''}

<div class="firmas">
  <div class="firma-box">
    <p><strong>${reg.ejecuta||'_______________________'}</strong></p>
    <p>${reg.cargoEjecuta||'Cargo'}</p>
    <p style="color:#888">Ejecutó el mantenimiento</p>
  </div>
  <div class="firma-box">
    <p><strong>${reg.verifica||'_______________________'}</strong></p>
    <p>${reg.cargoVerifica||'Cargo'}</p>
    <p style="color:#888">Verificó el mantenimiento</p>
  </div>
</div>

</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
}


/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
function mostrarToast(msg, tipo = 'success') {
    if (typeof window.showToast === 'function') { window.showToast(msg, tipo); return; }
    const colors = { success:'#22c55e', warning:'#f59e0b', error:'#ef4444', info:'#3b82f6' };
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
        position:'fixed', bottom:'24px', right:'24px', zIndex:'99999',
        background: colors[tipo] || colors.info,
        color:'#fff', padding:'12px 20px', borderRadius:'10px',
        boxShadow:'0 4px 16px rgba(0,0,0,.2)', fontWeight:'600',
        fontSize:'14px', transition:'opacity .4s'
    });
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
}


/* ─────────────────────────────────────────────
   UTILIDADES
───────────────────────────────────────────── */
function _formatFecha(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('es-CO', {
            day:'2-digit', month:'2-digit', year:'numeric',
            hour:'2-digit', minute:'2-digit', hour12:true
        });
    } catch { return iso; }
}

function _truncar(str, max) {
    return str.length > max ? str.slice(0, max) + '…' : str;
}


/* ─────────────────────────────────────────────
   EVENTOS GLOBALES
───────────────────────────────────────────── */
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    cerrarModalMantenimiento();
    cerrarHistorialMantenimiento();
    cerrarDetalleMantenimiento();
});

['modalMantenimiento','modalHistorialMant','modalDetalleMantenimiento'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', e => {
        if (e.target === el) {
            cerrarModalMantenimiento();
            cerrarHistorialMantenimiento();
            cerrarDetalleMantenimiento();
        }
    });
});