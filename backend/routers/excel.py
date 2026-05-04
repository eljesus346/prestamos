from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from models import Prestamo, Equipo, Usuario
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from io import BytesIO
from datetime import datetime

router = APIRouter()

def estilo_encabezado(ws, fila, columnas):
    fill = PatternFill("solid", fgColor="1E293B")
    font = Font(color="FFFFFF", bold=True, size=11)
    for col, titulo in enumerate(columnas, 1):
        cell = ws.cell(row=fila, column=col, value=titulo)
        cell.fill = fill
        cell.font = font
        cell.alignment = Alignment(horizontal="center", vertical="center")

# ── EXPORTAR PRÉSTAMOS ────────────────────────────────
@router.get("/prestamos")
def exportar_prestamos(db: Session = Depends(get_db)):
    prestamos = db.query(Prestamo).order_by(Prestamo.id.desc()).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Préstamos"

    columnas = ["#", "Usuario", "Documento", "Equipo", "Tipo", "Serial",
                "Fecha Préstamo", "Devolución Est.", "Devolución Real",
                "Estado", "Observaciones"]
    estilo_encabezado(ws, 1, columnas)

    for p in prestamos:
        usuario = db.query(Usuario).filter(Usuario.id == p.id_usuario).first()
        equipo  = db.query(Equipo).filter(Equipo.id  == p.id_equipo).first()
        ws.append([
            p.id,
            usuario.nombre    if usuario else "—",
            usuario.documento if usuario else "—",
            equipo.nombre     if equipo  else "—",
            equipo.tipo       if equipo  else "—",
            equipo.serial     if equipo  else "—",
            p.fecha_prestamo.strftime("%d/%m/%Y %H:%M") if p.fecha_prestamo else "—",
            str(p.fecha_devolucion_estimada) if p.fecha_devolucion_estimada else "—",
            p.fecha_devolucion_real.strftime("%d/%m/%Y %H:%M") if p.fecha_devolucion_real else "—",
            p.estado,
            p.observaciones or "—",
        ])

    # Ajustar ancho de columnas
    anchos = [5, 25, 15, 25, 12, 18, 18, 15, 15, 12, 30]
    for i, ancho in enumerate(anchos, 1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = ancho

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    nombre = f"prestamos_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={nombre}"}
    )

# ── EXPORTAR EQUIPOS ──────────────────────────────────
@router.get("/equipos")
def exportar_equipos(db: Session = Depends(get_db)):
    equipos = db.query(Equipo).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Equipos"

    columnas = ["#", "Nombre", "Tipo", "Serial", "Código Interno",
                "Estado", "Observaciones", "Fecha Registro"]
    estilo_encabezado(ws, 1, columnas)

    for e in equipos:
        ws.append([
            e.id, e.nombre, e.tipo, e.serial,
            e.codigo_interno or "—",
            e.estado,
            e.observaciones or "—",
            e.fecha_registro.strftime("%d/%m/%Y") if e.fecha_registro else "—",
        ])

    anchos = [5, 25, 12, 20, 15, 15, 30, 15]
    for i, ancho in enumerate(anchos, 1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = ancho

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    nombre = f"equipos_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={nombre}"}
    )

# ── EXPORTAR USUARIOS ─────────────────────────────────
@router.get("/usuarios")
def exportar_usuarios(db: Session = Depends(get_db)):
    usuarios = db.query(Usuario).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Usuarios"

    columnas = ["#", "Nombre", "Documento", "Teléfono",
                "Correo", "Cargo", "Área", "Estado", "Fecha Registro"]
    estilo_encabezado(ws, 1, columnas)

    for u in usuarios:
        ws.append([
            u.id, u.nombre, u.documento,
            u.telefono or "—", u.correo or "—",
            u.cargo or "—", u.area or "—",
            "Activo" if u.estado else "Inactivo",
            u.fecha_registro.strftime("%d/%m/%Y") if u.fecha_registro else "—",
        ])

    anchos = [5, 25, 15, 15, 28, 20, 20, 10, 15]
    for i, ancho in enumerate(anchos, 1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = ancho

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    nombre = f"usuarios_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={nombre}"}
    )