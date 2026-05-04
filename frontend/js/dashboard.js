const tipoIcono = {
    laptop:"💻", mouse:"🖱️", teclado:"⌨️", diadema:"🎧", otro:"📦"
};

const estadoBadge = {
    asignado: '<span class="badge badge-warning">🟡 Asignado</span>',
    prestado: '<span class="badge badge-info">🔵 Prestado</span>',
    atrasado: '<span class="badge badge-danger">🔴 Atrasado</span>',
};

// ── FECHA HOY ─────────────────────────────────────────
function mostrarFecha() {
    const hoy = new Date().toLocaleDateString("es-CO", {
        weekday: "long", year: "numeric",
        month: "long",   day: "numeric"
    });
    document.getElementById("fechaHoy").textContent = hoy;
}

// ── CARGAR DASHBOARD ──────────────────────────────────
async function cargarDashboard() {
    try {
        const [resDash, resPrestamos] = await Promise.all([
            fetch(`${API_URL}/dashboard`),
            fetch(`${API_URL}/historial`)
        ]);
        const data      = await resDash.json();
        const historial = await resPrestamos.json();

        // Stats principales
        document.getElementById("totalEquipos").textContent       = data.equipos.total;
        document.getElementById("equiposDisponibles").textContent = data.equipos.disponibles;
        document.getElementById("prestamosActivos").textContent   = data.prestamos.activos;
        document.getElementById("prestamosAtrasados").textContent = data.prestamos.atrasados;

        // Stats secundarias
        document.getElementById("usuariosActivos").textContent    = data.usuarios.activos;
        document.getElementById("totalPrestamos").textContent     = data.prestamos.total;
        document.getElementById("prestamosDevueltos").textContent = data.prestamos.devueltos;
        document.getElementById("equiposMant").textContent        = data.equipos.mantenimiento;

        // Secciones
        renderizarGrafica(data.equipos_por_tipo, data.equipos.total);
        renderizarGraficaMeses(historial);
        renderizarAlertas(data);
        renderizarActivos(data.lista_activos);
        renderizarAtrasados(data.lista_atrasados);
        renderizarUltimosMovimientos(historial);

    } catch (error) {
        console.error("Error cargando dashboard:", error);
        toast("Error al cargar el dashboard", "error");
    }
}

// ── GRÁFICA EQUIPOS POR TIPO ──────────────────────────
function renderizarGrafica(porTipo, total) {
    const container = document.getElementById("chartBars");
    const colores = {
        laptop:"#3b82f6", mouse:"#10b981",
        teclado:"#f59e0b", diadema:"#8b5cf6", otro:"#64748b"
    };

    container.innerHTML = Object.entries(porTipo).map(([tipo, cantidad]) => {
        const pct = total > 0 ? Math.round((cantidad / total) * 100) : 0;
        return `
        <div class="bar-row">
            <span class="bar-label">${tipoIcono[tipo] || "📦"} ${tipo}</span>
            <div class="bar-track">
                <div class="bar-fill"
                     style="width:${pct}%; background:${colores[tipo] || '#64748b'}">
                </div>
            </div>
            <span class="bar-num">${cantidad}</span>
        </div>`;
    }).join("");
}

// ── GRÁFICA PRÉSTAMOS POR MES ─────────────────────────
function renderizarGraficaMeses(historial) {
    const container = document.getElementById("chartMeses");
    if (!container) return;

    // Últimos 6 meses
    const meses = [];
    const ahora = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
        meses.push({
            key:    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
            label:  d.toLocaleDateString("es-CO", { month: "short", year: "numeric" }),
            count:  0
        });
    }

    historial.forEach(p => {
        const fecha = new Date(p.fecha_prestamo);
        const key   = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
        const mes   = meses.find(m => m.key === key);
        if (mes) mes.count++;
    });

    const max = Math.max(...meses.map(m => m.count), 1);

    container.innerHTML = meses.map(m => {
        const pct = Math.round((m.count / max) * 100);
        return `
        <div class="bar-row">
            <span class="bar-label" style="width:80px;font-size:0.78rem">${m.label}</span>
            <div class="bar-track">
                <div class="bar-fill" style="width:${pct}%; background:#3b82f6"></div>
            </div>
            <span class="bar-num">${m.count}</span>
        </div>`;
    }).join("");
}

// ── ALERTAS ───────────────────────────────────────────
function renderizarAlertas(data) {
    const container = document.getElementById("alertasContainer");
    const alertas   = [];

    if (data.prestamos.atrasados > 0) {
        alertas.push({ tipo:"danger",  icono:"🔴",
            texto:`${data.prestamos.atrasados} préstamo(s) atrasado(s) sin devolver` });
    }
    if (data.equipos.danados > 0) {
        alertas.push({ tipo:"warning", icono:"⚠️",
            texto:`${data.equipos.danados} equipo(s) marcado(s) como dañado(s)` });
    }
    if (data.equipos.mantenimiento > 0) {
        alertas.push({ tipo:"info",    icono:"🔧",
            texto:`${data.equipos.mantenimiento} equipo(s) en mantenimiento` });
    }
    if (data.equipos.disponibles === 0) {
        alertas.push({ tipo:"warning", icono:"📦",
            texto:"No hay equipos disponibles para prestar" });
    }

    if (alertas.length === 0) {
        container.innerHTML = `
            <div class="alerta-ok">
                <span style="font-size:2rem">🎉</span>
                <p>Todo en orden, sin alertas</p>
            </div>`;
        return;
    }

    container.innerHTML = alertas.map(a => `
        <div class="alerta-item alerta-${a.tipo}">
            <span class="alerta-icono">${a.icono}</span>
            <span>${a.texto}</span>
        </div>`).join("");
}

// ── TABLA ACTIVOS ─────────────────────────────────────
function renderizarActivos(lista) {
    const tbody = document.getElementById("cuerpoActivos");

    if (lista.length === 0) {
        tbody.innerHTML = `<tr>
            <td colspan="8" class="text-center">No hay préstamos activos 🎉</td>
        </tr>`;
        return;
    }

    tbody.innerHTML = lista.map(p => {
        const fecha    = new Date(p.fecha_prestamo).toLocaleDateString("es-CO");
        const fechaEst = p.fecha_devolucion_estimada
            ? new Date(p.fecha_devolucion_estimada + "T00:00:00").toLocaleDateString("es-CO")
            : "—";

        return `
        <tr class="${p.alerta ? 'fila-alerta' : ''}">
            <td>${p.id}</td>
            <td>
                <strong>${p.usuario_nombre}</strong><br>
                <small class="text-muted">${p.usuario_documento}</small>
            </td>
            <td>${p.equipo_nombre}</td>
            <td>${tipoIcono[p.equipo_tipo] || "📦"} ${p.equipo_tipo || "—"}</td>
            <td>${fecha}</td>
            <td class="${p.alerta ? 'text-danger' : ''}">
                ${p.alerta ? "⚠️ " : ""}${fechaEst}
            </td>
            <td>${estadoBadge[p.estado] || p.estado}</td>
            <td>
                <a href="prestamos.html" class="btn btn-sm btn-secondary">Ver todos</a>
            </td>
        </tr>`;
    }).join("");
}

// ── TABLA ATRASADOS ───────────────────────────────────
function renderizarAtrasados(lista) {
    const tbody = document.getElementById("cuerpoAtrasados");

    if (lista.length === 0) {
        tbody.innerHTML = `<tr>
            <td colspan="7" class="text-center">Sin préstamos atrasados 🎉</td>
        </tr>`;
        document.getElementById("cardAtrasados").style.borderColor = "#16a34a";
        return;
    }

    tbody.innerHTML = lista.map(p => {
        const fecha    = new Date(p.fecha_prestamo).toLocaleDateString("es-CO");
        const fechaEst = p.fecha_devolucion_estimada !== "—"
            ? new Date(p.fecha_devolucion_estimada + "T00:00:00").toLocaleDateString("es-CO")
            : "—";

        return `
        <tr class="fila-alerta">
            <td>${p.id}</td>
            <td><strong>${p.usuario_nombre}</strong></td>
            <td>${p.usuario_documento}</td>
            <td>${tipoIcono[p.equipo_tipo] || "📦"} ${p.equipo_nombre}</td>
            <td>${fecha}</td>
            <td class="text-danger"><strong>${fechaEst}</strong></td>
            <td>
                <a href="prestamos.html" class="btn btn-sm btn-danger">Gestionar</a>
            </td>
        </tr>`;
    }).join("");
}

// ── ÚLTIMOS MOVIMIENTOS ───────────────────────────────
function renderizarUltimosMovimientos(historial) {
    const container = document.getElementById("ultimosMovimientos");
    if (!container) return;

    const ultimos = historial.slice(0, 8);

    if (ultimos.length === 0) {
        container.innerHTML = `<p class="text-muted text-center">Sin movimientos aún</p>`;
        return;
    }

    const iconoEstado = {
        prestado: "🔵", asignado: "🟡", devuelto: "🟢",
        atrasado: "🔴", "dañado": "⚠️", perdido: "❌"
    };

    container.innerHTML = ultimos.map(p => {
        const fecha = new Date(p.fecha_prestamo).toLocaleDateString("es-CO");
        return `
        <div class="movimiento-item">
            <span class="mov-icono">${iconoEstado[p.estado] || "📦"}</span>
            <div class="mov-info">
                <span class="mov-usuario">${p.usuario_nombre}</span>
                <span class="mov-equipo">${p.equipo_nombre}</span>
            </div>
            <span class="mov-fecha">${fecha}</span>
        </div>`;
    }).join("");
}

// ── EXPORTAR EXCEL ────────────────────────────────────
function exportarExcel(tipo) {
    window.open(`${API_URL}/excel/${tipo}`, "_blank");
    toast(`Descargando Excel de ${tipo}...`, "info");
}

// ── INICIAR ───────────────────────────────────────────
mostrarFecha();
cargarDashboard();
setInterval(cargarDashboard, 60000);