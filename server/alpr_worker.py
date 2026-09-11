import base64
import contextlib
import io
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


def recognize(encoded):
    raw = base64.b64decode(encoded, validate=True)
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Unreadable image")
    if image.shape[0] * image.shape[1] > 16_000_000:
        raise ValueError("Image dimensions are too large")
    with contextlib.redirect_stdout(sys.stderr):
        results = alpr.predict(image)
    candidates = []
    for result in results:
        if result.ocr is None:
            continue
        text = re.sub(r"[^A-Z0-9]", "", result.ocr.text.upper())
        if 4 <= len(text) <= 15 and re.search(r"[A-Z]", text) and re.search(r"\d", text):
            score = confidence(result.ocr.confidence) * float(result.detection.confidence)
            candidates.append((score, text, confidence(result.ocr.confidence), float(result.detection.confidence)))
    if not candidates:
        raise ValueError("No readable number plate found")
    score, text, ocr_confidence, detection_confidence = max(candidates)
    return {"plate": text, "confidence": score, "ocr_confidence": ocr_confidence, "detection_confidence": detection_confidence}


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
