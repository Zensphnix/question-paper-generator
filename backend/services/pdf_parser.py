import fitz  # PyMuPDF
import docx


def extract_text_from_pdf(file_path: str) -> str:
    text = []
    doc = fitz.open(file_path)
    for page in doc:
        text.append(page.get_text())
    doc.close()
    return "\n".join(text)


def extract_text_from_docx(file_path: str) -> str:
    d = docx.Document(file_path)
    return "\n".join(p.text for p in d.paragraphs)


def extract_text_from_txt(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def extract_text(file_path: str, filename: str) -> str:
    ext = filename.lower().split(".")[-1]
    if ext == "pdf":
        return extract_text_from_pdf(file_path)
    if ext == "docx":
        return extract_text_from_docx(file_path)
    if ext == "txt":
        return extract_text_from_txt(file_path)
    raise ValueError(f"Unsupported file type: {ext}")
