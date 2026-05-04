let historialCompleto = [];

const estadoBadge = {
    asignado: '<span class="badge badge-warning">🟡 Asignado</span>',
    prestado: '<span class="badge badge-info">🔵 Prestado</span>',
    devuelto: '<span class="badge badge-success">🟢 Devuelto</span>',
    atrasado: '<span class="badge badge-danger">🔴 Atrasado</span>',
    "dañado": '<span class="badge badge-danger">⚠️ Dañado</span>',
    perdido:  '<span class="badge badge-danger">❌ Perdido</span>',
};

const tipoIcono = {
    laptop:"💻", mouse:"🖱️", teclado:"⌨️", diadema:"🎧", otro:"📦"
};

// ══════════════════════════════════════════════════════
//  TABS
// ══════════════════════════════════════════════════════
function cambiarTab(nombre) {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));

    document.querySelector(`[onclick="cambiarTab('${nombre}')"]`).classList.add("active");
    document.getElementById(`tab-${nombre}`).classList.add("active");

    if (nombre === "usuario") cargarSelectUsuarios();
    if (nombre === "equipo")  cargarSelectEquipos();
}

// ══════════════════════════════════════════════════════
//  TAB 1 — HISTORIAL COMPLETO
// ══════════════════════════════════════════════════════
async function cargarHistorialCompleto() {
    try {
        const res = await fetch(`${API_URL}/historial`);
        historialCompleto = await res.json();
        renderizarCompleto(historialCompleto);
    } catch (error) {
        document.getElementById("cuerpoCompleto").innerHTML =
            `<tr><td colspan="11" class="text-center text-danger">
             ❌ Error conectando al servidor</td></tr>`;
    }
}

function renderizarCompleto(lista) {
    const tbody = document.getElementById("cuerpoCompleto");

    if (lista.length === 0) {
        tbody.innerHTML = `<tr>
            <td colspan="11" class="text-center">No hay registros en el historial</td>
        </tr>`;
        return;
    }

    tbody.innerHTML = lista.map(p => {
        const fp  = new Date(p.fecha_prestamo).toLocaleDateString("es-CO");
        const fde = p.fecha_devolucion_estimada !== "—"
            ? new Date(p.fecha_devolucion_estimada + "T00:00:00").toLocaleDateString("es-CO")
            : "—";
        const fdr = p.fecha_devolucion_real !== "—"
            ? new Date(p.fecha_devolucion_real).toLocaleDateString("es-CO")
            : "—";

        const codigoEquipo = p.equipo_codigo_interno || p.equipo_serial || "—";

        return `
        <tr>
            <td>${p.id}</td>
            <td>
                <strong>${p.usuario_nombre}</strong><br>
                <small class="text-muted">${p.usuario_documento}</small>
            </td>
            <td>${p.equipo_nombre}</td>
            <td>${tipoIcono[p.equipo_tipo] || "📦"} ${p.equipo_tipo || "—"}</td>
            <td>
                <span style="font-size:0.8rem; font-family:monospace; opacity:0.8">
                    ${codigoEquipo}
                </span>
            </td>
            <td>${fp}</td>
            <td>${fde}</td>
            <td>${fdr}</td>
            <td>${estadoBadge[p.estado] || p.estado}</td>
            <td class="text-center">
                ${p.firma
                    ? `<button class="btn btn-sm btn-secondary"
                               onclick="verFirma('${p.firma}')">👁️ Firma</button>`
                    : '<span class="text-muted">—</span>'
                }
            </td>
            <td class="text-center">
                <button class="btn btn-sm btn-pdf"
                        onclick="descargarPDF(${p.id})">📄 PDF</button>
            </td>
        </tr>`;
    }).join("");
}

// Búsqueda en tiempo real → llama al backend
let timeoutBuscar;
function buscarHistorial() {
    clearTimeout(timeoutBuscar);
    timeoutBuscar = setTimeout(async () => {
        const q = document.getElementById("buscadorCompleto").value.trim();
        if (q.length === 0) {
            renderizarCompleto(historialCompleto);
            return;
        }
        const res  = await fetch(`${API_URL}/historial/buscar?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        renderizarCompleto(data);
    }, 400);
}

function filtrarCompleto() {
    const estado = document.getElementById("filtroEstadoCompleto").value;
    const filtrados = estado
        ? historialCompleto.filter(p => p.estado === estado)
        : historialCompleto;
    renderizarCompleto(filtrados);
}

// ══════════════════════════════════════════════════════
//  TAB 2 — POR USUARIO
// ══════════════════════════════════════════════════════
async function cargarSelectUsuarios() {
    const res      = await fetch(`${API_URL}/usuarios`);
    const usuarios = await res.json();
    const sel      = document.getElementById("selectUsuario");

    sel.innerHTML = '<option value="">Selecciona un usuario...</option>';
    usuarios.forEach(u => {
        sel.innerHTML +=
            `<option value="${u.id}">${u.nombre} — ${u.documento}</option>`;
    });
}

async function cargarHistorialUsuario() {
    const id = document.getElementById("selectUsuario").value;
    if (!id) { alert("Selecciona un usuario primero"); return; }

    const res  = await fetch(`${API_URL}/historial/usuario/${id}`);
    const data = await res.json();

    // Info del usuario
    const infoDiv = document.getElementById("infoUsuario");
    infoDiv.style.display = "flex";
    infoDiv.innerHTML = `
        <div class="info-item">
            <span class="info-label">👤 Nombre</span>
            <span class="info-valor">${data.usuario.nombre}</span>
        </div>
        <div class="info-item">
            <span class="info-label">🪪 Documento</span>
            <span class="info-valor">${data.usuario.documento}</span>
        </div>
        <div class="info-item">
            <span class="info-label">💼 Cargo</span>
            <span class="info-valor">${data.usuario.cargo || "—"}</span>
        </div>
        <div class="info-item">
            <span class="info-label">🏢 Área</span>
            <span class="info-valor">${data.usuario.area || "—"}</span>
        </div>
        <div class="info-item">
            <span class="info-label">📦 Total préstamos</span>
            <span class="info-valor"
                  style="color:#3b82f6;font-weight:700">
                  ${data.total_prestamos}
            </span>
        </div>`;

    // Tabla
    document.getElementById("resultadoUsuario").style.display = "block";
    const tbody = document.getElementById("cuerpoUsuario");

    if (data.prestamos.length === 0) {
        tbody.innerHTML = `<tr>
            <td colspan="9" class="text-center">
                Este usuario no tiene préstamos registrados
            </td>
        </tr>`;
        return;
    }

    tbody.innerHTML = data.prestamos.map(p => {
        const fp  = new Date(p.fecha_prestamo).toLocaleDateString("es-CO");
        const fde = p.fecha_devolucion_estimada !== "—"
            ? new Date(p.fecha_devolucion_estimada + "T00:00:00").toLocaleDateString("es-CO")
            : "—";
        const fdr = p.fecha_devolucion_real !== "—"
            ? new Date(p.fecha_devolucion_real).toLocaleDateString("es-CO")
            : "—";

        return `
        <tr>
            <td>${p.id}</td>
            <td>${tipoIcono[p.equipo_tipo]||"📦"} ${p.equipo_nombre}</td>
            <td style="text-transform:capitalize">${p.equipo_tipo}</td>
            <td><code>${p.equipo_serial}</code></td>
            <td>${fp}</td>
            <td>${fde}</td>
            <td>${fdr}</td>
            <td>${estadoBadge[p.estado] || p.estado}</td>
            <td class="text-muted">${p.observaciones}</td>
        </tr>`;
    }).join("");
}

// ══════════════════════════════════════════════════════
//  TAB 3 — POR EQUIPO
// ══════════════════════════════════════════════════════
async function cargarSelectEquipos() {
    const res     = await fetch(`${API_URL}/equipos`);
    const equipos = await res.json();
    const sel     = document.getElementById("selectEquipo");

    sel.innerHTML = '<option value="">Selecciona un equipo...</option>';
    equipos.forEach(e => {
        sel.innerHTML +=
            `<option value="${e.id}">${tipoIcono[e.tipo]||"📦"} ${e.nombre} — ${e.serial}</option>`;
    });
}

async function cargarHistorialEquipo() {
    const id = document.getElementById("selectEquipo").value;
    if (!id) { alert("Selecciona un equipo primero"); return; }

    const res  = await fetch(`${API_URL}/historial/equipo/${id}`);
    const data = await res.json();

    // Info del equipo
    const infoDiv = document.getElementById("infoEquipo");
    infoDiv.style.display = "flex";
    infoDiv.innerHTML = `
        <div class="info-item">
            <span class="info-label">💻 Nombre</span>
            <span class="info-valor">${data.equipo.nombre}</span>
        </div>
        <div class="info-item">
            <span class="info-label">📦 Tipo</span>
            <span class="info-valor" style="text-transform:capitalize">
                ${tipoIcono[data.equipo.tipo]||""} ${data.equipo.tipo}
            </span>
        </div>
        <div class="info-item">
            <span class="info-label">🔑 Serial</span>
            <span class="info-valor"><code>${data.equipo.serial}</code></span>
        </div>
        <div class="info-item">
            <span class="info-label">🏷️ Código</span>
            <span class="info-valor">${data.equipo.codigo_interno || "—"}</span>
        </div>
        <div class="info-item">
            <span class="info-label">📊 Estado actual</span>
            <span class="info-valor">
                ${estadoBadge[data.equipo.estado] || data.equipo.estado}
            </span>
        </div>
        <div class="info-item">
            <span class="info-label">📦 Veces prestado</span>
            <span class="info-valor"
                  style="color:#3b82f6;font-weight:700">
                  ${data.total_prestamos}
            </span>
        </div>`;

    // Tabla
    document.getElementById("resultadoEquipo").style.display = "block";
    const tbody = document.getElementById("cuerpoEquipo");

    if (data.prestamos.length === 0) {
        tbody.innerHTML = `<tr>
            <td colspan="9" class="text-center">
                Este equipo no tiene préstamos registrados
            </td>
        </tr>`;
        return;
    }

    tbody.innerHTML = data.prestamos.map(p => {
        const fp  = new Date(p.fecha_prestamo).toLocaleDateString("es-CO");
        const fde = p.fecha_devolucion_estimada !== "—"
            ? new Date(p.fecha_devolucion_estimada + "T00:00:00").toLocaleDateString("es-CO")
            : "—";
        const fdr = p.fecha_devolucion_real !== "—"
            ? new Date(p.fecha_devolucion_real).toLocaleDateString("es-CO")
            : "—";

        return `
        <tr>
            <td>${p.id}</td>
            <td><strong>${p.usuario_nombre}</strong></td>
            <td>${p.usuario_documento}</td>
            <td>${p.usuario_cargo || "—"}</td>
            <td>${fp}</td>
            <td>${fde}</td>
            <td>${fdr}</td>
            <td>${estadoBadge[p.estado] || p.estado}</td>
            <td class="text-muted">${p.observaciones}</td>
        </tr>`;
    }).join("");
}

// ── VER FIRMA ─────────────────────────────────────────
function verFirma(base64) {
    document.getElementById("imagenFirma").src = base64;
    document.getElementById("modalFirma").classList.add("active");
}
function cerrarFirma() {
    document.getElementById("modalFirma").classList.remove("active");
}

// ── DESCARGAR PDF ─────────────────────────────────────
function descargarPDF(id) {
    window.open(`${API_URL}/pdf/${id}`, "_blank");
}

// ── INICIAR ───────────────────────────────────────────
cargarHistorialCompleto();