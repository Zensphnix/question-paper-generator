import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image
from reportlab.lib.enums import TA_CENTER

styles = getSampleStyleSheet()
title_style = ParagraphStyle("Title2", parent=styles["Title"], alignment=TA_CENTER)
center_style = ParagraphStyle("Center", parent=styles["Normal"], alignment=TA_CENTER)
section_style = ParagraphStyle("Section", parent=styles["Heading2"], spaceBefore=14)
question_style = ParagraphStyle("Question", parent=styles["Normal"], spaceAfter=8, leftIndent=10)
answer_style = ParagraphStyle("Answer", parent=styles["Normal"], spaceAfter=10, leftIndent=10, textColor="#334155")


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
            story.append(Paragraph(f"Q{i}. {q['question']}", question_style))

    if include_answers:
        story.append(PageBreak())
        story.append(Paragraph("Answer Key", title_style))
        story.append(Spacer(1, 10))
        for section in sections:
            story.append(Paragraph(section["name"], section_style))
            for i, q in enumerate(section["questions"], start=1):
                ans = q.get("answer") or "(no model answer generated)"
                story.append(Paragraph(f"<b>A{i}.</b> {ans}", answer_style))

    doc.build(story)
    return output_path
