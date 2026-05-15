let todosLosEquipos = [];

const estadoBadge = {
    disponible:    '<span class="badge badge-success">✅ Disponible</span>',
    prestado:      '<span class="badge badge-info">🔵 Prestado</span>',
    "dañado":      '<span class="badge badge-danger">🔴 Dañado</span>',
    mantenimiento: '<span class="badge badge-warning">🔧 Mantenimiento</span>',
};

const tipoIcono = {
    laptop:"💻", mouse:"🖱️", teclado:"⌨️", diadema:"🎧", otro:"📦"
};

// ── CARGAR TABLA ──────────────────────────────────────
async function cargarEquipos() {
    mostrarSkeleton("cuerpoTabla", 8);
    try {
        const res = await fetch(`${API_URL}/equipos`);
        todosLosEquipos = await res.json();
        renderizarTabla(todosLosEquipos);
        actualizarContadores(todosLosEquipos);
    } catch (error) {
        document.getElementById("cuerpoTabla").innerHTML =
            `<tr><td colspan="8" class="text-center text-danger">
             ❌ Error conectando al servidor</td></tr>`;
        toast("Error conectando al servidor", "error");
    }
}

function renderizarTabla(equipos) {
    const tbody = document.getElementById("cuerpoTabla");

    if (equipos.length === 0) {
        tbody.innerHTML = `<tr>
            <td colspan="8" class="text-center">No hay equipos registrados</td>
        </tr>`;
        return;
    }

    tbody.innerHTML = equipos.map(e => `
        <tr>
            <td>${e.id}</td>
            <td>
                <div class="equipo-nombre-cell">
                    ${e.foto
                        ? `<img src="${e.foto}" class="equipo-thumb"
                                onclick="verFotoEquipo('${e.foto}', '${e.nombre.replace(/'/g, "\\'")}')">`
                        : `<div class="equipo-thumb-placeholder">${tipoIcono[e.tipo] || "📦"}</div>`
                    }
                    <span>${tipoIcono[e.tipo] || "📦"} ${e.nombre}</span>
                </div>
            </td>
            <td style="text-transform:capitalize">${e.tipo}</td>
            <td><code>${e.serial}</code></td>
            <td>${e.codigo_interno || "—"}</td>
            <td>${estadoBadge[e.estado] || e.estado}</td>
            <td class="text-muted">${e.observaciones || "—"}</td>
            <td class="acciones">
                <button class="btn btn-sm btn-secondary"
                        onclick="verHistorialEquipo(${e.id}, '${e.nombre.replace(/'/g, "\\'")}')">
                        📋 Historial</button>
                <button class="btn btn-sm btn-secondary"
                        onclick="descargarQR(${e.id}, '${e.serial}')">🔲 QR</button>
                <button class="btn btn-sm btn-warning"
                        onclick="abrirEditar(${e.id})">✏️ Editar</button>
                <button class="btn btn-sm btn-danger"
                        onclick="eliminar(${e.id})">🗑️ Eliminar</button>

                <!-- ══ BOTONES MANTENIMIENTO ══ -->
                <button class="btn-mant"
                        onclick="abrirModalMantenimiento(${JSON.stringify(e).replace(/"/g, '&quot;')})">
                    🔧 Mantenimiento
                </button>
                <button class="btn-hist-mant"
                        onclick="abrirHistorialMantenimiento(${JSON.stringify(e).replace(/"/g, '&quot;')})">
                    📋 Historial Mant.
                </button>

                <select class="select-estado"
                        onchange="cambiarEstadoEquipo(${e.id}, this.value)">
                    <option value="">Estado...</option>
                    <option value="disponible"    ${e.estado === "disponible"    ? "selected" : ""}>✅ Disponible</option>
                    <option value="prestado"      ${e.estado === "prestado"      ? "selected" : ""}>🔵 Prestado</option>
                    <option value="dañado"        ${e.estado === "dañado"        ? "selected" : ""}>🔴 Dañado</option>
                    <option value="mantenimiento" ${e.estado === "mantenimiento" ? "selected" : ""}>🔧 Mantenimiento</option>
                </select>
            </td>
        </tr>
    `).join("");
}

// ── CONTADORES ────────────────────────────────────────
function actualizarContadores(equipos) {
    document.getElementById("cntDisponible").textContent =
        equipos.filter(e => e.estado === "disponible").length;
    document.getElementById("cntPrestado").textContent =
        equipos.filter(e => e.estado === "prestado").length;
    document.getElementById("cntDanado").textContent =
        equipos.filter(e => e.estado === "dañado").length;
    document.getElementById("cntMantenimiento").textContent =
        equipos.filter(e => e.estado === "mantenimiento").length;
}

// ── FILTROS ───────────────────────────────────────────
function filtrarEquipos() {
    const texto  = document.getElementById("buscador").value.toLowerCase();
    const estado = document.getElementById("filtroEstado").value;
    const tipo   = document.getElementById("filtroTipo").value;

    const filtrados = todosLosEquipos.filter(e => {
        const coincideTexto  = e.nombre.toLowerCase().includes(texto) ||
                               e.serial.toLowerCase().includes(texto);
        const coincideEstado = estado ? e.estado === estado : true;
        const coincideTipo   = tipo   ? e.tipo   === tipo   : true;
        return coincideTexto && coincideEstado && coincideTipo;
    });

    renderizarTabla(filtrados);
}

// ── MODAL ─────────────────────────────────────────────
function abrirModal() {
    document.getElementById("modalTitulo").textContent = "Nuevo Equipo";
    document.getElementById("formEquipo").reset();
    document.getElementById("equipoId").value = "";
    quitarFoto();
    document.getElementById("modalOverlay").classList.add("active");
}

function cerrarModal() {
    document.getElementById("modalOverlay").classList.remove("active");
}

async function abrirEditar(id) {
    const res = await fetch(`${API_URL}/equipos/${id}`);
    const e   = await res.json();

    document.getElementById("modalTitulo").textContent   = "Editar Equipo";
    document.getElementById("equipoId").value            = e.id;
    document.getElementById("nombre").value              = e.nombre;
    document.getElementById("tipo").value                = e.tipo;
    document.getElementById("serial").value              = e.serial;
    document.getElementById("codigo_interno").value      = e.codigo_interno || "";
    document.getElementById("observaciones").value       = e.observaciones  || "";

    if (e.foto) {
        mostrarFotoPreview(e.foto);
    } else {
        quitarFoto();
    }

    document.getElementById("modalOverlay").classList.add("active");
}

// ── GUARDAR ───────────────────────────────────────────
document.getElementById("formEquipo").addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("equipoId").value;

    const fotoPreview = document.getElementById("fotoPreview");
    const foto = fotoPreview.style.display !== "none" ? fotoPreview.src : null;

    const datos = {
        nombre:         document.getElementById("nombre").value,
        tipo:           document.getElementById("tipo").value,
        serial:         document.getElementById("serial").value,
        codigo_interno: document.getElementById("codigo_interno").value,
        observaciones:  document.getElementById("observaciones").value,
        foto:           foto,
    };

    const url    = id ? `${API_URL}/equipos/${id}` : `${API_URL}/equipos`;
    const method = id ? "PUT" : "POST";

    try {
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos)
        });

        if (!res.ok) {
            const err = await res.json();
            toast(err.detail, "error", 5000);
            return;
        }

        cerrarModal();
        toast(id ? "Equipo actualizado correctamente" : "Equipo registrado correctamente", "success");
        cargarEquipos();

    } catch (error) {
        toast("Error al guardar: " + error.message, "error");
    }
});

// ── CAMBIAR ESTADO ────────────────────────────────────
async function cambiarEstadoEquipo(id, estado) {
    if (!estado) return;

    confirmar({
        icono:   "🔄",
        titulo:  "Cambiar estado",
        texto:   `¿Cambiar el estado del equipo a "${estado}"?`,
        labelOk: "Sí, cambiar",
        colorOk: "btn-primary",
        onOk:    async () => {
            try {
                const res = await fetch(
                    `${API_URL}/equipos/${id}/estado?estado=${encodeURIComponent(estado)}`,
                    { method: "PATCH" }
                );
                if (!res.ok) {
                    const err = await res.json();
                    toast(err.detail, "error");
                    cargarEquipos();
                    return;
                }
                const data = await res.json();
                toast(data.mensaje, "success");
                cargarEquipos();
            } catch {
                toast("Error al cambiar estado", "error");
                cargarEquipos();
            }
        }
    });
}

// ── ELIMINAR ──────────────────────────────────────────
async function eliminar(id) {
    const equipo = todosLosEquipos.find(e => e.id === id);
    confirmar({
        icono:   "🗑️",
        titulo:  "Eliminar equipo",
        texto:   `¿Seguro que deseas eliminar "${equipo?.nombre}"? Esta acción no se puede deshacer.`,
        labelOk: "Sí, eliminar",
        colorOk: "btn-danger",
        onOk:    async () => {
            try {
                const res = await fetch(`${API_URL}/equipos/${id}`, { method: "DELETE" });
                if (!res.ok) {
                    const err = await res.json();
                    toast(err.detail, "error", 6000);
                    return;
                }
                const data = await res.json();
                toast(data.mensaje, "success");
                cargarEquipos();
            } catch {
                toast("Error al eliminar", "error");
            }
        }
    });
}

// ── DESCARGAR QR ──────────────────────────────────────
function descargarQR(id, serial) {
    window.open(`${API_URL}/qr/${id}`, "_blank");
    toast(`Generando QR para ${serial}...`, "info");
}

// ── FOTO: PREVISUALIZAR ───────────────────────────────
function previsualizarFoto(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;

    if (archivo.size > 2 * 1024 * 1024) {
        toast("La foto no puede pesar más de 2MB", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        mostrarFotoPreview(e.target.result);
    };
    reader.readAsDataURL(archivo);
}

function mostrarFotoPreview(src) {
    document.getElementById("fotoPlaceholder").style.display = "none";
    const preview = document.getElementById("fotoPreview");
    preview.src   = src;
    preview.style.display = "block";
    document.getElementById("btnQuitarFoto").style.display = "inline-flex";
}

function quitarFoto() {
    document.getElementById("fotoPlaceholder").style.display = "flex";
    const preview = document.getElementById("fotoPreview");
    preview.src   = "";
    preview.style.display = "none";
    document.getElementById("btnQuitarFoto").style.display = "none";
    document.getElementById("fotoInput").value = "";
}

// ── VER FOTO EN GRANDE ────────────────────────────────
function verFotoEquipo(src, nombre) {
    document.getElementById("fotoModalImg").src = src;
    document.getElementById("fotoModalNombre").textContent = nombre;
    document.getElementById("modalFotoEquipo").classList.add("active");
}

function cerrarFotoModal() {
    document.getElementById("modalFotoEquipo").classList.remove("active");
}

// ── DESCARGAR REPORTE DIARIO EXCEL ───────────────────
async function descargarReporteEquipos() {
    const btn = document.getElementById("btnReporteEquipos");
    const textoOriginal = btn.innerHTML;

    btn.disabled  = true;
    btn.innerHTML = "⏳ Generando...";

    try {
        const res = await fetch(`${API_URL}/excel/equipos/reporte-diario`);

        if (!res.ok) throw new Error("Error al generar el reporte");

        const blob  = await res.blob();
        const url   = URL.createObjectURL(blob);
        const a     = document.createElement("a");
        const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, "");

        a.href     = url;
        a.download = `reporte_equipos_${fecha}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast("✅ Reporte descargado correctamente", "success");
    } catch (error) {
        toast("❌ Error al descargar el reporte: " + error.message, "error");
    } finally {
        btn.disabled  = false;
        btn.innerHTML = textoOriginal;
    }
}

// ── INICIAR ───────────────────────────────────────────
cargarEquipos();