from __future__ import annotations

import base64
import io
import logging
from pathlib import Path

from PIL import Image

from app.settings import settings

logger = logging.getLogger(__name__)

# Lazy-loaded singleton — the model is heavy so we only load once.
_model = None


def _get_model():
    global _model
    if _model is not None:
        return _model

    from ultralytics import YOLO

    model_path = settings.segmentation_model_path
    if not model_path:
        raise RuntimeError(
            "AGRIO_SEGMENTATION_MODEL_PATH is not configured. "
            "Set it to the absolute path of your YOLOv8 segmentation best.pt file."
        )

    p = Path(model_path)
    if not p.exists():
        raise FileNotFoundError(f"Segmentation model not found: {p}")

    logger.info("Loading YOLOv8 segmentation model from %s ...", p)
    _model = YOLO(str(p))
    logger.info("Segmentation model loaded successfully.")
    return _model


def run_segmentation(image_bytes: bytes, conf: float = 0.30) -> dict:
    """Run YOLOv8 segmentation on raw image bytes.

    Returns a dict with:
      - annotated_image: base64-encoded JPEG of the image with masks drawn
      - regions: list of {class_name, confidence, bbox [x1,y1,x2,y2]}
    """
    model = _get_model()

    # Decode incoming bytes into a PIL image
    pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # Run inference
    results = model.predict(source=pil_image, conf=conf, iou=0.45, verbose=False)
    result = results[0]

    # Build annotated image (masks overlaid)
    annotated_bgr = result.plot(labels=False, boxes=False, conf=False)

    # Convert BGR numpy array → RGB PIL → JPEG base64
    annotated_rgb = annotated_bgr[:, :, ::-1]  # BGR → RGB
    annotated_pil = Image.fromarray(annotated_rgb)
    buf = io.BytesIO()
    annotated_pil.save(buf, format="JPEG", quality=85)
    annotated_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    # Build regions list
    regions = []
    boxes = result.boxes
    names = result.names  # {class_id: class_name}

    if boxes is not None:
        for i in range(len(boxes)):
            cls_id = int(boxes.cls[i].item())
            confidence = round(float(boxes.conf[i].item()) * 100, 1)
            x1, y1, x2, y2 = boxes.xyxy[i].tolist()
            regions.append(
                {
                    "class_name": names.get(cls_id, f"class_{cls_id}"),
                    "confidence": confidence,
                    "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                }
            )

    return {
        "annotated_image": annotated_b64,
        "regions": regions,
        "total_regions": len(regions),
    }
