from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Prestamo, Equipo, Usuario
from datetime import date

router = APIRouter()

@router.get("/")
def obtener_dashboard(db: Session = Depends(get_db)):

    # ── CONTADORES EQUIPOS ────────────────────────────
    total_equipos       = db.query(Equipo).count()
    equipos_disponibles = db.query(Equipo).filter(Equipo.estado == "disponible").count()
    equipos_prestados   = db.query(Equipo).filter(Equipo.estado == "prestado").count()
    equipos_danados     = db.query(Equipo).filter(Equipo.estado == "dañado").count()
    equipos_mant        = db.query(Equipo).filter(Equipo.estado == "mantenimiento").count()

    # ── CONTADORES USUARIOS ───────────────────────────
    total_usuarios  = db.query(Usuario).count()
    usuarios_activos = db.query(Usuario).filter(Usuario.estado == True).count()

    # ── CONTADORES PRÉSTAMOS ──────────────────────────
    total_prestamos   = db.query(Prestamo).count()
    prestamos_activos = db.query(Prestamo).filter(
        Prestamo.estado.in_(["prestado", "asignado"])
    ).count()
    prestamos_atrasados = db.query(Prestamo).filter(
        Prestamo.estado == "atrasado"
    ).count()
    prestamos_devueltos = db.query(Prestamo).filter(
        Prestamo.estado == "devuelto"
    ).count()

    # ── PRÉSTAMOS ATRASADOS (detalle) ─────────────────
    atrasados = db.query(Prestamo).filter(Prestamo.estado == "atrasado").all()
    lista_atrasados = []
    for p in atrasados:
        usuario = db.query(Usuario).filter(Usuario.id == p.id_usuario).first()
        equipo  = db.query(Equipo).filter(Equipo.id  == p.id_equipo).first()
        lista_atrasados.append({
            "id":                        p.id,
            "usuario_nombre":            usuario.nombre   if usuario else "—",
            "usuario_documento":         usuario.documento if usuario else "—",
            "equipo_nombre":             equipo.nombre    if equipo  else "—",
            "equipo_tipo":               equipo.tipo      if equipo  else "—",
            "fecha_prestamo":            str(p.fecha_prestamo),
            "fecha_devolucion_estimada": str(p.fecha_devolucion_estimada) if p.fecha_devolucion_estimada else "—",
        })

    # ── PRÉSTAMOS ACTIVOS (detalle para tabla) ────────
    activos = db.query(Prestamo).filter(
        Prestamo.estado.in_(["prestado", "asignado"])
    ).order_by(Prestamo.id.desc()).limit(10).all()

    lista_activos = []
    for p in activos:
        usuario = db.query(Usuario).filter(Usuario.id == p.id_usuario).first()
        equipo  = db.query(Equipo).filter(Equipo.id  == p.id_equipo).first()

        # Detectar si está atrasado automáticamente
        hoy = date.today()
        alerta = False
        if p.fecha_devolucion_estimada and p.fecha_devolucion_estimada < hoy:
            alerta = True
            # Actualizar estado en BD
            p.estado = "atrasado"
            db.commit()

        lista_activos.append({
            "id":                        p.id,
            "estado":                    p.estado,
            "usuario_nombre":            usuario.nombre    if usuario else "—",
            "usuario_documento":         usuario.documento if usuario else "—",
            "equipo_nombre":             equipo.nombre     if equipo  else "—",
            "equipo_tipo":               equipo.tipo       if equipo  else "—",
            "fecha_prestamo":            str(p.fecha_prestamo),
            "fecha_devolucion_estimada": str(p.fecha_devolucion_estimada) if p.fecha_devolucion_estimada else None,
            "alerta":                    alerta,
        })

    # ── EQUIPOS POR TIPO (para gráfica) ──────────────
    tipos = ["laptop", "mouse", "teclado", "diadema", "otro"]
    equipos_por_tipo = {}
    for tipo in tipos:
        equipos_por_tipo[tipo] = db.query(Equipo).filter(Equipo.tipo == tipo).count()

    return {
        "equipos": {
            "total":         total_equipos,
            "disponibles":   equipos_disponibles,
            "prestados":     equipos_prestados,
            "danados":       equipos_danados,
            "mantenimiento": equipos_mant,
        },
        "usuarios": {
            "total":   total_usuarios,
            "activos": usuarios_activos,
        },
        "prestamos": {
            "total":     total_prestamos,
            "activos":   prestamos_activos,
            "atrasados": prestamos_atrasados,
            "devueltos": prestamos_devueltos,
        },
        "lista_atrasados": lista_atrasados,
        "lista_activos":   lista_activos,
        "equipos_por_tipo": equipos_por_tipo,
    }