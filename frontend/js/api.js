// URL automática: usa la misma IP desde donde se cargó la página
const API_URL = `http://${window.location.hostname}:8001`;

// ── TOASTS ────────────────────────────────────────────
function toast(mensaje, tipo = "success", duracion = 3500) {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }
    const iconos = { success:"✅", error:"❌", warning:"⚠️", info:"ℹ️" };
    const t = document.createElement("div");
    t.className = `toast toast-${tipo}`;
    t.innerHTML = `<span>${iconos[tipo] || "💬"}</span><span>${mensaje}</span>`;
    container.appendChild(t);
    setTimeout(() => {
        t.style.animation = "slideOut 0.3s ease forwards";
        setTimeout(() => t.remove(), 300);
    }, duracion);
}

// ── MODAL DE CONFIRMACIÓN ─────────────────────────────
function confirmar({ icono = "⚠️", titulo, texto, labelOk = "Confirmar",
                     colorOk = "btn-danger", onOk }) {
    // Reutiliza o crea el modal
    let overlay = document.getElementById("modalConfirm");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "modalConfirm";
        overlay.className = "modal-overlay";
        overlay.innerHTML = `
            <div class="modal" style="max-width:400px">
                <div class="modal-confirm-body">
                    <div class="modal-confirm-icono" id="confirmIcono"></div>
                    <div class="modal-confirm-titulo" id="confirmTitulo"></div>
                    <div class="modal-confirm-texto"  id="confirmTexto"></div>
                </div>
                <div class="modal-footer" style="padding:16px 24px 24px">
                    <button class="btn btn-secondary"
                            onclick="cerrarConfirm()">Cancelar</button>
                    <button class="btn" id="confirmBtn"
                            onclick="ejecutarConfirm()">Confirmar</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
    }

    document.getElementById("confirmIcono").textContent  = icono;
    document.getElementById("confirmTitulo").textContent = titulo;
    document.getElementById("confirmTexto").textContent  = texto || "";
    const btn = document.getElementById("confirmBtn");
    btn.textContent = labelOk;
    btn.className   = `btn ${colorOk}`;
    overlay._onOk   = onOk;
    overlay.classList.add("active");
}

function cerrarConfirm() {
    document.getElementById("modalConfirm")?.classList.remove("active");
}

function ejecutarConfirm() {
    const overlay = document.getElementById("modalConfirm");
    cerrarConfirm();
    overlay?._onOk?.();
}

// ── SKELETON LOADING ──────────────────────────────────
function mostrarSkeleton(tbodyId, cols, filas = 6) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = Array.from({ length: filas }).map(() => `
        <tr class="skeleton-row">
            ${Array.from({ length: cols }).map((_, i) => `
                <td>
                    <div class="skeleton skeleton-line ${
                        i === 0 ? 'short' : i === cols - 1 ? 'short' : 'medium'
                    }"></div>
                </td>`).join("")}
        </tr>`).join("");
}

// ── MODO OSCURO ───────────────────────────────────────
function initDarkMode() {
    const guardado = localStorage.getItem("darkMode") === "true";
    if (guardado) document.body.classList.add("dark");

    // Crear toggle si no existe
    const navbar = document.querySelector(".navbar");
    if (navbar && !document.getElementById("darkToggle")) {
        const btn = document.createElement("button");
        btn.id        = "darkToggle";
        btn.className = "dark-toggle";
        btn.title     = "Modo oscuro";
        btn.textContent = guardado ? "☀️" : "🌙";
        btn.onclick   = toggleDark;
        navbar.appendChild(btn);
    }
}

function toggleDark() {
    const isDark = document.body.classList.toggle("dark");
    localStorage.setItem("darkMode", isDark);
    document.getElementById("darkToggle").textContent = isDark ? "☀️" : "🌙";
}

// ── BÚSQUEDA GLOBAL ───────────────────────────────────
function initBusquedaGlobal() {
    const navbar = document.querySelector(".navbar-links");
    if (!navbar || document.getElementById("globalSearchWrap")) return;

    const wrap = document.createElement("div");
    wrap.className = "navbar-search";
    wrap.id        = "globalSearchWrap";
    wrap.innerHTML = `
        <span class="navbar-search-icon">🔍</span>
        <input type="text" id="globalSearch"
               placeholder="Buscar usuarios, equipos, préstamos..."
               autocomplete="off">
        <div class="search-global-results" id="globalResults"></div>`;
    navbar.parentNode.insertBefore(wrap, navbar);

    const input   = document.getElementById("globalSearch");
    const results = document.getElementById("globalResults");
    let timeout;

    input.addEventListener("input", () => {
        clearTimeout(timeout);
        const q = input.value.trim();
        if (q.length < 2) { results.classList.remove("visible"); return; }
        results.innerHTML = `<div class="search-loading">Buscando...</div>`;
        results.classList.add("visible");
        timeout = setTimeout(() => buscarGlobal(q), 350);
    });

    // Cerrar al hacer clic fuera
    document.addEventListener("click", (e) => {
        if (!wrap.contains(e.target)) results.classList.remove("visible");
    });

    input.addEventListener("focus", () => {
        if (input.value.trim().length >= 2) results.classList.add("visible");
    });
}

async function buscarGlobal(q) {
    const results = document.getElementById("globalResults");
    const colores = {
        prestado:"#2563eb", asignado:"#ca8a04", devuelto:"#16a34a",
        atrasado:"#dc2626", "dañado":"#dc2626", perdido:"#dc2626"
    };

    try {
        const [resU, resE, resH] = await Promise.all([
            fetch(`${API_URL}/usuarios`),
            fetch(`${API_URL}/equipos`),
            fetch(`${API_URL}/historial/buscar?q=${encodeURIComponent(q)}`)
        ]);
        const usuarios  = await resU.json();
        const equipos   = await resE.json();
        const historial = await resH.json();

        const qq = q.toLowerCase();
        const uFiltrados = usuarios.filter(u =>
            u.nombre.toLowerCase().includes(qq) ||
            u.documento.toLowerCase().includes(qq)
        ).slice(0, 4);

        const eFiltrados = equipos.filter(e =>
            e.nombre.toLowerCase().includes(qq) ||
            e.serial.toLowerCase().includes(qq)
        ).slice(0, 4);

        const hFiltrados = historial.slice(0, 4);

        if (!uFiltrados.length && !eFiltrados.length && !hFiltrados.length) {
            results.innerHTML = `<div class="search-empty">Sin resultados para "${q}"</div>`;
            return;
        }

        let html = "";

        if (uFiltrados.length) {
            html += `<div class="search-result-group">
                <div class="search-result-group-title">👤 Usuarios</div>
                ${uFiltrados.map(u => `
                    <a class="search-result-item" href="usuarios.html">
                        <span class="search-result-icono">👤</span>
                        <div class="search-result-info">
                            <div class="search-result-titulo">${u.nombre}</div>
                            <div class="search-result-sub">${u.documento} · ${u.cargo || "—"}</div>
                        </div>
                        <span class="search-result-badge">
                            <span class="badge ${u.estado ? 'badge-success' : 'badge-danger'}">
                                ${u.estado ? 'Activo' : 'Inactivo'}
                            </span>
                        </span>
                    </a>`).join("")}
            </div>`;
        }

        if (eFiltrados.length) {
            const tipoIcono = { laptop:"💻", mouse:"🖱️", teclado:"⌨️", diadema:"🎧", otro:"📦" };
            html += `<div class="search-result-group">
                <div class="search-result-group-title">💻 Equipos</div>
                ${eFiltrados.map(e => `
                    <a class="search-result-item" href="equipos.html">
                        <span class="search-result-icono">${tipoIcono[e.tipo] || "📦"}</span>
                        <div class="search-result-info">
                            <div class="search-result-titulo">${e.nombre}</div>
                            <div class="search-result-sub">${e.serial} · ${e.tipo}</div>
                        </div>
                        <span class="search-result-badge">
                            <span class="badge ${e.estado === 'disponible'
                                ? 'badge-success' : e.estado === 'prestado'
                                ? 'badge-info' : 'badge-danger'}">
                                ${e.estado}
                            </span>
                        </span>
                    </a>`).join("")}
            </div>`;
        }

        if (hFiltrados.length) {
            html += `<div class="search-result-group">
                <div class="search-result-group-title">🔄 Préstamos</div>
                ${hFiltrados.map(p => `
                    <a class="search-result-item" href="prestamos.html">
                        <span class="search-result-icono">🔄</span>
                        <div class="search-result-info">
                            <div class="search-result-titulo">${p.usuario_nombre} → ${p.equipo_nombre}</div>
                            <div class="search-result-sub">
                                ${new Date(p.fecha_prestamo).toLocaleDateString("es-CO")}
                            </div>
                        </div>
                        <span class="search-result-badge">
                            <span style="font-size:0.75rem;font-weight:600;
                                         color:${colores[p.estado] || '#333'}">
                                ${p.estado}
                            </span>
                        </span>
                    </a>`).join("")}
            </div>`;
        }

        results.innerHTML = html;

    } catch (err) {
        results.innerHTML = `<div class="search-empty">Error al buscar</div>`;
    }
}

// ── HISTORIAL RÁPIDO DE EQUIPO ────────────────────────
async function verHistorialEquipo(id, nombre) {
    let overlay = document.getElementById("modalHistEquipo");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id        = "modalHistEquipo";
        overlay.className = "modal-overlay";
        overlay.innerHTML = `
            <div class="modal" style="max-width:520px;max-height:85vh;
                                      display:flex;flex-direction:column">
                <div class="modal-header">
                    <h2 id="histEquipoTitulo">Historial del equipo</h2>
                    <button class="modal-close"
                            onclick="document.getElementById('modalHistEquipo')
                                     .classList.remove('active')">✕</button>
                </div>
                <div class="modal-body" id="histEquipoCuerpo"
                     style="overflow-y:auto;flex:1">
                    <p class="text-muted text-center">Cargando...</p>
                </div>
            </div>`;
        document.body.appendChild(overlay);
    }

    document.getElementById("histEquipoTitulo").textContent = `📋 ${nombre}`;
    document.getElementById("histEquipoCuerpo").innerHTML =
        `<p class="text-muted text-center">Cargando...</p>`;
    overlay.classList.add("active");

    try {
        const res  = await fetch(`${API_URL}/historial/equipo/${id}`);
        const data = await res.json();
        const cuerpo = document.getElementById("histEquipoCuerpo");

        if (!data.prestamos.length) {
            cuerpo.innerHTML = `<p class="text-muted text-center">
                Sin préstamos registrados</p>`;
            return;
        }

        const colDot = {
            prestado:"#2563eb", asignado:"#ca8a04", devuelto:"#16a34a",
            atrasado:"#dc2626", "dañado":"#dc2626", perdido:"#dc2626"
        };

        cuerpo.innerHTML = data.prestamos.map(p => {
            const fp  = new Date(p.fecha_prestamo).toLocaleDateString("es-CO");
            const fdr = p.fecha_devolucion_real !== "—"
                ? new Date(p.fecha_devolucion_real).toLocaleDateString("es-CO")
                : null;
            return `
            <div class="hist-item">
                <div class="hist-dot"
                     style="background:${colDot[p.estado] || '#94a3b8'}"></div>
                <div class="hist-info">
                    <div class="hist-usuario">${p.usuario_nombre}
                        <span class="text-muted" style="font-weight:400">
                            · ${p.usuario_documento}
                        </span>
                    </div>
                    <div class="hist-fecha">
                        📅 ${fp}
                        ${fdr ? `→ devuelto ${fdr}` : "→ aún no devuelto"}
                    </div>
                </div>
                <span class="hist-estado-txt"
                      style="color:${colDot[p.estado] || '#94a3b8'}">
                    ${p.estado}
                </span>
            </div>`;
        }).join("");

    } catch {
        document.getElementById("histEquipoCuerpo").innerHTML =
            `<p class="text-danger text-center">Error al cargar historial</p>`;
    }
}

// ── INICIALIZAR TODO ──────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    initDarkMode();
    initBusquedaGlobal();
});