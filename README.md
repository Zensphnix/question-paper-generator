# Automated Question Paper Generator

## Run the backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

pip install -r requirements.txt

copy .env.example .env       # Windows
# cp .env.example .env       # Mac/Linux
# then paste your OPENAI_API_KEY into .env

uvicorn main:app --reload
```
Backend runs at http://localhost:8000. Open http://localhost:8000/docs to test endpoints directly.

## Run the frontend

Open a **second** VS Code terminal:

```bash
cd frontend
npm install
npm run dev
```
Frontend runs at http://localhost:5173.

## Flow
1. Upload a PDF/DOCX/TXT on the Upload page → topics are extracted.
2. Pick topic, Bloom's level, marks, difficulty, count on Configure → AI generates questions.
3. Select questions on Preview → Build paper → Download PDF.

## Where each module from the project doc lives
- Text extraction → `backend/services/pdf_parser.py`
- Topic extraction → `backend/services/topic_extractor.py`
- Bloom's classifier → `backend/services/bloom_classifier.py`
- AI question generator → `backend/services/ai_generator.py`
- Validation (dedup/quality) → `backend/services/validator.py`
- PDF Generator → `backend/services/pdf_export.py`
- Database models → `backend/models.py` (SQLite, file `backend/qpg.db`, auto-created on first run)
- API routes → `backend/main.py`
- Frontend pages → `frontend/src/pages/`

## Next things to build (good for your report's "future work")
- Real auth (`/auth/login` + JWT) instead of open access
- Unit-wise paper builder with multiple sections (currently one section end-to-end demo)
- Swap OpenAI for Gemini/local LLM in `ai_generator.py`
- Replace heuristic topic/Bloom extraction with a trained classifier
