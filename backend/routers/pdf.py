from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from models import Prestamo, Usuario, Equipo

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame,
    Table, TableStyle, Paragraph, Spacer, Image, KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas as rl_canvas

from io import BytesIO
from datetime import datetime
import base64

router = APIRouter()

# ══════════════════════════════════════════════════
#  PALETA DE COLORES
# ══════════════════════════════════════════════════
C_NAVY       = colors.HexColor("#0f172a")
C_PRIMARY    = colors.HexColor("#1d4ed8")
C_PRIMARY_LT = colors.HexColor("#3b82f6")
C_ACCENT     = colors.HexColor("#0ea5e9")
C_SUCCESS    = colors.HexColor("#16a34a")
C_WARNING    = colors.HexColor("#d97706")
C_DANGER     = colors.HexColor("#dc2626")
C_SLATE      = colors.HexColor("#475569")
C_MUTED      = colors.HexColor("#94a3b8")
C_BORDER     = colors.HexColor("#e2e8f0")
C_BG_LIGHT   = colors.HexColor("#f8fafc")
C_BG_CARD    = colors.HexColor("#f1f5f9")
C_WHITE      = colors.white

W_PAGE, H_PAGE = A4
MARGIN_H  = 2.2 * cm
MARGIN_V  = 2.8 * cm
CONTENT_W = W_PAGE - 2 * MARGIN_H


# ══════════════════════════════════════════════════
#  COLOR POR ESTADO
# ══════════════════════════════════════════════════
_ESTADO_COLORS = {
    "prestado":  (C_PRIMARY,  colors.HexColor("#dbeafe")),
    "asignado":  (C_WARNING,  colors.HexColor("#fef3c7")),
    "devuelto":  (C_SUCCESS,  colors.HexColor("#dcfce7")),
    "atrasado":  (C_DANGER,   colors.HexColor("#fee2e2")),
    "dañado":    (C_DANGER,   colors.HexColor("#fee2e2")),
    "perdido":   (C_DANGER,   colors.HexColor("#fee2e2")),
}

def estado_colors(estado: str):
    return _ESTADO_COLORS.get(estado.lower(), (C_SLATE, C_BG_LIGHT))


# ══════════════════════════════════════════════════
#  CANVAS DECORATOR (header + footer + watermark)
# ══════════════════════════════════════════════════
def _draw_page(canvas: rl_canvas.Canvas, doc, prestamo, fecha_gen: str):
    canvas.saveState()

    canvas.setFillColor(C_NAVY)
    canvas.rect(0, H_PAGE - 2.2*cm, W_PAGE, 2.2*cm, fill=1, stroke=0)
    canvas.setFillColor(C_PRIMARY)
    canvas.rect(0, H_PAGE - 2.2*cm, W_PAGE * 0.55, 2.2*cm, fill=1, stroke=0)

    canvas.setFillColor(C_ACCENT)
    canvas.rect(0, H_PAGE - 2.2*cm - 3, W_PAGE, 3, fill=1, stroke=0)

    canvas.setFillColor(C_WHITE)
    canvas.setFont("Helvetica-Bold", 13)
    canvas.drawString(MARGIN_H, H_PAGE - 1.45*cm, "Sistema de Prestamos de Equipos")
    canvas.setFont("Helvetica", 8.5)
    canvas.setFillColor(colors.HexColor("#93c5fd"))
    canvas.drawString(MARGIN_H, H_PAGE - 1.85*cm, "Comprobante Oficial de Prestamo")

    num = f"N\u00b0 {str(prestamo.id).zfill(5)}"
    canvas.setFillColor(C_WHITE)
    canvas.setFont("Helvetica-Bold", 11)
    canvas.drawRightString(W_PAGE - MARGIN_H, H_PAGE - 1.45*cm, num)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#93c5fd"))
    canvas.drawRightString(W_PAGE - MARGIN_H, H_PAGE - 1.85*cm, fecha_gen)

    footer_y = 1.2*cm
    canvas.setFillColor(C_BG_CARD)
    canvas.rect(0, 0, W_PAGE, footer_y + 0.3*cm, fill=1, stroke=0)
    canvas.setStrokeColor(C_BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN_H, footer_y + 0.3*cm, W_PAGE - MARGIN_H, footer_y + 0.3*cm)

    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(C_MUTED)
    canvas.drawString(MARGIN_H, footer_y - 0.05*cm,
        "Documento generado automaticamente. Valido como comprobante oficial.")
    canvas.drawRightString(W_PAGE - MARGIN_H, footer_y - 0.05*cm,
        f"Pagina {doc.page}")

    canvas.setFont("Helvetica-Bold", 52)
    canvas.setFillColor(colors.HexColor("#e2e8f0"))
    canvas.saveState()
    canvas.translate(W_PAGE / 2, H_PAGE / 2)
    canvas.rotate(35)
    canvas.drawCentredString(0, 0, prestamo.estado.upper())
    canvas.restoreState()

    canvas.restoreState()


# ══════════════════════════════════════════════════
#  ESTILOS
# ══════════════════════════════════════════════════
def _make_styles():
    base = getSampleStyleSheet()

    def ps(name, **kw):
        return ParagraphStyle(name, parent=base["Normal"], **kw)

    return {
        "section_label": ps("section_label",
            fontSize=8, fontName="Helvetica-Bold",
            textColor=C_PRIMARY, spaceBefore=2, spaceAfter=2, leading=10,
        ),
        "section_title": ps("section_title",
            fontSize=10.5, fontName="Helvetica-Bold",
            textColor=C_NAVY, spaceBefore=0, spaceAfter=0, leading=14,
        ),
        "field_label": ps("field_label",
            fontSize=8, textColor=C_SLATE, leading=12,
        ),
        "field_value": ps("field_value",
            fontSize=9, fontName="Helvetica-Bold",
            textColor=C_NAVY, leading=13,
        ),
        "field_value_muted": ps("field_value_muted",
            fontSize=9, textColor=C_MUTED, leading=13,
        ),
        "badge_text": ps("badge_text",
            fontSize=8.5, fontName="Helvetica-Bold",
            textColor=C_WHITE, alignment=TA_CENTER,
        ),
        "caption": ps("caption",
            fontSize=7.5, textColor=C_MUTED,
            alignment=TA_CENTER, leading=11,
        ),
    }


# ══════════════════════════════════════════════════
#  COMPONENTES
# ══════════════════════════════════════════════════
def _section_header(icon: str, title: str, subtitle: str = ""):
    ST = _make_styles()
    inner = [[
        Paragraph(icon, ParagraphStyle("ic", parent=ST["section_title"],
                   fontSize=14, leading=16)),
        [
            Paragraph(title, ST["section_title"]),
            Paragraph(subtitle, ST["section_label"]) if subtitle else Spacer(0, 0),
        ]
    ]]
    tbl = Table(inner, colWidths=[1*cm, CONTENT_W - 1*cm])
    tbl.setStyle(TableStyle([
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING",   (0,0), (-1,-1), 10),
        ("RIGHTPADDING",  (0,0), (-1,-1), 8),
        ("TOPPADDING",    (0,0), (-1,-1), 9),
        ("BOTTOMPADDING", (0,0), (-1,-1), 9),
        ("BACKGROUND",    (0,0), (-1,-1), C_BG_CARD),
        ("LINEBELOW",     (0,0), (-1,-1), 2.5, C_PRIMARY),
        ("LINEBEFORE",    (0,0), (0,-1),  4,   C_ACCENT),
    ]))
    return tbl


def _info_table(rows: list, ST: dict):
    data = []
    for label, value, *muted in rows:
        val_style = ST["field_value_muted"] if muted and muted[0] else ST["field_value"]
        data.append([
            Paragraph(label, ST["field_label"]),
            Paragraph(str(value) if value else "—", val_style),
        ])
    tbl = Table(data, colWidths=[5.2*cm, CONTENT_W - 5.2*cm])
    tbl.setStyle(TableStyle([
        ("ROWBACKGROUNDS",  (0,0), (-1,-1), [C_WHITE, C_BG_LIGHT]),
        ("GRID",            (0,0), (-1,-1), 0.4, C_BORDER),
        ("TOPPADDING",      (0,0), (-1,-1), 6),
        ("BOTTOMPADDING",   (0,0), (-1,-1), 6),
        ("LEFTPADDING",     (0,0), (0,-1), 12),
        ("LEFTPADDING",     (1,0), (1,-1), 10),
        ("VALIGN",          (0,0), (-1,-1), "MIDDLE"),
    ]))
    return tbl


def _estado_badge(estado: str, ST: dict):
    fg, bg = estado_colors(estado)
    tbl = Table(
        [[Paragraph(f"  {estado.upper()}  ", ST["badge_text"])]],
        colWidths=[4.5*cm]
    )
    tbl.setStyle(TableStyle([
        ("BACKGROUND",      (0,0), (-1,-1), fg),
        ("ALIGN",           (0,0), (-1,-1), "CENTER"),
        ("VALIGN",          (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",      (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",   (0,0), (-1,-1), 5),
        ("ROUNDEDCORNERS",  (0,0), (-1,-1), [5, 5, 5, 5]),
    ]))
    return tbl


def _metric_cell(label: str, value: str, color):
    ST = _make_styles()
    return Table([[
        Paragraph(label, ParagraphStyle("mc_lbl", parent=ST["field_label"],
                   alignment=TA_CENTER, fontSize=7.5)),
        Paragraph(value, ParagraphStyle("mc_val", parent=ST["section_title"],
                   alignment=TA_CENTER, fontSize=10, textColor=color)),
    ]], colWidths=[None])


def _summary_bar(prestamo, fecha_prestamo: str, fecha_est: str, ST: dict):
    col_w = CONTENT_W / 3
    inner = [[
        _metric_cell("ID Prestamo",  f"#{str(prestamo.id).zfill(5)}", C_PRIMARY),
        _metric_cell("Fecha Inicio",  fecha_prestamo,                  C_NAVY),
        _metric_cell("Dev. Estimada", fecha_est,                       C_WARNING),
    ]]
    tbl = Table(inner, colWidths=[col_w, col_w, col_w])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",      (0,0), (0,-1), colors.HexColor("#eff6ff")),
        ("BACKGROUND",      (1,0), (1,-1), C_BG_LIGHT),
        ("BACKGROUND",      (2,0), (2,-1), colors.HexColor("#fffbeb")),
        ("GRID",            (0,0), (-1,-1), 0.5, C_BORDER),
        ("ALIGN",           (0,0), (-1,-1), "CENTER"),
        ("VALIGN",          (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",      (0,0), (-1,-1), 10),
        ("BOTTOMPADDING",   (0,0), (-1,-1), 10),
    ]))
    return tbl


def _bloque_sin_firma(texto: str, ST: dict):
    """Bloque vacío cuando no hay firma registrada."""
    bloque = Table([[
        Paragraph(texto, ST["caption"])
    ]], colWidths=[CONTENT_W])
    bloque.setStyle(TableStyle([
        ("BOX",          (0,0), (-1,-1), 0.5, C_BORDER),
        ("BACKGROUND",   (0,0), (-1,-1), C_BG_LIGHT),
        ("TOPPADDING",   (0,0), (-1,-1), 18),
        ("BOTTOMPADDING",(0,0), (-1,-1), 18),
        ("ALIGN",        (0,0), (-1,-1), "CENTER"),
    ]))
    return bloque


def _bloque_firma(firma_b64: str, nombre: str, fecha: str,
                  color_linea, bg_color, ST: dict):
    """Bloque con imagen de firma."""
    firma_data  = firma_b64.split(",")[1]
    firma_bytes = base64.b64decode(firma_data)
    firma_img   = Image(BytesIO(firma_bytes), width=9*cm, height=3.5*cm)

    tbl = Table([[firma_img]], colWidths=[CONTENT_W])
    tbl.setStyle(TableStyle([
        ("ALIGN",         (0,0), (-1,-1), "CENTER"),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("BOX",           (0,0), (-1,-1), 1,   C_BORDER),
        ("LINEBELOW",     (0,0), (-1,-1), 2.5, color_linea),
        ("BACKGROUND",    (0,0), (-1,-1), bg_color),
        ("TOPPADDING",    (0,0), (-1,-1), 12),
        ("BOTTOMPADDING", (0,0), (-1,-1), 12),
    ]))

    lbl = Table([[
        Paragraph(f"{nombre}  ·  {fecha}", ST["caption"])
    ]], colWidths=[CONTENT_W])
    lbl.setStyle(TableStyle([("ALIGN", (0,0), (-1,-1), "CENTER")]))

    return tbl, lbl


# ══════════════════════════════════════════════════
#  ENDPOINT PRINCIPAL
# ══════════════════════════════════════════════════
@router.get("/{id_prestamo}")
def generar_pdf(id_prestamo: int, db: Session = Depends(get_db)):

    prestamo = db.query(Prestamo).filter(Prestamo.id == id_prestamo).first()
    if not prestamo:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    usuario = db.query(Usuario).filter(Usuario.id == prestamo.id_usuario).first()
    equipo  = db.query(Equipo).filter(Equipo.id  == prestamo.id_equipo).first()

    fmt_dt = lambda d: d.strftime("%d/%m/%Y %H:%M") if d else "—"
    fmt_d  = lambda d: d.strftime("%d/%m/%Y")        if d else "—"

    fecha_prestamo = fmt_dt(prestamo.fecha_prestamo)
    fecha_est      = fmt_d(prestamo.fecha_devolucion_estimada)
    fecha_real     = fmt_dt(prestamo.fecha_devolucion_real) if prestamo.fecha_devolucion_real else "Pendiente"
    fecha_gen      = datetime.now().strftime("Generado: %d/%m/%Y %H:%M")
    nombre_usr     = usuario.nombre if usuario else "N/A"

    ST = _make_styles()

    buffer = BytesIO()
    doc = BaseDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=MARGIN_H,
        leftMargin=MARGIN_H,
        topMargin=MARGIN_V + 0.5*cm,
        bottomMargin=MARGIN_V,
        title=f"Comprobante Prestamo #{str(prestamo.id).zfill(5)}",
        author="Sistema de Prestamos",
        subject="Comprobante Oficial",
    )

    frame = Frame(
        MARGIN_H, MARGIN_V,
        CONTENT_W, H_PAGE - MARGIN_V * 2 - 2.5*cm,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    )

    def page_callback(canvas, doc):
        _draw_page(canvas, doc, prestamo, fecha_gen)

    doc.addPageTemplates([
        PageTemplate(id="main", frames=[frame], onPage=page_callback)
    ])

    historia = []

    # ── 1. Badge + resumen ──────────────────────────
    header_row = Table(
        [[_estado_badge(prestamo.estado, ST),
          _summary_bar(prestamo, fecha_prestamo, fecha_est, ST)]],
        colWidths=[5*cm, CONTENT_W - 5*cm],
    )
    header_row.setStyle(TableStyle([
        ("VALIGN",         (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING",    (0,0), (0,-1), 0),
        ("RIGHTPADDING",   (0,0), (0,-1), 10),
        ("LEFTPADDING",    (1,0), (1,-1), 0),
    ]))
    historia.append(KeepTogether([header_row]))
    historia.append(Spacer(1, 0.5*cm))

    # ── 2. Información del préstamo ─────────────────
    historia.append(KeepTogether([
        _section_header("", "Informacion del Prestamo", "Detalle completo del comprobante"),
        Spacer(1, 1*mm),
        _info_table([
            ("Numero de prestamo:",  f"#{str(prestamo.id).zfill(5)}"),
            ("Fecha de prestamo:",   fecha_prestamo),
            ("Devolucion estimada:", fecha_est),
            ("Devolucion real:",     fecha_real, fecha_real == "Pendiente"),
            ("Observaciones:",       prestamo.observaciones or "Sin observaciones",
                                     not prestamo.observaciones),
        ], ST),
        Spacer(1, 0.45*cm),
    ]))

    # ── 3. Datos del usuario ────────────────────────
    historia.append(KeepTogether([
        _section_header("", "Datos del Receptor", "Persona responsable del equipo"),
        Spacer(1, 1*mm),
        _info_table([
            ("Nombre completo:", usuario.nombre    if usuario else None),
            ("Documento (CC):",  usuario.documento if usuario else None),
            ("Telefono:",        usuario.telefono  if usuario else None),
            ("Correo:",          usuario.correo    if usuario else None),
            ("Cargo:",           usuario.cargo     if usuario else None),
            ("Area:",            usuario.area      if usuario else None),
        ], ST),
        Spacer(1, 0.45*cm),
    ]))

    # ── 4. Datos del equipo ─────────────────────────
    historia.append(KeepTogether([
        _section_header("", "Datos del Equipo", "Identificacion y estado del activo"),
        Spacer(1, 1*mm),
        _info_table([
            ("Nombre:",          equipo.nombre                   if equipo else None),
            ("Tipo:",            equipo.tipo.capitalize()         if equipo else None),
            ("Serial:",          equipo.serial                   if equipo else None),
            ("Codigo interno:",  equipo.codigo_interno           if equipo else None),
            ("Estado:",          equipo.estado                   if equipo else None),
            ("Observaciones:",   equipo.observaciones or "—"     if equipo else None,
                                 not (equipo and equipo.observaciones)),
        ], ST),
        Spacer(1, 0.45*cm),
    ]))

    # ── 5. Firma de ENTREGA ─────────────────────────
    historia.append(_section_header(
        "", "Firma de Entrega",
        "El receptor confirma haber recibido el equipo"
    ))
    historia.append(Spacer(1, 2*mm))

    if prestamo.firma:
        try:
            tbl, lbl = _bloque_firma(
                prestamo.firma,
                f"Firmado al recibir por: {nombre_usr}",
                fecha_prestamo,
                C_PRIMARY,
                C_BG_LIGHT,
                ST
            )
            historia.append(tbl)
            historia.append(Spacer(1, 2*mm))
            historia.append(lbl)
        except Exception:
            historia.append(Paragraph(
                "No se pudo cargar la firma de entrega.",
                ParagraphStyle("err", parent=ST["caption"], textColor=C_DANGER)
            ))
    else:
        historia.append(_bloque_sin_firma("Sin firma de entrega registrada", ST))

    historia.append(Spacer(1, 0.45*cm))

    # ── 6. Firma de DEVOLUCIÓN ──────────────────────
    historia.append(_section_header(
        "", "Firma de Devolucion",
        "El receptor confirma haber devuelto el equipo"
    ))
    historia.append(Spacer(1, 2*mm))

    if prestamo.firma_devolucion:
        try:
            tbl, lbl = _bloque_firma(
                prestamo.firma_devolucion,
                f"Firmado al devolver por: {nombre_usr}",
                fecha_real,
                C_SUCCESS,
                colors.HexColor("#f0fdf4"),
                ST
            )
            historia.append(tbl)
            historia.append(Spacer(1, 2*mm))
            historia.append(lbl)
        except Exception:
            historia.append(Paragraph(
                "No se pudo cargar la firma de devolucion.",
                ParagraphStyle("err", parent=ST["caption"], textColor=C_DANGER)
            ))
    else:
        historia.append(_bloque_sin_firma(
            "Devolucion pendiente · Sin firma de devolucion registrada", ST
        ))

    historia.append(Spacer(1, 0.5*cm))

    doc.build(historia)
    buffer.seek(0)

    nombre = f"comprobante_prestamo_{str(prestamo.id).zfill(5)}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={nombre}"},
    )