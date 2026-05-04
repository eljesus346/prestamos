from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Prestamo, Equipo, Usuario

router = APIRouter()

# ── HELPER: construir detalle de un préstamo ──────────
def construir_detalle(p, db):
    usuario = db.query(Usuario).filter(Usuario.id == p.id_usuario).first()
    equipo  = db.query(Equipo).filter(Equipo.id  == p.id_equipo).first()
    return {
        "id":                        p.id,
        "estado":                    p.estado,
        "fecha_prestamo":            str(p.fecha_prestamo),
        "fecha_devolucion_estimada": str(p.fecha_devolucion_estimada) if p.fecha_devolucion_estimada else "—",
        "fecha_devolucion_real":     str(p.fecha_devolucion_real)     if p.fecha_devolucion_real     else "—",
        "observaciones":             p.observaciones or "—",
        "firma":                     p.firma,
        "firma_devolucion":          p.firma_devolucion,              # ← nueva
        "id_usuario":                p.id_usuario,
        "id_equipo":                 p.id_equipo,
        "usuario_nombre":            usuario.nombre    if usuario else "—",
        "usuario_documento":         usuario.documento if usuario else "—",
        "usuario_cargo":             usuario.cargo     if usuario else "—",
        "usuario_area":              usuario.area      if usuario else "—",
        "equipo_nombre":             equipo.nombre     if equipo  else "—",
        "equipo_serial":             equipo.serial     if equipo  else "—",
        "equipo_tipo":               equipo.tipo       if equipo  else "—",
        "equipo_estado":             equipo.estado     if equipo  else "—",
    }

# ── HISTORIAL COMPLETO ────────────────────────────────
@router.get("/")
def historial_completo(db: Session = Depends(get_db)):
    prestamos = db.query(Prestamo).order_by(Prestamo.id.desc()).all()
    return [construir_detalle(p, db) for p in prestamos]

# ── HISTORIAL POR USUARIO ─────────────────────────────
@router.get("/usuario/{id_usuario}")
def historial_usuario(id_usuario: int, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    prestamos = db.query(Prestamo).filter(
        Prestamo.id_usuario == id_usuario
    ).order_by(Prestamo.id.desc()).all()

    return {
        "usuario": {
            "id":        usuario.id,
            "nombre":    usuario.nombre,
            "documento": usuario.documento,
            "cargo":     usuario.cargo,
            "area":      usuario.area,
            "estado":    usuario.estado,
        },
        "total_prestamos": len(prestamos),
        "prestamos": [construir_detalle(p, db) for p in prestamos]
    }

# ── HISTORIAL POR EQUIPO ──────────────────────────────
@router.get("/equipo/{id_equipo}")
def historial_equipo(id_equipo: int, db: Session = Depends(get_db)):
    equipo = db.query(Equipo).filter(Equipo.id == id_equipo).first()
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    prestamos = db.query(Prestamo).filter(
        Prestamo.id_equipo == id_equipo
    ).order_by(Prestamo.id.desc()).all()

    return {
        "equipo": {
            "id":             equipo.id,
            "nombre":         equipo.nombre,
            "tipo":           equipo.tipo,
            "serial":         equipo.serial,
            "codigo_interno": equipo.codigo_interno,
            "estado":         equipo.estado,
        },
        "total_prestamos": len(prestamos),
        "prestamos": [construir_detalle(p, db) for p in prestamos]
    }

# ── BUSCAR EN HISTORIAL ───────────────────────────────
@router.get("/buscar")
def buscar_historial(q: str, db: Session = Depends(get_db)):
    usuarios_ids = [
        u.id for u in db.query(Usuario).filter(
            (Usuario.nombre.ilike(f"%{q}%")) |
            (Usuario.documento.ilike(f"%{q}%"))
        ).all()
    ]
    equipos_ids = [
        e.id for e in db.query(Equipo).filter(
            (Equipo.nombre.ilike(f"%{q}%")) |
            (Equipo.serial.ilike(f"%{q}%"))
        ).all()
    ]

    prestamos = db.query(Prestamo).filter(
        (Prestamo.id_usuario.in_(usuarios_ids)) |
        (Prestamo.id_equipo.in_(equipos_ids))
    ).order_by(Prestamo.id.desc()).all()

    return [construir_detalle(p, db) for p in prestamos]