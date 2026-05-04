from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from database import get_db
from models import Prestamo, Equipo, Usuario
from schemas import PrestamoCreate, PrestamoOut, DevolucionData
from typing import List
from datetime import datetime

router = APIRouter()

# ── LISTAR TODOS ──────────────────────────────────────
@router.get("/", response_model=List[PrestamoOut])
def listar_prestamos(db: Session = Depends(get_db)):
    return db.query(Prestamo).order_by(Prestamo.id.desc()).all()

# ── SOLO ACTIVOS ──────────────────────────────────────
@router.get("/activos", response_model=List[PrestamoOut])
def prestamos_activos(db: Session = Depends(get_db)):
    return db.query(Prestamo).filter(
        Prestamo.estado.in_(["prestado", "asignado", "atrasado"])
    ).all()

# ── ATRASADOS ─────────────────────────────────────────
@router.get("/atrasados", response_model=List[PrestamoOut])
def prestamos_atrasados(db: Session = Depends(get_db)):
    return db.query(Prestamo).filter(Prestamo.estado == "atrasado").all()

# ── LISTAR CON DETALLE (usuario + equipo) ─────────────
@router.get("/detalle/todos")
def listar_con_detalle(db: Session = Depends(get_db)):
    prestamos = db.query(Prestamo).order_by(Prestamo.id.desc()).all()
    resultado = []

    for p in prestamos:
        usuario = db.query(Usuario).filter(Usuario.id == p.id_usuario).first()
        equipo  = db.query(Equipo).filter(Equipo.id  == p.id_equipo).first()

        resultado.append({
            "id":                        p.id,
            "estado":                    p.estado,
            "fecha_prestamo":            p.fecha_prestamo,
            "fecha_devolucion_estimada": p.fecha_devolucion_estimada,
            "fecha_devolucion_real":     p.fecha_devolucion_real,
            "observaciones":             p.observaciones,
            "firma":                     p.firma,
            "firma_devolucion":          p.firma_devolucion,
            "id_usuario":                p.id_usuario,
            "id_equipo":                 p.id_equipo,
            "usuario_nombre":            usuario.nombre    if usuario else "—",
            "usuario_documento":         usuario.documento if usuario else "—",
            "equipo_nombre":             equipo.nombre     if equipo  else "—",
            "equipo_serial":             equipo.serial     if equipo  else "—",
            "equipo_tipo":               equipo.tipo       if equipo  else "—",
        })

    return resultado

# ── OBTENER UNO ───────────────────────────────────────
@router.get("/{id}", response_model=PrestamoOut)
def obtener_prestamo(id: int, db: Session = Depends(get_db)):
    prestamo = db.query(Prestamo).filter(Prestamo.id == id).first()
    if not prestamo:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    return prestamo

# ── ENDPOINT: tipos bloqueados para un usuario ────────
# Útil para que el frontend sepa qué tipos NO puede pedir
@router.get("/usuario/{id_usuario}/tipos-bloqueados")
def tipos_bloqueados(id_usuario: int, db: Session = Depends(get_db)):
    """
    Devuelve la lista de tipos de equipo que el usuario
    ya tiene prestados y no puede volver a solicitar.
    """
    prestamos_activos = db.query(Prestamo).filter(
        Prestamo.id_usuario == id_usuario,
        Prestamo.estado.in_(["prestado", "asignado", "atrasado"])
    ).all()

    bloqueados = []
    for p in prestamos_activos:
        equipo = db.query(Equipo).filter(Equipo.id == p.id_equipo).first()
        if equipo:
            bloqueados.append({
                "tipo":          equipo.tipo,
                "equipo_nombre": equipo.nombre,
                "equipo_serial": equipo.serial,
                "codigo_interno": equipo.codigo_interno or "",
                "prestamo_id":   p.id,
            })

    return {"bloqueados": bloqueados}

# ── CREAR PRÉSTAMO ────────────────────────────────────
@router.post("/", response_model=PrestamoOut)
def crear_prestamo(datos: PrestamoCreate, db: Session = Depends(get_db)):

    # 1. Verificar que el usuario existe
    usuario = db.query(Usuario).filter(Usuario.id == datos.id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # 2. Verificar que el equipo solicitado existe y está disponible
    equipo_nuevo = db.query(Equipo).filter(Equipo.id == datos.id_equipo).first()
    if not equipo_nuevo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    if equipo_nuevo.estado != "disponible":
        raise HTTPException(
            status_code=400,
            detail=f"El equipo '{equipo_nuevo.nombre}' no está disponible. "
                   f"Estado actual: {equipo_nuevo.estado}"
        )

    # 3. ── REGLA PRINCIPAL ──────────────────────────────────────────────
    #    El usuario NO puede tener dos préstamos activos del mismo tipo.
    #    Sí puede tener préstamos activos de tipos distintos.
    prestamos_activos = db.query(Prestamo).filter(
        Prestamo.id_usuario == datos.id_usuario,
        Prestamo.estado.in_(["prestado", "asignado", "atrasado"])
    ).all()

    for prestamo_activo in prestamos_activos:
        equipo_activo = db.query(Equipo).filter(
            Equipo.id == prestamo_activo.id_equipo
        ).first()

        if equipo_activo and equipo_activo.tipo == equipo_nuevo.tipo:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"El usuario '{usuario.nombre}' ya tiene un préstamo activo "
                    f"de tipo '{equipo_nuevo.tipo}' ({equipo_activo.nombre}). "
                    f"Debe devolverlo antes de solicitar otro del mismo tipo."
                )
            )
    # ────────────────────────────────────────────────────────────────────

    # 4. Todo OK → registrar el préstamo
    nuevo = Prestamo(**datos.model_dump())
    db.add(nuevo)
    equipo_nuevo.estado = "prestado"
    db.commit()
    db.refresh(nuevo)
    return nuevo

# ── REGISTRAR DEVOLUCIÓN ──────────────────────────────
@router.put("/{id}/devolver")
def devolver_prestamo(
    id: int,
    datos: DevolucionData = Body(default_factory=DevolucionData),
    db: Session = Depends(get_db)
):
    prestamo = db.query(Prestamo).filter(Prestamo.id == id).first()
    if not prestamo:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    if prestamo.estado == "devuelto":
        raise HTTPException(status_code=400, detail="Este préstamo ya fue devuelto")

    prestamo.estado = "devuelto"
    prestamo.fecha_devolucion_real = datetime.now()

    if datos.firma_devolucion:
        prestamo.firma_devolucion = datos.firma_devolucion

    if datos.observaciones:
        nota = f"[Devolución {datetime.now().strftime('%d/%m/%Y')}]: {datos.observaciones}"
        prestamo.observaciones = (
            f"{prestamo.observaciones} | {nota}"
            if prestamo.observaciones
            else nota
        )

    equipo = db.query(Equipo).filter(Equipo.id == prestamo.id_equipo).first()
    if equipo:
        equipo.estado = "disponible"

    db.commit()
    return {"mensaje": "Devolución registrada correctamente ✅"}

# ── CAMBIAR ESTADO ────────────────────────────────────
@router.patch("/{id}/estado")
def cambiar_estado(id: int, estado: str, db: Session = Depends(get_db)):
    estados_validos = ["asignado", "prestado", "devuelto", "atrasado", "dañado", "perdido"]
    if estado not in estados_validos:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Usa: {estados_validos}")

    prestamo = db.query(Prestamo).filter(Prestamo.id == id).first()
    if not prestamo:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    prestamo.estado = estado

    equipo = db.query(Equipo).filter(Equipo.id == prestamo.id_equipo).first()
    if equipo:
        if estado == "devuelto":
            equipo.estado = "disponible"
        elif estado == "dañado":
            equipo.estado = "dañado"
        elif estado == "perdido":
            equipo.estado = "mantenimiento"
        elif estado in ["prestado", "asignado", "atrasado"]:
            equipo.estado = "prestado"

    db.commit()
    return {"mensaje": f"Estado actualizado a '{estado}'"}

# ── HISTORIAL POR USUARIO ─────────────────────────────
@router.get("/historial/usuario/{id_usuario}")
def historial_usuario(id_usuario: int, db: Session = Depends(get_db)):
    prestamos = db.query(Prestamo).filter(
        Prestamo.id_usuario == id_usuario
    ).order_by(Prestamo.id.desc()).all()
    return prestamos

# ── HISTORIAL POR EQUIPO ──────────────────────────────
@router.get("/historial/equipo/{id_equipo}")
def historial_equipo(id_equipo: int, db: Session = Depends(get_db)):
    prestamos = db.query(Prestamo).filter(
        Prestamo.id_equipo == id_equipo
    ).order_by(Prestamo.id.desc()).all()
    return prestamos