from __future__ import annotations

from app.modules.disease.model_registry.interface import ModelRunner


class MockModelRunner(ModelRunner):
    async def predict(self, image_bytes: bytes) -> dict:
        return {
            "disease_name": "Leaf Blight",
            "confidence": 0.87,
            "severity": "moderate",
        }
