import re
from collections import Counter

STOPWORDS = set("""
a an the is are was were be been being of in on at to for and or with as by
from this that these those it its into over under between within without
about above below up down out off again further then once here there all
any both each few more most other some such no nor not only own same so
than too very can will just should now
""".split())


def _clean_lines(text: str):
    return [ln.strip() for ln in text.splitlines() if ln.strip()]


def extract_headings(text: str, max_len_words: int = 8):
    """Lines that look like headings: short, no trailing period, mostly capitalized words."""
    headings = []
    for line in _clean_lines(text):
        words = line.split()
        if 1 <= len(words) <= max_len_words and not line.endswith((".", ",", ";")):
            cap_ratio = sum(1 for w in words if w[:1].isupper()) / len(words)
            if cap_ratio >= 0.5:
                headings.append(line.strip(":-• "))
    # de-duplicate, preserve order
    seen = set()
    result = []
    for h in headings:
        key = h.lower()
        if key not in seen and len(h) > 2:
            seen.add(key)
            result.append(h)
    return result


def extract_keywords(text: str, top_n: int = 15):
    """Frequency-based keyword fallback when headings are sparse."""
    words = re.findall(r"[A-Za-z][A-Za-z\-]{2,}", text)
    filtered = [w for w in words if w.lower() not in STOPWORDS]
    counts = Counter(w.capitalize() for w in filtered)
    return [w for w, _ in counts.most_common(top_n)]


def extract_topics(text: str):
    headings = extract_headings(text)
    topics = headings if len(headings) >= 3 else extract_keywords(text, top_n=40)
    return topics[:40]
