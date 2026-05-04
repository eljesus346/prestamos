from sqlalchemy import Column, Integer, String, Boolean, Text, Date, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from database import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    documento = Column(String(20), unique=True, nullable=False)
    telefono = Column(String(20))
    correo = Column(String(100))
    cargo = Column(String(100))
    area = Column(String(100))
    estado = Column(Boolean, default=True)
    fecha_registro = Column(TIMESTAMP, server_default=func.now())


class Equipo(Base):
    __tablename__ = "equipos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    tipo = Column(String(50), nullable=False)
    serial = Column(String(100), unique=True, nullable=False)
    codigo_interno = Column(String(50))
    estado = Column(String(30), default="disponible")
    observaciones = Column(Text)
    foto = Column(Text, nullable=True)
    fecha_registro = Column(TIMESTAMP, server_default=func.now())


class Prestamo(Base):
    __tablename__ = "prestamos"

    id = Column(Integer, primary_key=True, index=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id"))
    id_equipo = Column(Integer, ForeignKey("equipos.id"))
    fecha_prestamo = Column(TIMESTAMP, server_default=func.now())
    fecha_devolucion_estimada = Column(Date)
    fecha_devolucion_real = Column(TIMESTAMP, nullable=True)
    estado = Column(String(30), default="prestado")
    firma = Column(Text, nullable=True)
    firma_devolucion = Column(Text, nullable=True)       # ← firma de devolución
    observaciones = Column(Text, nullable=True)