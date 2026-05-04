from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Usuario
from schemas import UsuarioCreate, UsuarioOut
from typing import List

router = APIRouter()

# ── LISTAR TODOS ──────────────────────────────────────
@router.get("/", response_model=List[UsuarioOut])
def listar_usuarios(db: Session = Depends(get_db)):
    return db.query(Usuario).all()

# ── BUSCAR POR ID ─────────────────────────────────────
@router.get("/{id}", response_model=UsuarioOut)
def obtener_usuario(id: int, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return usuario

# ── CREAR ─────────────────────────────────────────────
@router.post("/", response_model=UsuarioOut)
def crear_usuario(datos: UsuarioCreate, db: Session = Depends(get_db)):
    # Verificar que el documento no esté repetido
    existe = db.query(Usuario).filter(Usuario.documento == datos.documento).first()
    if existe:
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese documento")
    
    nuevo = Usuario(**datos.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

# ── EDITAR ────────────────────────────────────────────
@router.put("/{id}", response_model=UsuarioOut)
def editar_usuario(id: int, datos: UsuarioCreate, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    for campo, valor in datos.model_dump().items():
        setattr(usuario, campo, valor)
    
    db.commit()
    db.refresh(usuario)
    return usuario

# ── DESACTIVAR (soft delete) ──────────────────────────
@router.delete("/{id}")
def desactivar_usuario(id: int, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    usuario.estado = False
    db.commit()
    return {"mensaje": f"Usuario {usuario.nombre} desactivado correctamente"}

# ── ACTIVAR / DESACTIVAR (toggle) ─────────────────────
@router.patch("/{id}/estado")
def toggle_estado_usuario(id: int, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    usuario.estado = not usuario.estado
    db.commit()
    
    accion = "activado" if usuario.estado else "desactivado"
    return {"mensaje": f"Usuario {usuario.nombre} {accion} correctamente", "estado": usuario.estado}