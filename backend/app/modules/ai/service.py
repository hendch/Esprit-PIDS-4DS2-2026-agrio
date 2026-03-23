from __future__ import annotations

from app.modules.ai.agent.orchestrator import AgentOrchestrator
from app.modules.ai.rag.retriever import RAGRetriever


class AIService:
    def __init__(self, retriever: RAGRetriever, orchestrator: AgentOrchestrator) -> None:
        self._retriever = retriever
        self._orchestrator = orchestrator

    async def explain(self, context: dict, question: str | None = None) -> dict:
        return {
            "explanation": None,
            "context": context,
            "question": question,
            "status": "not_implemented",
        }

    async def chat(self, message: str, conversation_id: str | None = None) -> dict:
        return {
            "reply": None,
            "conversation_id": conversation_id,
            "message": message,
            "status": "not_implemented",
        }
