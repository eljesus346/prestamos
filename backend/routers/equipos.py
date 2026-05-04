from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Equipo, Prestamo
from schemas import EquipoCreate, EquipoOut
from typing import List

router = APIRouter()

# ── LISTAR TODOS ──────────────────────────────────────
@router.get("/", response_model=List[EquipoOut])
def listar_equipos(db: Session = Depends(get_db)):
    return db.query(Equipo).all()

# ── SOLO DISPONIBLES ──────────────────────────────────
@router.get("/disponibles", response_model=List[EquipoOut])
def equipos_disponibles(db: Session = Depends(get_db)):
    return db.query(Equipo).filter(Equipo.estado == "disponible").all()

# ── BUSCAR POR ID ─────────────────────────────────────
@router.get("/{id}", response_model=EquipoOut)
def obtener_equipo(id: int, db: Session = Depends(get_db)):
    equipo = db.query(Equipo).filter(Equipo.id == id).first()
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    return equipo

# ── CREAR ─────────────────────────────────────────────
@router.post("/", response_model=EquipoOut)
def crear_equipo(datos: EquipoCreate, db: Session = Depends(get_db)):
    existe = db.query(Equipo).filter(Equipo.serial == datos.serial).first()
    if existe:
        raise HTTPException(status_code=400, detail="Ya existe un equipo con ese serial")

    nuevo = Equipo(**datos.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

# ── EDITAR ────────────────────────────────────────────
@router.put("/{id}", response_model=EquipoOut)
def editar_equipo(id: int, datos: EquipoCreate, db: Session = Depends(get_db)):
    equipo = db.query(Equipo).filter(Equipo.id == id).first()
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    for campo, valor in datos.model_dump().items():
        setattr(equipo, campo, valor)

    db.commit()
    db.refresh(equipo)
    return equipo

# ── CAMBIAR ESTADO ────────────────────────────────────
@router.patch("/{id}/estado")
def cambiar_estado(id: int, estado: str, db: Session = Depends(get_db)):
    estados_validos = ["disponible", "prestado", "dañado", "mantenimiento"]
    if estado not in estados_validos:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Usa: {estados_validos}")

    equipo = db.query(Equipo).filter(Equipo.id == id).first()
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    equipo.estado = estado
    db.commit()
    return {"mensaje": f"Estado actualizado a '{estado}'"}

# ── ELIMINAR ──────────────────────────────────────────
@router.delete("/{id}")
def eliminar_equipo(id: int, db: Session = Depends(get_db)):
    equipo = db.query(Equipo).filter(Equipo.id == id).first()
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    prestamos = db.query(Prestamo).filter(Prestamo.id_equipo == id).first()
    if prestamos:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar '{equipo.nombre}' porque tiene préstamos registrados. "
                   f"Cambia su estado a 'mantenimiento' o 'dañado' en su lugar."
        )

    db.delete(equipo)
    db.commit()
    return {"mensaje": f"Equipo '{equipo.nombre}' eliminado correctamente"}