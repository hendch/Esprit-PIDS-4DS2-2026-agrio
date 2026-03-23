from __future__ import annotations

from app.modules.disease.model_registry.interface import ModelRunner


class RemoteModelRunner(ModelRunner):
    # TODO: integrate with remote ML inference endpoint
    async def predict(self, image_bytes: bytes) -> dict:
        raise NotImplementedError
