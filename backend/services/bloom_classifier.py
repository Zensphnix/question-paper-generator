import re

# Verb banks per Bloom's Taxonomy level (classic Bloom's revised taxonomy action verbs)
BLOOM_VERBS = {
    "Remember": ["define", "list", "state", "recall", "identify", "name", "label", "what is", "who", "when"],
    "Understand": ["explain", "describe", "summarize", "discuss", "illustrate", "interpret", "classify", "give an example"],
    "Apply": ["apply", "demonstrate", "solve", "use", "implement", "write a program", "calculate", "show how"],
    "Analyze": ["compare", "contrast", "differentiate", "analyze", "examine", "break down", "relate", "why does"],
    "Evaluate": ["evaluate", "justify", "critique", "assess", "argue", "which is better", "recommend", "judge"],
    "Create": ["design", "propose", "construct", "develop", "formulate", "create", "build", "devise"],
}

# Order matters for tie-breaking: higher-order levels checked after lower ones
LEVEL_ORDER = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]


def classify_question(question_text: str) -> str:
    """Return the Bloom's level whose verb bank best matches the question wording.
    Falls back to 'Understand' if nothing matches clearly."""
    text = question_text.lower()
    scores = {level: 0 for level in LEVEL_ORDER}

    for level, verbs in BLOOM_VERBS.items():
        for verb in verbs:
            if re.search(r"\b" + re.escape(verb) + r"\b", text):
                scores[level] += 1

    best_level = max(scores, key=scores.get)
    if scores[best_level] == 0:
        return "Understand"
    return best_level


def matches_target_level(question_text: str, target_level: str) -> bool:
    return classify_question(question_text) == target_level
