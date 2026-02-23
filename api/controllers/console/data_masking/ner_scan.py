"""NER-based sensitive entity scanning for data masking.

Uses jieba (Chinese word segmentation with POS tagging) to identify
candidate sensitive entities in document text. Returns categorized
entities for user confirmation before masking.
"""

from __future__ import annotations

import re
from collections import Counter

from flask import Blueprint, request

ner_bp = Blueprint("ner_scan", __name__, url_prefix="/console/api/data-masking/ner")

# jieba POS tag to human-readable category
POS_LABEL_MAP: dict[str, str] = {
    "nr": "\u4eba\u540d",
    "ns": "\u5730\u540d",
    "nt": "\u673a\u6784\u540d",
    "nz": "\u4e13\u6709\u540d\u8bcd",
    "t": "\u65f6\u95f4",
}

# POS tags we consider potentially sensitive
SENSITIVE_POS: set[str] = {"nr", "ns", "nt", "nz"}

# Common generic words to exclude
STOP_WORDS: set[str] = {
    "\u4e2d\u56fd", "\u4e2d\u534e", "\u56fd\u5bb6", "\u5168\u56fd", "\u672c", "\u5404",
    "AI", "PDF", "Excel", "Web", "APP", "AR",
    "\u53d8\u7535\u7ad9", "\u673a\u623f", "\u901a\u4fe1", "\u4fe1\u606f", "\u8fd0\u7ef4", "\u8bbe\u5907",
    "\u7cfb\u7edf", "\u5e73\u53f0", "\u6280\u672f", "\u6570\u636e", "\u7ba1\u7406", "\u670d\u52a1",
    "\u7535\u529b", "\u7535\u7f51", "\u4f9b\u7535", "\u8f93\u7535", "\u914d\u7535",
    "\u6545\u969c", "\u5de1\u68c0", "\u53f0\u8d26", "\u62a5\u544a", "\u5de5\u5355",
    "\u5149\u7ea4", "\u5149\u7f06", "\u7ea4\u82af", "\u7aef\u53e3", "\u5149\u8def",
    "\u6a21\u578b", "\u7b97\u6cd5", "\u6df1\u5ea6\u5b66\u4e60", "\u673a\u5668\u5b66\u4e60",
    "\u65b9\u6848", "\u7814\u7a76", "\u5e94\u7528", "\u9879\u76ee", "\u5de5\u7a0b",
    "\u4eba\u5458", "\u8d1f\u8d23\u4eba", "\u7ba1\u7406\u5458", "\u4e13\u5bb6",
}

# Regex patterns for structured sensitive data
REGEX_PATTERNS: list[tuple[str, str, str]] = [
    ("phone", "\u624b\u673a\u53f7", r"1[3-9]\d{9}"),
    ("email", "\u90ae\u7bb1", r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"),
    ("id_card", "\u8eab\u4efd\u8bc1\u53f7", r"[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]"),
    ("ip_addr", "IP\u5730\u5740", r"\b(?:\d{1,3}\.){3}\d{1,3}\b"),
    ("amount", "\u91d1\u989d", r"[\u00a5\uffe5]\s?\d[\d,]*(?:\.\d{1,2})?\s*(?:\u4e07\u5143|\u5143|\u4e07)?"),
]

def _scan_with_regex(text: str) -> list[dict[str, str]]:
    """Find structured sensitive data via regex."""
    results: list[dict[str, str]] = []
    for entity_type, label, pattern in REGEX_PATTERNS:
        for m in re.finditer(pattern, text):
            results.append({
                "text": m.group(),
                "label": label,
                "type": entity_type,
                "start": str(m.start()),
            })
    return results


def _scan_with_ner(text: str) -> list[dict[str, str]]:
    """Find named entities via jieba POS tagging."""
    import jieba.posseg as pseg

    entity_counter: Counter[tuple[str, str]] = Counter()
    lines = text.split("\n")
    for line in lines:
        line = line.strip()
        if not line:
            continue
        words = pseg.cut(line)
        for word, flag in words:
            if flag not in SENSITIVE_POS:
                continue
            word = word.strip()
            if len(word) < 2:
                continue
            if word in STOP_WORDS:
                continue
            entity_counter[(word, flag)] += 1

    results: list[dict[str, str]] = []
    for (word, flag), count in entity_counter.most_common():
        results.append({
            "text": word,
            "label": POS_LABEL_MAP.get(flag, flag),
            "type": flag,
            "count": str(count),
        })
    return results


@ner_bp.route("/scan", methods=["POST"])
def scan_entities():
    """Scan text for sensitive entities using regex + jieba NER.

    Request body: {"content": "...text..."}
    Returns: {"entities": [...]}
    """
    data = request.get_json(silent=True)
    if not data or not data.get("content"):
        return {"error": "content is required"}, 400

    content: str = data["content"]
    if len(content) > 500_000:
        return {"error": "content too large (max 500KB)"}, 400

    regex_results = _scan_with_regex(content)
    try:
        ner_results = _scan_with_ner(content)
    except Exception:
        ner_results = []

    seen: dict[str, dict[str, str]] = {}
    for entity in ner_results:
        key = entity["text"]
        if key not in seen:
            seen[key] = entity

    for entity in regex_results:
        key = entity["text"]
        if key not in seen:
            count = content.count(key)
            entity["count"] = str(count)
            seen[key] = entity

    entities = sorted(seen.values(), key=lambda e: int(e.get("count", "1")), reverse=True)
    return {"entities": entities}