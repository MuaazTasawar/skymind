"""
detector.py
YOLOv8 object detection on JPEG frames received via gRPC.

Uses ultralytics YOLOv8n (nano) — smallest model, runs on CPU,
no GPU required. Model is auto-downloaded on first run (~6MB).

Returns bounding boxes, labels, and confidence scores.
"""

import io
import time
import logging
from typing import List, Dict, Any

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


class ObjectDetector:
    """
    Wraps a YOLOv8 model for inference on raw JPEG bytes.
    Lazy-loads the model on first call to avoid slowing down server startup.
    """

    def __init__(self, model_name: str = "yolov8n.pt", confidence: float = 0.35):
        self.model_name = model_name
        self.confidence = confidence
        self._model = None

    def _load_model(self):
        """Lazy-load YOLOv8 model on first inference call."""
        if self._model is None:
            logger.info(f"[detector] loading model: {self.model_name}")
            try:
                from ultralytics import YOLO
                self._model = YOLO(self.model_name)
                logger.info(f"[detector] model loaded: {self.model_name}")
            except Exception as e:
                logger.error(f"[detector] failed to load model: {e}")
                raise

    def detect(
        self,
        frame_jpeg: bytes,
        drone_id: str = "",
        mission_id: str = "",
    ) -> List[Dict[str, Any]]:
        """
        Run YOLOv8 inference on a JPEG frame.

        Args:
            frame_jpeg:  Raw JPEG bytes from the drone camera.
            drone_id:    For logging only.
            mission_id:  For logging only.

        Returns:
            List of detection dicts:
            [
              {
                "label":      "person",
                "confidence": 0.87,
                "x1": 120.0, "y1": 80.0,
                "x2": 240.0, "y2": 310.0,
              },
              ...
            ]
        """
        self._load_model()

        # Decode JPEG bytes → PIL Image → numpy array
        try:
            image = Image.open(io.BytesIO(frame_jpeg)).convert("RGB")
            frame_np = np.array(image)
        except Exception as e:
            logger.error(f"[detector] decode error drone={drone_id}: {e}")
            return []

        # Run inference
        t0 = time.time()
        try:
            results = self._model(
                frame_np,
                conf=self.confidence,
                verbose=False,
            )
        except Exception as e:
            logger.error(f"[detector] inference error drone={drone_id}: {e}")
            return []

        elapsed_ms = (time.time() - t0) * 1000
        logger.debug(
            f"[detector] drone={drone_id} mission={mission_id} "
            f"inference={elapsed_ms:.1f}ms"
        )

        # Parse results
        detections = []
        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                xyxy = box.xyxy[0].tolist()   # [x1, y1, x2, y2]
                conf = float(box.conf[0])
                cls  = int(box.cls[0])
                label = result.names.get(cls, str(cls))

                detections.append({
                    "label":      label,
                    "confidence": round(conf, 4),
                    "x1": round(xyxy[0], 2),
                    "y1": round(xyxy[1], 2),
                    "x2": round(xyxy[2], 2),
                    "y2": round(xyxy[3], 2),
                })

        logger.info(
            f"[detector] drone={drone_id} found {len(detections)} object(s)"
        )
        return detections