from __future__ import annotations


class RAGRetriever:
    # TODO: integrate with vector store (pgvector / FAISS / etc.)
    async def retrieve(self, query: str, top_k: int = 5) -> list[dict]:
        return []
