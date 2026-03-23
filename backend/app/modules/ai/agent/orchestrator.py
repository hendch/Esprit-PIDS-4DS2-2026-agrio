from __future__ import annotations


class AgentOrchestrator:
    def __init__(self, tools: list) -> None:
        self._tools = tools

    async def run(self, message: str) -> str:
        return "TODO: implement agent loop"
