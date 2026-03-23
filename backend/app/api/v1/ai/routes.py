from __future__ import annotations

import uuid

from fastapi import APIRouter

from .schemas import ChatRequest, ChatResponse, ExplainRequest, ExplainResponse

router = APIRouter()


@router.post("/explain", response_model=ExplainResponse)
async def explain(body: ExplainRequest) -> ExplainResponse:
    # TODO: inject service
    return ExplainResponse(
        explanation="Based on current NDVI trends, your crop is experiencing moderate water stress.",
        sources=["satellite/ndvi", "weather/forecast"],
        confidence=0.78,
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    # TODO: inject service
    return ChatResponse(
        reply="I can help with that. Your field's soil moisture is currently at 32%, which is below the optimal range.",
        conversation_id=body.conversation_id or str(uuid.uuid4()),
        sources=["irrigation/sensors", "weather/history"],
    )
