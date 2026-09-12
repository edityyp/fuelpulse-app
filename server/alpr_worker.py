import base64
import contextlib
import json
import re
import sys

import cv2
import numpy as np
from fast_alpr import ALPR

with contextlib.redirect_stdout(sys.stderr):
    alpr = ALPR(
        detector_model="yolo-v9-t-384-license-plate-end2end",
        ocr_model="cct-xs-v2-global-model",
        ocr_device="cpu",
    )


def confidence(value):
    if isinstance(value, list):
        return sum(value) / len(value) if value else 0.0
    return float(value)


def normalize(text):
    return re.sub(r"[^A-Z0-9]", "", text.upper())


def variants(image):
    """Create a small set of OCR-friendly variants without changing plate geometry."""
    yield image

    up = cv2.resize(image, None, fx=1.6, fy=1.6, interpolation=cv2.INTER_CUBIC)
    blurred = cv2.GaussianBlur(up, (0, 0), 1.2)
    sharp = cv2.addWeighted(up, 1.45, blurred, -0.45, 0)
    yield sharp

    lab = cv2.cvtColor(up, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8)).apply(l)
    enhanced = cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)
    yield enhanced


def structural_score(text):
    """Light Indian-plate shape prior; never rejects a candidate by shape alone."""
    if re.fullmatch(r"[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}", text):
        return 1.0
    if re.fullmatch(r"[A-Z]{2}[0-9]{2,3}[A-Z]{0,3}[0-9]{1,4}", text):
        return 0.75
    return 0.25


def consolidate(grouped):
    """Merge truncated OCR readings with a longer compatible reading.

    Mobile cameras often produce e.g. ABC1234 and ABC12345 on different frames.
    Treating these as unrelated votes makes the shorter result win. If the shorter
    reading is a prefix of a longer reading and the longer reading has reasonable
    confidence, transfer the shorter evidence to the longer candidate.
    """
    items = []
    for text, item in grouped.items():
        items.append(
            {
                "text": text,
                "votes": item["votes"],
                "score": item["score"],
                "ocr": item["ocr"],
                "detection": item["detection"],
            }
        )

    for short in items:
        for long in items:
            if short is long or len(long["text"]) <= len(short["text"]):
                continue
            if not long["text"].startswith(short["text"]):
                continue
            if len(long["text"]) - len(short["text"]) > 3:
                continue
            if long["score"] < short["score"] * 0.72:
                continue
            long["votes"] += short["votes"]
            long["score"] = max(long["score"], short["score"] * 0.92)

    return items


def recognize(encoded):
    raw = base64.b64decode(encoded, validate=True)
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Unreadable image")
    if image.shape[0] * image.shape[1] > 16_000_000:
        raise ValueError("Image dimensions are too large")

    grouped = {}

    for frame in variants(image):
        with contextlib.redirect_stdout(sys.stderr):
            results = alpr.predict(frame)

        for result in results:
            if result.ocr is None:
                continue

            text = normalize(result.ocr.text)
            if not (4 <= len(text) <= 15):
                continue
            if not re.search(r"[A-Z]", text) or not re.search(r"\d", text):
                continue

            ocr_score = confidence(result.ocr.confidence)
            detection_score = float(result.detection.confidence)
            score = ocr_score * detection_score
            item = grouped.setdefault(
                text,
                {
                    "votes": 0,
                    "score": 0.0,
                    "ocr": 0.0,
                    "detection": 0.0,
                },
            )
            item["votes"] += 1
            item["score"] = max(item["score"], score)
            item["ocr"] = max(item["ocr"], ocr_score)
            item["detection"] = max(item["detection"], detection_score)

    if not grouped:
        raise ValueError("No readable number plate found")

    items = consolidate(grouped)
    best = max(
        items,
        key=lambda item: (
            item["votes"],
            structural_score(item["text"]),
            item["score"],
            len(item["text"]),
        ),
    )

    return {
        "plate": best["text"],
        "confidence": best["score"],
        "ocr_confidence": best["ocr"],
        "detection_confidence": best["detection"],
        "variants_checked": 3,
        "votes": best["votes"],
    }


for line in sys.stdin:
    request_id = None
    try:
        request = json.loads(line)
        request_id = request.get("id")
        response = {"id": request_id, "ok": True, **recognize(request["image"])}
    except Exception as error:
        response = {"id": request_id, "ok": False, "error": str(error)}
    sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
    sys.stdout.flush()
