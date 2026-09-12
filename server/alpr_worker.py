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

    # Mild upscale + sharpening helps small plates and soft mobile-camera frames.
    up = cv2.resize(image, None, fx=1.6, fy=1.6, interpolation=cv2.INTER_CUBIC)
    blurred = cv2.GaussianBlur(up, (0, 0), 1.2)
    sharp = cv2.addWeighted(up, 1.45, blurred, -0.45, 0)
    yield sharp

    # CLAHE improves plates affected by shadows/glare while retaining colour edges.
    lab = cv2.cvtColor(up, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8)).apply(l)
    enhanced = cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)
    yield enhanced


def recognize(encoded):
    raw = base64.b64decode(encoded, validate=True)
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Unreadable image")
    if image.shape[0] * image.shape[1] > 16_000_000:
        raise ValueError("Image dimensions are too large")

    candidates = []
    seen = set()

    # Run FastALPR on the original and two deterministic enhancement variants.
    # We aggregate evidence instead of trusting a single OCR pass, which is the
    # main fix for mobile frames where the final 1–2 characters are intermittently lost.
    for variant_index, frame in enumerate(variants(image)):
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
            key = (text, variant_index)
            if key in seen:
                continue
            seen.add(key)
            candidates.append(
                (score, text, ocr_score, detection_score, variant_index)
            )

    if not candidates:
        raise ValueError("No readable number plate found")

    # Prefer repeated text across variants, then higher confidence, then longer
    # text. Longer repeated readings are useful when one OCR pass truncates a suffix.
    grouped = {}
    for score, text, ocr_score, detection_score, variant_index in candidates:
        item = grouped.setdefault(
            text,
            {"votes": 0, "best": (0.0, 0.0, 0.0, 0)}
        )
        item["votes"] += 1
        item["best"] = max(
            item["best"],
            (score, ocr_score, detection_score, -variant_index),
        )

    ranked = sorted(
        grouped.items(),
        key=lambda pair: (
            pair[1]["votes"],
            pair[1]["best"][0],
            len(pair[0]),
        ),
        reverse=True,
    )

    text, item = ranked[0]
    score, ocr_confidence, detection_confidence, _ = item["best"]

    return {
        "plate": text,
        "confidence": score,
        "ocr_confidence": ocr_confidence,
        "detection_confidence": detection_confidence,
        "variants_checked": len(list(variants(image))),
        "votes": item["votes"],
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
