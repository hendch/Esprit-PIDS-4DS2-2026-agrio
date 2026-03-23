from __future__ import annotations

EXPLAIN_PROMPT = (
    "Given the following irrigation data:\n"
    "{context}\n\n"
    "Explain the recommendation: {question}"
)

CHAT_PROMPT = (
    "You are Agrio AI assistant.\n\n"
    "Context: {context}\n\n"
    "User: {message}"
)
