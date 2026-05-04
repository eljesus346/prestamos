from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import usuarios, equipos, prestamos, dashboard, historial, pdf, excel, qr

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Sistema de Préstamos de Equipos",
    description="API para gestión de préstamos de equipos tecnológicos",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(usuarios.router,  prefix="/usuarios",  tags=["Usuarios"])
app.include_router(equipos.router,   prefix="/equipos",   tags=["Equipos"])
app.include_router(prestamos.router, prefix="/prestamos", tags=["Préstamos"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(historial.router, prefix="/historial", tags=["Historial"])
app.include_router(pdf.router,       prefix="/pdf",       tags=["PDF"])
app.include_router(excel.router,     prefix="/excel",     tags=["Excel"])
app.include_router(qr.router,        prefix="/qr",        tags=["QR"])

@app.get("/", tags=["Root"])
def root():
    return {"mensaje": "Bienvenido al sistema de préstamos 🚀"}

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "sistema": "Sistema de Préstamos v1.0"}