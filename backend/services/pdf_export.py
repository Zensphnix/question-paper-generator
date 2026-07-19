import os
import re
import json
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, Table, TableStyle, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib import colors

from services.diagram_generator import draw_diagram


def _make_page_decorator(watermark_text=None, qr_image_path=None):
    """Returns an onPage callback for SimpleDocTemplate that stamps a
    diagonal watermark and/or a small QR code onto every page."""
    def _decorate(canvas, doc):
        canvas.saveState()
        if watermark_text:
            canvas.setFont("Helvetica-Bold", 60)
            canvas.setFillColorRGB(0.6, 0.6, 0.6, alpha=0.18)
            canvas.translate(doc.pagesize[0] / 2, doc.pagesize[1] / 2)
            canvas.rotate(45)
            canvas.drawCentredString(0, 0, watermark_text)
        canvas.restoreState()
        if qr_image_path and os.path.exists(qr_image_path):
            try:
                canvas.drawImage(qr_image_path, doc.pagesize[0] - 25 * mm, 12 * mm,
                                  width=16 * mm, height=16 * mm, mask="auto")
            except Exception:
                pass
    return _decorate


def make_qr_image(content: str, output_path: str):
    import qrcode
    img = qrcode.make(content)
    img.save(output_path)
    return output_path

styles = getSampleStyleSheet()
title_style = ParagraphStyle("Title2", parent=styles["Title"], alignment=TA_CENTER)
center_style = ParagraphStyle("Center", parent=styles["Normal"], alignment=TA_CENTER)
section_style = ParagraphStyle("Section", parent=styles["Heading2"], spaceBefore=14)
question_style = ParagraphStyle("Question", parent=styles["Normal"], spaceAfter=8, leftIndent=10)
option_style = ParagraphStyle("Option", parent=styles["Normal"], spaceAfter=2, leftIndent=24)
answer_style = ParagraphStyle("Answer", parent=styles["Normal"], spaceAfter=10, leftIndent=10, textColor="#334155")
cell_style = ParagraphStyle("Cell", parent=styles["Normal"], fontSize=9, leading=12)


def _question_flowables(q: dict, number, include_answer_inline=False):
    """Builds the flowables for one question: text, MCQ options if present,
    and a diagram if present. Shared by both PDF layouts below."""
    flowables = [Paragraph(f"Q{number}. {q['question']}", question_style)]

    if q.get("question_type") == "mcq" and q.get("options"):
        letters = ["A", "B", "C", "D"]
        for letter, opt in zip(letters, q["options"]):
            flowables.append(Paragraph(f"{letter}) {opt}", option_style))

    if q.get("diagram_type") and q.get("diagram_data"):
        try:
            data = q["diagram_data"] if isinstance(q["diagram_data"], dict) else json.loads(q["diagram_data"])
            drawing = draw_diagram(q["diagram_type"], data)
            flowables.append(Spacer(1, 4))
            flowables.append(drawing)
            flowables.append(Spacer(1, 4))
        except Exception:
            pass  # a broken diagram shouldn't take down the whole PDF

    return flowables


def _co_from_unit(unit: str) -> str:
    if not unit:
        return "CO1"
    m = re.search(r"\d+", unit)
    return f"CO{m.group()}" if m else "CO1"


BLOOM_TO_L = {
    "Remember": "L-1", "Understand": "L-2", "Apply": "L-3",
    "Analyze": "L-4", "Evaluate": "L-5", "Create": "L-6",
}


def build_pdf(
    output_path: str,
    institution: str,
    course: str,
    duration: str,
    max_marks: int,
    instructions: list,
    sections: list,  # list of {"name": "Section A", "questions": [{"question":..,"answer":..}, ...]}
    include_answers: bool = False,
    logo_path: str = None,
    watermark_text: str = None,
    qr_image_path: str = None,
):
    doc = SimpleDocTemplate(output_path, pagesize=A4,
                             topMargin=20 * mm, bottomMargin=20 * mm)
    story = []

    if logo_path and os.path.exists(logo_path):
        try:
            logo = Image(logo_path, width=25 * mm, height=25 * mm, kind="proportional")
            logo.hAlign = "CENTER"
            story.append(logo)
            story.append(Spacer(1, 8))
        except Exception:
            pass  # bad/corrupt image shouldn't break the whole PDF

    story.append(Paragraph(institution, title_style))
    story.append(Spacer(1, 6))
    story.append(Paragraph("Question Paper", center_style))
    story.append(Spacer(1, 10))
    story.append(Paragraph(f"<b>Course:</b> {course}", styles["Normal"]))
    story.append(Paragraph(f"<b>Duration:</b> {duration}", styles["Normal"]))
    story.append(Paragraph(f"<b>Maximum Marks:</b> {max_marks}", styles["Normal"]))
    story.append(Spacer(1, 10))

    if instructions:
        story.append(Paragraph("<b>Instructions:</b>", styles["Normal"]))
        for ins in instructions:
            story.append(Paragraph(f"- {ins}", styles["Normal"]))
        story.append(Spacer(1, 10))

    for section in sections:
        story.append(Paragraph(section["name"], section_style))
        for i, q in enumerate(section["questions"], start=1):
            story.extend(_question_flowables(q, i))

    if include_answers:
        story.append(PageBreak())
        story.append(Paragraph("Answer Key", title_style))
        story.append(Spacer(1, 10))
        for section in sections:
            story.append(Paragraph(section["name"], section_style))
            for i, q in enumerate(section["questions"], start=1):
                if q.get("question_type") == "mcq" and q.get("correct_option"):
                    ans = f"Correct option: {q['correct_option']}" + (f" — {q['answer']}" if q.get("answer") else "")
                else:
                    ans = q.get("answer") or "(no model answer generated)"
                story.append(Paragraph(f"<b>A{i}.</b> {ans}", answer_style))

    decorator = _make_page_decorator(watermark_text, qr_image_path)
    doc.build(story, onFirstPage=decorator, onLaterPages=decorator)
    return output_path


def build_university_pdf(
    output_path: str,
    university_name: str,
    exam_title: str,          # e.g. "MID TERM EXAMINATION"
    semester_label: str,      # e.g. "Odd Semester 2024-25"
    school: str,
    programme: str,
    course_code: str,
    course_name: str,
    semester: str,
    time_str: str,
    max_marks: int,
    instructions: str,
    sections: list,           # [{"name": "Section-A", "questions": [{...}]}]
    logo_path: str = None,
    watermark_text: str = None,
    qr_image_path: str = None,
):
    """Matches the common Indian-university mid-term/end-semester layout:
    Roll No line, metadata block, then a Q.No / Question / Marks / CO-L table
    per section. Marks and CO/L are derived automatically from each
    question's `marks` and `bloom_level`/`unit` fields."""
    doc = SimpleDocTemplate(output_path, pagesize=A4,
                             topMargin=16 * mm, bottomMargin=16 * mm,
                             leftMargin=16 * mm, rightMargin=16 * mm)
    story = []

    # ---- Header ----
    header_style = ParagraphStyle("Header", parent=styles["Normal"], fontSize=9)
    story.append(Paragraph("Roll No: ____________________", header_style))
    story.append(Spacer(1, 4))

    if logo_path and os.path.exists(logo_path):
        try:
            logo = Image(logo_path, width=20 * mm, height=20 * mm, kind="proportional")
            logo.hAlign = "CENTER"
            story.append(logo)
        except Exception:
            pass

    story.append(Paragraph(f"<b>{university_name}</b>", title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"<b>{exam_title}</b>", center_style))
    story.append(Paragraph(semester_label, center_style))
    story.append(Spacer(1, 10))

    meta_rows = [
        ["School:", school, "Programme Name:", programme],
        ["Course Code:", course_code, "Course Name:", course_name],
        ["Semester:", semester, "Time:", time_str],
        ["Maximum Marks:", str(max_marks), "", ""],
    ]
    meta_table = Table(meta_rows, colWidths=[32 * mm, 60 * mm, 34 * mm, 52 * mm])
    meta_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph(f"<b>Instructions:</b> {instructions}", header_style))
    story.append(Spacer(1, 10))

    # ---- Sections as Q.No / Question / Marks / CO-L tables ----
    section_letters = "ABCDEFGH"
    for s_idx, section in enumerate(sections):
        story.append(Paragraph(section.get("name") or f"Section-{section_letters[s_idx]}", section_style))

        rows = [["Q.No", "Question", "Marks", "CO/L"]]
        row_heights = [None]
        for i, q in enumerate(section["questions"], start=1):
            cell_flowables = _question_flowables(q, i)
            # first flowable already includes "Q{i}." — swap in a bare paragraph
            # for the table cell so the Q.No column isn't duplicated
            cell_flowables[0] = Paragraph(q["question"], cell_style)
            l_code = BLOOM_TO_L.get(q.get("bloom_level"), "L-2")
            co_code = _co_from_unit(q.get("unit"))
            rows.append([str(i), cell_flowables, str(q.get("marks", "")), f"{co_code} [{l_code}]"])

        table = Table(rows, colWidths=[12 * mm, 118 * mm, 16 * mm, 24 * mm], repeatRows=1)
        table.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#94a3b8")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (2, 0), (3, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(table)
        story.append(Spacer(1, 10))

    # ---- Answer key (always on its own page, same as standard export) ----
    if any(q.get("answer") or q.get("correct_option") for section in sections for q in section["questions"]):
        story.append(PageBreak())
        story.append(Paragraph("Answer Key", title_style))
        story.append(Spacer(1, 10))
        for s_idx, section in enumerate(sections):
            story.append(Paragraph(section.get("name") or f"Section-{section_letters[s_idx]}", section_style))
            for i, q in enumerate(section["questions"], start=1):
                if q.get("question_type") == "mcq" and q.get("correct_option"):
                    ans = f"Correct option: {q['correct_option']}" + (f" — {q['answer']}" if q.get("answer") else "")
                else:
                    ans = q.get("answer") or "(no model answer generated)"
                story.append(Paragraph(f"<b>A{i}.</b> {ans}", answer_style))

    decorator = _make_page_decorator(watermark_text, qr_image_path)
    doc.build(story, onFirstPage=decorator, onLaterPages=decorator)
    return output_path
