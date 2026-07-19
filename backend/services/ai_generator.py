import os
import json
import time
from google import genai
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL = "gemini-3.1-flash-lite"

SINGLE_PROMPT = """You are an experienced university exam-paper setter.

Generate {count} unique {difficulty}-difficulty exam questions on the topic: "{topic}".

The questions MUST be written at the "{bloom_level}" level of Bloom's Taxonomy
(use verbs and question structures appropriate to that level).
Each question should be worth {marks} marks.
Write both the questions and the answers in {language}.

For each question, also provide a concise model answer (2-5 sentences, or a short
worked solution if the topic is technical/mathematical).

Return ONLY a JSON array of objects. No preamble, no markdown fences.
Format: [{{"question": "...", "answer": "..."}}, ...]
"""

MIXED_PROMPT = """You are an experienced university exam-paper setter.

Generate {count} unique {difficulty}-difficulty exam questions on the topic: "{topic}".

Spread the questions as evenly as possible across ALL SIX Bloom's Taxonomy levels:
Remember, Understand, Apply, Analyze, Evaluate, Create.
Each question should be worth {marks} marks.
Write both the questions and the answers in {language}.

For each question, also provide a concise model answer (2-5 sentences, or a short
worked solution if the topic is technical/mathematical).

Return ONLY a JSON array of objects. No preamble, no markdown fences.
Format: [{{"question": "...", "answer": "...", "bloom_level": "..."}}, ...]
"""

MCQ_PROMPT = """You are an experienced university exam-paper setter.

Generate {count} unique {difficulty}-difficulty multiple-choice questions on the topic: "{topic}".

Each question must have EXACTLY 4 options, with exactly ONE correct answer.
Make the incorrect options plausible (not obviously wrong) — this should test real
understanding, not just elimination. Write everything in {language}.

Return ONLY a JSON array of objects. No preamble, no markdown fences.
Format: [{{"question": "...", "options": ["...", "...", "...", "..."], "correct_option": "A", "answer": "brief explanation of why this is correct"}}, ...]
The "correct_option" must be one of "A", "B", "C", "D", matching the 0-indexed position in "options".
"""


def _call_model(prompt: str, retries: int = 2, backoff_seconds: float = 1.5):
    """Wraps the Gemini call with retries — free-tier APIs occasionally throw
    transient 429/503 errors, which is what was causing the 'button doesn't
    work sometimes' behavior."""
    last_error = None
    for attempt in range(retries + 1):
        try:
            return client.models.generate_content(model=MODEL, contents=prompt)
        except Exception as e:
            last_error = e
            if attempt < retries:
                time.sleep(backoff_seconds * (attempt + 1))
    raise RuntimeError(f"AI generation failed after {retries + 1} attempts: {last_error}")


def _parse_items(raw_text: str):
    raw = raw_text.strip().replace("```json", "").replace("```", "").strip()
    try:
        items = json.loads(raw)
    except json.JSONDecodeError:
        # fallback: treat each non-empty line as a question with no answer
        items = [{"question": line.strip("- ").strip(), "answer": ""}
                  for line in raw.splitlines() if line.strip()]

    normalized = []
    for item in items:
        if isinstance(item, dict):
            normalized.append({
                "question": str(item.get("question", "")).strip(),
                "answer": str(item.get("answer", "")).strip(),
                "bloom_level": str(item.get("bloom_level", "")).strip(),
            })
        else:
            normalized.append({"question": str(item).strip(), "answer": "", "bloom_level": ""})
    return [i for i in normalized if i["question"]]


def _parse_mcq_items(raw_text: str):
    raw = raw_text.strip().replace("```json", "").replace("```", "").strip()
    try:
        items = json.loads(raw)
    except json.JSONDecodeError:
        return []

    normalized = []
    for item in items:
        if not isinstance(item, dict):
            continue
        options = item.get("options", [])
        if not isinstance(options, list) or len(options) != 4:
            continue  # malformed MCQ — skip rather than ship a broken question
        correct = str(item.get("correct_option", "")).strip().upper()
        if correct not in ("A", "B", "C", "D"):
            continue
        normalized.append({
            "question": str(item.get("question", "")).strip(),
            "options": [str(o).strip() for o in options],
            "correct_option": correct,
            "answer": str(item.get("answer", "")).strip(),
        })
    return [i for i in normalized if i["question"]]


def generate_mcq_questions(topic: str, difficulty: str, count: int = 5, language: str = "English"):
    """Generate `count` multiple-choice questions, each with 4 options and one
    correct answer clearly marked."""
    prompt = MCQ_PROMPT.format(topic=topic, difficulty=difficulty, count=count, language=language)
    response = _call_model(prompt)
    return _parse_mcq_items(response.text)[:count]


def generate_questions(topic: str, bloom_level: str, marks: int, difficulty: str,
                        count: int = 5, language: str = "English"):
    """Generate `count` questions, all at one specific Bloom's level."""
    prompt = SINGLE_PROMPT.format(
        topic=topic, bloom_level=bloom_level, marks=marks, difficulty=difficulty,
        count=count, language=language,
    )
    response = _call_model(prompt)
    return _parse_items(response.text)[:count]


def generate_mixed_questions(topic: str, marks: int, difficulty: str,
                              count: int = 6, language: str = "English"):
    """Generate `count` questions for one topic, spread across all Bloom's levels
    in a SINGLE API call. This is what powers bulk/auto paper generation without
    burning through free-tier rate limits."""
    prompt = MIXED_PROMPT.format(
        topic=topic, marks=marks, difficulty=difficulty, count=count, language=language
    )
    response = _call_model(prompt)
    return _parse_items(response.text)[:count]
