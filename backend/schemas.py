from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

# ── USUARIOS ──────────────────────────────────────────
class UsuarioBase(BaseModel):
    nombre: str
    documento: str
    telefono: Optional[str] = None
    correo: Optional[str] = None
    cargo: Optional[str] = None
    area: Optional[str] = None

class UsuarioCreate(UsuarioBase):
    pass

class UsuarioOut(UsuarioBase):
    id: int
    estado: bool
    fecha_registro: datetime

    class Config:
        from_attributes = True


# ── EQUIPOS ───────────────────────────────────────────
class EquipoBase(BaseModel):
    nombre: str
    tipo: str
    serial: str
    codigo_interno: Optional[str] = None
    observaciones: Optional[str] = None
    foto: Optional[str] = None

class EquipoCreate(EquipoBase):
    pass

class EquipoOut(EquipoBase):
    id: int
    estado: str
    fecha_registro: datetime

    class Config:
        from_attributes = True


# ── PRÉSTAMOS ─────────────────────────────────────────
class PrestamoBase(BaseModel):
    id_usuario: int
    id_equipo: int
    fecha_devolucion_estimada: Optional[date] = None
    observaciones: Optional[str] = None
    firma: Optional[str] = None
    firma_devolucion: Optional[str] = None              # ← nueva

class PrestamoCreate(PrestamoBase):
    pass

class PrestamoOut(PrestamoBase):
    id: int
    fecha_prestamo: datetime
    fecha_devolucion_real: Optional[datetime] = None
    estado: str

    class Config:
        from_attributes = True


# ── SCHEMA PARA DEVOLUCIÓN ────────────────────────────
class DevolucionData(BaseModel):
    observaciones: Optional[str] = None
    firma_devolucion: Optional[str] = None


# ── PRÉSTAMO CON DETALLE (usuario + equipo) ───────────
class PrestamoDetalle(BaseModel):
    id: int
    estado: str
    fecha_prestamo: datetime
    fecha_devolucion_estimada: Optional[date] = None
    fecha_devolucion_real: Optional[datetime] = None
    observaciones: Optional[str] = None
    firma: Optional[str] = None
    firma_devolucion: Optional[str] = None              # ← nueva

    usuario_nombre: Optional[str] = None
    usuario_documento: Optional[str] = None
    equipo_nombre: Optional[str] = None
    equipo_serial: Optional[str] = None
    equipo_tipo: Optional[str] = None

    class Config:
        from_attributes = True