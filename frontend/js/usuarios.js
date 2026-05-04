let todosLosUsuarios = [];

// ── CARGAR TABLA ──────────────────────────────────────
async function cargarUsuarios() {
    mostrarSkeleton("cuerpoTabla", 9);
    try {
        const res = await fetch(`${API_URL}/usuarios`);
        todosLosUsuarios = await res.json();
        renderizarTabla(todosLosUsuarios);
    } catch (error) {
        document.getElementById("cuerpoTabla").innerHTML =
            `<tr><td colspan="9" class="text-center text-danger">
             ❌ Error conectando al servidor</td></tr>`;
        toast("Error conectando al servidor", "error");
    }
}

function renderizarTabla(usuarios) {
    const tbody = document.getElementById("cuerpoTabla");

    if (usuarios.length === 0) {
        tbody.innerHTML = `<tr>
            <td colspan="9" class="text-center">No hay usuarios registrados</td>
        </tr>`;
        return;
    }

    tbody.innerHTML = usuarios.map(u => `
        <tr>
            <td>${u.id}</td>
            <td>${u.nombre}</td>
            <td>${u.documento}</td>
            <td>${u.telefono || "—"}</td>
            <td>${u.correo || "—"}</td>
            <td>${u.cargo || "—"}</td>
            <td>${u.area || "—"}</td>
            <td>
                <span class="badge ${u.estado ? 'badge-success' : 'badge-danger'}">
                    ${u.estado ? '✅ Activo' : '⛔ Inactivo'}
                </span>
            </td>
            <td class="acciones">
                <button class="btn btn-sm btn-warning"
                        onclick="abrirEditar(${u.id})">✏️ Editar</button>
                <button class="btn btn-sm ${u.estado ? 'btn-danger' : 'btn-success'}"
                        onclick="toggleEstado(${u.id}, '${u.nombre.replace(/'/g, "\\'")}', ${u.estado})">
                    ${u.estado ? '🚫 Desactivar' : '✅ Activar'}
                </button>
            </td>
        </tr>
    `).join("");
}

// ── BUSCADOR ──────────────────────────────────────────
function filtrarUsuarios() {
    const texto = document.getElementById("buscador").value.toLowerCase();
    const filtrados = todosLosUsuarios.filter(u =>
        u.nombre.toLowerCase().includes(texto) ||
        u.documento.toLowerCase().includes(texto)
    );
    renderizarTabla(filtrados);
}

// ── MODAL ─────────────────────────────────────────────
function abrirModal() {
    document.getElementById("modalTitulo").textContent = "Nuevo Usuario";
    document.getElementById("formUsuario").reset();
    document.getElementById("usuarioId").value = "";
    document.getElementById("modalOverlay").classList.add("active");
}

function cerrarModal() {
    document.getElementById("modalOverlay").classList.remove("active");
}

async function abrirEditar(id) {
    const res = await fetch(`${API_URL}/usuarios/${id}`);
    const u   = await res.json();

    document.getElementById("modalTitulo").textContent = "Editar Usuario";
    document.getElementById("usuarioId").value = u.id;
    document.getElementById("nombre").value    = u.nombre;
    document.getElementById("documento").value = u.documento;
    document.getElementById("telefono").value  = u.telefono || "";
    document.getElementById("correo").value    = u.correo   || "";
    document.getElementById("cargo").value     = u.cargo    || "";
    document.getElementById("area").value      = u.area     || "";

    document.getElementById("modalOverlay").classList.add("active");
}

// ── GUARDAR ───────────────────────────────────────────
document.getElementById("formUsuario").addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("usuarioId").value;
    const datos = {
        nombre:    document.getElementById("nombre").value,
        documento: document.getElementById("documento").value,
        telefono:  document.getElementById("telefono").value,
        correo:    document.getElementById("correo").value,
        cargo:     document.getElementById("cargo").value,
        area:      document.getElementById("area").value,
    };

    const url    = id ? `${API_URL}/usuarios/${id}` : `${API_URL}/usuarios`;
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
        toast(id ? "Usuario actualizado correctamente" : "Usuario creado correctamente", "success");
        cargarUsuarios();

    } catch (error) {
        toast("Error al guardar: " + error.message, "error");
    }
});

// ── ACTIVAR / DESACTIVAR ──────────────────────────────
async function toggleEstado(id, nombre, estadoActual) {
    const accion = estadoActual ? "desactivar" : "activar";
    confirmar({
        icono:   estadoActual ? "🚫" : "✅",
        titulo:  `${estadoActual ? "Desactivar" : "Activar"} usuario`,
        texto:   `¿Seguro que deseas ${accion} a ${nombre}?`,
        labelOk: estadoActual ? "Desactivar" : "Activar",
        colorOk: estadoActual ? "btn-danger" : "btn-success",
        onOk:    async () => {
            try {
                const res = await fetch(`${API_URL}/usuarios/${id}/estado`, {
                    method: "PATCH"
                });
                if (!res.ok) {
                    const err = await res.json();
                    toast(err.detail, "error");
                    return;
                }
                const data = await res.json();
                toast(data.mensaje, "success");
                cargarUsuarios();
            } catch {
                toast("Error al cambiar estado", "error");
            }
        }
    });
}

// ── INICIAR ───────────────────────────────────────────
cargarUsuarios();