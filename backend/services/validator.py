from difflib import SequenceMatcher


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def is_low_quality(question: str) -> bool:
    q = question.strip()
    if len(q) < 10:
        return True
    if not q.endswith(("?", ".")):
        return True
    return False


def remove_duplicates(items, threshold: float = 0.85):
    """items: list of dicts with a 'question' key. Drops near-duplicates."""
    unique = []
    for item in items:
        text = item["question"]
        if is_low_quality(text):
            continue
        if any(_similarity(text, u["question"]) >= threshold for u in unique):
            continue
        unique.append(item)
    return unique


def validate_against_existing(new_items, existing_questions, threshold: float = 0.85):
    """Filter out items that duplicate anything already stored in the DB.
    existing_questions: list of plain question strings."""
    kept = []
    for item in new_items:
        text = item["question"]
        if is_low_quality(text):
            continue
        if any(_similarity(text, ex) >= threshold for ex in existing_questions):
            continue
        kept.append(item)
    return kept
