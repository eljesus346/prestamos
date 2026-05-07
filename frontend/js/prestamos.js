let todosPrestamos    = [];
let prestamosActuales = [];
let paginaActual      = 1;
const POR_PAGINA      = 15;

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

// ── CARGAR TABLA ──────────────────────────────────────
async function cargarPrestamos() {
    mostrarSkeleton("cuerpoTabla", 10);
    try {
        const res = await fetch(`${API_URL}/prestamos/detalle/todos`);
        todosPrestamos    = await res.json();
        prestamosActuales = todosPrestamos;
        paginaActual      = 1;
        renderizarTabla(todosPrestamos);
    } catch (error) {
        document.getElementById("cuerpoTabla").innerHTML =
            `<tr><td colspan="10" class="text-center text-danger">
             ❌ Error conectando al servidor</td></tr>`;
        toast("Error conectando al servidor", "error");
    }
}

function renderizarTabla(prestamos) {
    const tbody    = document.getElementById("cuerpoTabla");
    const total    = prestamos.length;
    const totalPag = Math.ceil(total / POR_PAGINA);

    if (total === 0) {
        tbody.innerHTML = `<tr>
            <td colspan="10" class="text-center">No hay préstamos registrados</td>
        </tr>`;
        renderizarPaginacion(0, 0);
        return;
    }

    const inicio = (paginaActual - 1) * POR_PAGINA;
    const fin    = inicio + POR_PAGINA;
    const pagina = prestamos.slice(inicio, fin);

    tbody.innerHTML = pagina.map(p => {
        const activo   = ["prestado","asignado","atrasado"].includes(p.estado);
        const fecha    = new Date(p.fecha_prestamo).toLocaleDateString("es-CO");
        const fechaEst = p.fecha_devolucion_estimada
            ? new Date(p.fecha_devolucion_estimada + "T00:00:00").toLocaleDateString("es-CO")
            : "—";

        // Código interno con fallback a serial
        const codigoEquipo = p.equipo_codigo_interno || p.equipo_serial || "—";

        const colFirmas = `
            <div style="display:flex;gap:4px;flex-direction:column">
                ${p.firma
                    ? `<button class="btn btn-sm btn-secondary"
                               onclick="verFirma('${p.firma}', 'Firma de Entrega')">
                               ✍️ Entrega</button>`
                    : `<span class="text-muted" style="font-size:0.75rem">Sin firma entrega</span>`
                }
                ${p.firma_devolucion
                    ? `<button class="btn btn-sm btn-success"
                               onclick="verFirma('${p.firma_devolucion}', 'Firma de Devolución')">
                               ✅ Devolución</button>`
                    : `<span class="text-muted" style="font-size:0.75rem">Sin firma devolución</span>`
                }
            </div>`;

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
            <td>${fecha}</td>
            <td>${fechaEst}</td>
            <td>${estadoBadge[p.estado] || p.estado}</td>
            <td>${colFirmas}</td>
            <td class="acciones">
                ${activo
                    ? `<button class="btn btn-sm btn-success"
                               onclick="abrirDevolucion(${p.id},
                               '${p.usuario_nombre.replace(/'/g, "\\'")}',
                               '${p.equipo_nombre.replace(/'/g, "\\'")}')">
                               ✅ Devolver</button>`
                    : ""
                }
                <button class="btn btn-sm btn-pdf"
                        onclick="descargarPDF(${p.id})">📄 PDF</button>
                <select class="select-estado"
                        onchange="cambiarEstado(${p.id}, this.value)">
                    <option value="">Estado...</option>
                    <option value="asignado">🟡 Asignado</option>
                    <option value="prestado">🔵 Prestado</option>
                    <option value="devuelto">🟢 Devuelto</option>
                    <option value="atrasado">🔴 Atrasado</option>
                    <option value="dañado">⚠️ Dañado</option>
                    <option value="perdido">❌ Perdido</option>
                </select>
            </td>
        </tr>`;
    }).join("");

    renderizarPaginacion(total, totalPag);
}

// ── PAGINACIÓN ────────────────────────────────────────
function renderizarPaginacion(total, totalPag) {
    let contenedor = document.getElementById("paginacionPrestamos");
    if (!contenedor) {
        contenedor = document.createElement("div");
        contenedor.id = "paginacionPrestamos";
        document.querySelector(".card").appendChild(contenedor);
    }

    if (totalPag <= 1) { contenedor.innerHTML = ""; return; }

    const inicio = (paginaActual - 1) * POR_PAGINA + 1;
    const fin    = Math.min(paginaActual * POR_PAGINA, total);

    let html = `
        <p class="paginacion-info">Mostrando ${inicio}–${fin} de ${total} préstamos</p>
        <div class="paginacion">
            <button onclick="irPagina(1)" ${paginaActual === 1 ? "disabled" : ""}>«</button>
            <button onclick="irPagina(${paginaActual - 1})"
                    ${paginaActual === 1 ? "disabled" : ""}>‹</button>`;

    for (let i = 1; i <= totalPag; i++) {
        if (totalPag > 7 && i > 2 && i < totalPag - 1 &&
            Math.abs(i - paginaActual) > 1) {
            if (i === 3 || i === totalPag - 2) html += `<button disabled>…</button>`;
            continue;
        }
        html += `<button class="${i === paginaActual ? 'activa' : ''}"
                         onclick="irPagina(${i})">${i}</button>`;
    }

    html += `
            <button onclick="irPagina(${paginaActual + 1})"
                    ${paginaActual === totalPag ? "disabled" : ""}>›</button>
            <button onclick="irPagina(${totalPag})"
                    ${paginaActual === totalPag ? "disabled" : ""}>»</button>
        </div>`;

    contenedor.innerHTML = html;
}

function irPagina(num) {
    paginaActual = num;
    renderizarTabla(prestamosActuales);
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── FILTROS ───────────────────────────────────────────
function filtrarPrestamos() {
    const texto  = document.getElementById("buscador").value.toLowerCase();
    const estado = document.getElementById("filtroEstado").value;

    prestamosActuales = todosPrestamos.filter(p => {
        const coincideTexto  = p.usuario_nombre.toLowerCase().includes(texto) ||
                               p.equipo_nombre.toLowerCase().includes(texto);
        const coincideEstado = estado ? p.estado === estado : true;
        return coincideTexto && coincideEstado;
    });

    paginaActual = 1;
    renderizarTabla(prestamosActuales);
}

// ══════════════════════════════════════════════════════
//  MODAL NUEVO PRÉSTAMO — lógica de tipos bloqueados
// ══════════════════════════════════════════════════════

// Guarda qué tipos ya tiene el usuario seleccionado
let tiposBloqueados      = [];
let _usuariosDisponibles = []; // lista completa de usuarios activos

async function cargarSelects() {
    // Cargar usuarios activos
    const resU     = await fetch(`${API_URL}/usuarios`);
    const usuarios = await resU.json();

    // Guardar solo activos para poder filtrar después
    _usuariosDisponibles = usuarios.filter(u => u.estado);

    // Limpiar buscador al abrir el modal
    const buscador = document.getElementById("buscadorUsuario");
    if (buscador) buscador.value = "";

    renderizarSelectUsuarios(_usuariosDisponibles);

    // Cargar equipos disponibles
    const resE    = await fetch(`${API_URL}/equipos/disponibles`);
    const equipos = await resE.json();
    window._equiposDisponibles = equipos;

    // Renderizar todos por defecto (sin usuario seleccionado aún)
    renderizarSelectEquipos(equipos, []);
}

// Renderiza el select de usuarios con la lista recibida
function renderizarSelectUsuarios(lista) {
    const selU = document.getElementById("id_usuario");
    selU.innerHTML = '<option value="">Selecciona un usuario...</option>';
    lista.forEach(u => {
        selU.innerHTML += `<option value="${u.id}">${u.nombre} — ${u.documento}</option>`;
    });
}

// Filtra el select de usuarios según lo escrito en el buscador
function filtrarUsuariosModal() {
    const texto     = document.getElementById("buscadorUsuario").value.toLowerCase();
    const filtrados = _usuariosDisponibles.filter(u =>
        u.nombre.toLowerCase().includes(texto) ||
        u.documento.toLowerCase().includes(texto)
    );
    renderizarSelectUsuarios(filtrados);

    // Si el usuario seleccionado ya no aparece en la lista filtrada, limpiar aviso
    const selU = document.getElementById("id_usuario");
    if (!selU.value) onUsuarioCambio();
}

// Actualiza el select de equipos marcando/ocultando los bloqueados
function renderizarSelectEquipos(equipos, bloqueados) {
    const selE = document.getElementById("id_equipo");
    const tiposBloq = bloqueados.map(b => b.tipo);

    selE.innerHTML = '<option value="">Selecciona un equipo...</option>';

    // Agrupar: primero disponibles, luego bloqueados al final
    const disponibles   = equipos.filter(e => !tiposBloq.includes(e.tipo));
    const noDisponibles = equipos.filter(e =>  tiposBloq.includes(e.tipo));

    if (disponibles.length > 0) {
        const grupo = document.createElement("optgroup");
        grupo.label = "✅ Disponibles para este usuario";
        disponibles.forEach(e => {
            const opt = document.createElement("option");
            opt.value = e.id;
            opt.textContent = `${tipoIcono[e.tipo] || "📦"} ${e.nombre} — ${e.serial}`;
            grupo.appendChild(opt);
        });
        selE.appendChild(grupo);
    }

    if (noDisponibles.length > 0) {
        const grupo = document.createElement("optgroup");
        grupo.label = "🚫 Bloqueados (ya tiene uno de este tipo)";
        noDisponibles.forEach(e => {
            const opt = document.createElement("option");
            opt.value = e.id;
            opt.textContent = `${tipoIcono[e.tipo] || "📦"} ${e.nombre} — ${e.serial} [BLOQUEADO]`;
            opt.disabled = true;
            opt.style.color = "#dc2626";
            grupo.appendChild(opt);
        });
        selE.appendChild(grupo);
    }
}

// Se llama cuando el usuario cambia en el select
async function onUsuarioCambio() {
    const idUsuario = document.getElementById("id_usuario").value;
    const avisoEl   = document.getElementById("avisoTiposBloqueados");

    // Limpiar aviso previo
    avisoEl.style.display = "none";
    avisoEl.innerHTML = "";
    tiposBloqueados = [];

    if (!idUsuario) {
        // Sin usuario: mostrar todos los equipos sin restricción
        renderizarSelectEquipos(window._equiposDisponibles || [], []);
        return;
    }

    try {
        const res  = await fetch(`${API_URL}/prestamos/usuario/${idUsuario}/tipos-bloqueados`);
        const data = await res.json();
        tiposBloqueados = data.bloqueados || [];

        // Actualizar el select de equipos
        renderizarSelectEquipos(window._equiposDisponibles || [], tiposBloqueados);

        // Mostrar aviso visual si hay tipos bloqueados
        if (tiposBloqueados.length > 0) {
            const lista = tiposBloqueados
                .map(b => {
                    const etiqueta = b.codigo_interno || b.equipo_serial;
                    return `<strong>${tipoIcono[b.tipo] || "📦"} ${b.tipo}</strong> — ${b.equipo_nombre} <code style="font-size:0.72rem">${etiqueta}</code>`;
                })
                .join(", ");
            avisoEl.innerHTML = `
                <span style="font-size:1rem">⚠️</span>
                <span>Este usuario ya tiene préstamo activo de: ${lista}.
                Debe devolverlo antes de pedir otro del mismo tipo.</span>`;
            avisoEl.style.display = "flex";
        }
    } catch {
        // Si falla, no bloqueamos nada — el backend igual lo valida
        renderizarSelectEquipos(window._equiposDisponibles || [], []);
    }
}

// ── MODAL NUEVO PRÉSTAMO ──────────────────────────────
function abrirModal() {
    document.getElementById("formPrestamo").reset();
    document.getElementById("prestamoId").value = "";
    tiposBloqueados = [];

    // Limpiar aviso
    const avisoEl = document.getElementById("avisoTiposBloqueados");
    if (avisoEl) { avisoEl.style.display = "none"; avisoEl.innerHTML = ""; }

    cargarSelects();
    iniciarFirma();
    document.getElementById("modalOverlay").classList.add("active");
}

function cerrarModal() {
    document.getElementById("modalOverlay").classList.remove("active");
}

// ── MODAL DEVOLUCIÓN ──────────────────────────────────
function abrirDevolucion(id, usuario, equipo) {
    document.getElementById("devUsuario").textContent     = usuario;
    document.getElementById("devEquipo").textContent      = equipo;
    document.getElementById("devId").value                = id;
    document.getElementById("devObservaciones").value     = "";
    document.getElementById("modalDevolucion").classList.add("active");
    iniciarFirmaDev();
}

function cerrarDevolucion() {
    document.getElementById("modalDevolucion").classList.remove("active");
}

async function confirmarDevolucion() {
    const id  = document.getElementById("devId").value;
    const obs = document.getElementById("devObservaciones").value.trim();

    const firmaDev = obtenerFirmaDev();
    if (!firmaDev) {
        toast("Por favor captura la firma de devolución", "warning");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/prestamos/${id}/devolver`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                observaciones:    obs || null,
                firma_devolucion: firmaDev,
            })
        });

        if (!res.ok) {
            const err = await res.json();
            toast(err.detail, "error");
            return;
        }

        cerrarDevolucion();
        toast("Devolución registrada correctamente", "success");
        cargarPrestamos();

    } catch {
        toast("Error al registrar devolución", "error");
    }
}

// ── GUARDAR PRÉSTAMO ──────────────────────────────────
document.getElementById("formPrestamo").addEventListener("submit", async (e) => {
    e.preventDefault();

    const firma = obtenerFirma();
    if (!firma) {
        toast("Por favor captura la firma del receptor", "warning");
        return;
    }

    // Validación extra en frontend antes de enviar
    const idEquipo  = parseInt(document.getElementById("id_equipo").value);
    const idUsuario = parseInt(document.getElementById("id_usuario").value);
    const equipoSel = (window._equiposDisponibles || []).find(e => e.id === idEquipo);

    if (equipoSel && tiposBloqueados.some(b => b.tipo === equipoSel.tipo)) {
        toast(
            `⚠️ Este usuario ya tiene un "${equipoSel.tipo}" prestado. Debe devolverlo primero.`,
            "error",
            5000
        );
        return;
    }

    const datos = {
        id_usuario:                idUsuario,
        id_equipo:                 idEquipo,
        fecha_devolucion_estimada: document.getElementById("fecha_devolucion_estimada").value || null,
        observaciones:             document.getElementById("observaciones").value,
        firma,
    };

    try {
        const res = await fetch(`${API_URL}/prestamos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos)
        });

        if (!res.ok) {
            const err = await res.json();
            toast(err.detail, "error", 5000);
            return;
        }

        cerrarModal();
        toast("Préstamo registrado correctamente", "success");
        cargarPrestamos();

    } catch (error) {
        toast("Error al guardar: " + error.message, "error");
    }
});

// ── CAMBIAR ESTADO ────────────────────────────────────
async function cambiarEstado(id, estado) {
    if (!estado) return;

    confirmar({
        icono:   "🔄",
        titulo:  "Cambiar estado",
        texto:   `¿Cambiar el estado de este préstamo a "${estado}"?`,
        labelOk: "Sí, cambiar",
        colorOk: "btn-primary",
        onOk: async () => {
            try {
                const res = await fetch(
                    `${API_URL}/prestamos/${id}/estado?estado=${estado}`,
                    { method: "PATCH" }
                );
                if (!res.ok) {
                    const err = await res.json();
                    toast(err.detail, "error");
                    return;
                }
                toast(`Estado actualizado a "${estado}"`, "success");
                cargarPrestamos();
            } catch {
                toast("Error al cambiar estado", "error");
            }
        }
    });
}

// ── VER FIRMA ─────────────────────────────────────────
function verFirma(base64, titulo = "Firma") {
    document.getElementById("firmaModalTitulo").textContent = `✍️ ${titulo}`;
    document.getElementById("imagenFirma").src = base64;
    document.getElementById("modalFirma").classList.add("active");
}

function cerrarFirma() {
    document.getElementById("modalFirma").classList.remove("active");
}

// ══════════════════════════════════════════════════════
//  FIRMA DE ENTREGA
// ══════════════════════════════════════════════════════
let canvas, ctx, dibujando = false;

function iniciarFirma() {
    canvas = document.getElementById("firmaCanvas");
    ctx    = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";

    canvas.onmousedown  = (e) => { dibujando = true; ctx.beginPath(); mover(e); };
    canvas.onmousemove  = (e) => { if (dibujando) mover(e); };
    canvas.onmouseup    = ()  => { dibujando = false; };
    canvas.onmouseleave = ()  => { dibujando = false; };
    canvas.ontouchstart = (e) => { e.preventDefault(); dibujando = true; ctx.beginPath(); moverTouch(e); };
    canvas.ontouchmove  = (e) => { e.preventDefault(); if (dibujando) moverTouch(e); };
    canvas.ontouchend   = ()  => { dibujando = false; };
}

function mover(e) {
    const r = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
}

function moverTouch(e) {
    const r     = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    ctx.lineTo(touch.clientX - r.left, touch.clientY - r.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(touch.clientX - r.left, touch.clientY - r.top);
}

function limpiarFirma() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function obtenerFirma() {
    const pixeles = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!pixeles.some(p => p !== 0)) return null;
    return canvas.toDataURL("image/png");
}

// ══════════════════════════════════════════════════════
//  FIRMA DE DEVOLUCIÓN
// ══════════════════════════════════════════════════════
let canvasDev, ctxDev, dibujandoDev = false;

function iniciarFirmaDev() {
    canvasDev = document.getElementById("firmaDevCanvas");
    ctxDev    = canvasDev.getContext("2d");
    ctxDev.clearRect(0, 0, canvasDev.width, canvasDev.height);
    ctxDev.strokeStyle = "#1e293b";
    ctxDev.lineWidth   = 2.5;
    ctxDev.lineCap     = "round";
    ctxDev.lineJoin    = "round";

    canvasDev.onmousedown  = (e) => { dibujandoDev = true; ctxDev.beginPath(); moverDev(e); };
    canvasDev.onmousemove  = (e) => { if (dibujandoDev) moverDev(e); };
    canvasDev.onmouseup    = ()  => { dibujandoDev = false; };
    canvasDev.onmouseleave = ()  => { dibujandoDev = false; };
    canvasDev.ontouchstart = (e) => {
        e.preventDefault();
        dibujandoDev = true;
        ctxDev.beginPath();
        moverTouchDev(e);
    };
    canvasDev.ontouchmove = (e) => {
        e.preventDefault();
        if (dibujandoDev) moverTouchDev(e);
    };
    canvasDev.ontouchend = () => { dibujandoDev = false; };
}

function moverDev(e) {
    const r = canvasDev.getBoundingClientRect();
    ctxDev.lineTo(e.clientX - r.left, e.clientY - r.top);
    ctxDev.stroke();
    ctxDev.beginPath();
    ctxDev.moveTo(e.clientX - r.left, e.clientY - r.top);
}

function moverTouchDev(e) {
    const r     = canvasDev.getBoundingClientRect();
    const touch = e.touches[0];
    ctxDev.lineTo(touch.clientX - r.left, touch.clientY - r.top);
    ctxDev.stroke();
    ctxDev.beginPath();
    ctxDev.moveTo(touch.clientX - r.left, touch.clientY - r.top);
}

function limpiarFirmaDev() {
    ctxDev.clearRect(0, 0, canvasDev.width, canvasDev.height);
}

function obtenerFirmaDev() {
    const pixeles = ctxDev.getImageData(0, 0, canvasDev.width, canvasDev.height).data;
    if (!pixeles.some(p => p !== 0)) return null;
    return canvasDev.toDataURL("image/png");
}

// ── DESCARGAR PDF ─────────────────────────────────────
function descargarPDF(id) {
    window.open(`${API_URL}/pdf/${id}`, "_blank");
}

// ── INICIAR ───────────────────────────────────────────
cargarPrestamos();