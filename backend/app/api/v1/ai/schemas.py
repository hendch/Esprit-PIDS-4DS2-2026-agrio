from __future__ import annotations

from pydantic import BaseModel


class ExplainRequest(BaseModel):
    context: dict
    question: str | None = None


class ExplainResponse(BaseModel):
    explanation: str
    sources: list[str]
    confidence: float | None = None


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    reply: str
    conversation_id: str
    sources: list[str] | None = None
