from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from models import Equipo
import qrcode
from io import BytesIO

router = APIRouter()

@router.get("/{id}")
def generar_qr(id: int, db: Session = Depends(get_db)):
    equipo = db.query(Equipo).filter(Equipo.id == id).first()
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    # Contenido del QR
    contenido = (
        f"EQUIPO: {equipo.nombre}\n"
        f"TIPO: {equipo.tipo}\n"
        f"SERIAL: {equipo.serial}\n"
        f"CÓDIGO: {equipo.codigo_interno or '—'}\n"
        f"ESTADO: {equipo.estado}"
    )

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(contenido)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#1e293b", back_color="white")

    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    nombre = f"qr_{equipo.serial}.png"
    return StreamingResponse(
        buffer,
        media_type="image/png",
        headers={"Content-Disposition": f"attachment; filename={nombre}"}
    )