"""LLM-powered disease advisor: dynamic advice + follow-up chat via Groq.

Falls back gracefully (returns None) when the API key is missing, the call
fails, or the response is empty so callers can use a static fallback.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from app.settings import settings

logger = logging.getLogger(__name__)

Locale = Literal["en", "ar"]
Role = Literal["user", "assistant"]

# 24h advice cache. Single-process; swap for Redis when scaling.
_ADVICE_CACHE: dict[str, tuple[str, float]] = {}
_ADVICE_TTL_SEC = 24 * 60 * 60
_MAX_HISTORY_TURNS = 10  # cap conversation context to keep tokens bounded


@dataclass(frozen=True)
class DiagnosisContext:
    disease_name: str
    plant_name: str
    confidence: float
    severity: str
    is_healthy: bool
    locale: Locale = "en"


@dataclass(frozen=True)
class ChatTurn:
    role: Role
    content: str


def _llm() -> ChatGroq | None:
    # Prefer the disease-specific key so its rate budget stays isolated from irrigation.
    api_key = settings.groq_disease_api_key or settings.groq_api_key
    if not api_key:
        return None
    return ChatGroq(
        api_key=api_key,
        model=settings.groq_model,
        temperature=0.3,
        max_tokens=400,
        timeout=20,
    )


def _advice_system_prompt(ctx: DiagnosisContext) -> str:
    lang_directive = (
        "Respond in Arabic. Use clear, simple Arabic that a Tunisian farmer can read."
        if ctx.locale == "ar"
        else "Respond in English. Use clear, simple language a small-scale farmer can act on."
    )
    if ctx.is_healthy:
        framing = (
            f"The leaf shows a HEALTHY {ctx.plant_name} plant "
            f"(confidence {ctx.confidence:.0f}%). Provide preventive care tips."
        )
    else:
        framing = (
            f"Diagnosis: {ctx.disease_name} on {ctx.plant_name} "
            f"(confidence {ctx.confidence:.0f}%, severity {ctx.severity}). "
            "Provide a short, actionable treatment plan."
        )
    return (
        "You are an expert agronomist advising small-scale farmers in Tunisia and North Africa. "
        f"{framing}\n\n"
        "Rules:\n"
        "- 4 to 6 short bullet points, ordered by what to do FIRST.\n"
        "- Mention specific active ingredients (e.g. mancozeb, copper) when relevant, "
        "but warn that local availability and regulations vary.\n"
        "- For severe or untreatable diseases, advise consulting a local agricultural extension office.\n"
        "- Do NOT invent product brand names or exact dosages.\n"
        "- No preamble, no closing remarks. Just the bullets.\n"
        f"- {lang_directive}"
    )


def _advice_cache_key(ctx: DiagnosisContext) -> str:
    # Bucket confidence into 10% bands so similar scans hit the same cache entry.
    conf_bucket = int(ctx.confidence // 10) * 10
    return f"{ctx.disease_name}|{ctx.locale}|{ctx.severity}|{conf_bucket}"


def _cache_get(key: str) -> str | None:
    entry = _ADVICE_CACHE.get(key)
    if entry is None:
        return None
    text, ts = entry
    if time.time() - ts > _ADVICE_TTL_SEC:
        _ADVICE_CACHE.pop(key, None)
        return None
    return text


def _cache_set(key: str, value: str) -> None:
    _ADVICE_CACHE[key] = (value, time.time())


async def generate_advice(ctx: DiagnosisContext) -> str | None:
    """Generate dynamic advice. Returns None on any failure (caller uses fallback)."""
    cache_key = _advice_cache_key(ctx)
    if cached := _cache_get(cache_key):
        logger.debug("advice cache hit: %s", cache_key)
        return cached

    llm = _llm()
    if llm is None:
        logger.info("Groq API key not set, skipping dynamic advice")
        return None

    user_msg = (
        "Give me the treatment plan now."
        if not ctx.is_healthy
        else "Give me the preventive care plan now."
    )
    messages = [
        SystemMessage(content=_advice_system_prompt(ctx)),
        HumanMessage(content=user_msg),
    ]
    try:
        reply = await llm.ainvoke(messages)
    except Exception:  # noqa: BLE001 — broad catch is intentional, fallback handles it
        logger.exception("Groq advice call failed")
        return None

    text = (reply.content or "").strip() if hasattr(reply, "content") else ""
    if not text:
        return None
    _cache_set(cache_key, text)
    return text


def _chat_system_prompt(ctx: DiagnosisContext, original_advice: str | None) -> str:
    lang_directive = (
        "Always reply in Arabic." if ctx.locale == "ar" else "Always reply in English."
    )
    advice_block = (
        f"\n\nThe advice already shown to the farmer was:\n{original_advice}"
        if original_advice
        else ""
    )
    diag = (
        f"a HEALTHY {ctx.plant_name}"
        if ctx.is_healthy
        else f"{ctx.disease_name} on {ctx.plant_name} (severity {ctx.severity})"
    )
    return (
        "You are an expert agronomist helping a Tunisian farmer follow up on a leaf scan. "
        f"The diagnosis was: {diag}, confidence {ctx.confidence:.0f}%."
        f"{advice_block}\n\n"
        "Answer the farmer's questions. Be concise (2-4 sentences unless they ask for detail). "
        "If they ask about products, dosages, or local rules, advise checking with a local "
        "agricultural extension office. Stay on topic — politely refuse unrelated questions. "
        f"{lang_directive}"
    )


async def chat_reply(
    ctx: DiagnosisContext,
    history: list[ChatTurn],
    user_message: str,
    original_advice: str | None = None,
) -> str | None:
    """Generate a follow-up chat reply. Returns None on failure."""
    llm = _llm()
    if llm is None:
        return None

    trimmed = history[-_MAX_HISTORY_TURNS:]
    messages: list = [SystemMessage(content=_chat_system_prompt(ctx, original_advice))]
    for turn in trimmed:
        if turn.role == "user":
            messages.append(HumanMessage(content=turn.content))
        else:
            messages.append(AIMessage(content=turn.content))
    messages.append(HumanMessage(content=user_message))

    try:
        reply = await llm.ainvoke(messages)
    except Exception:  # noqa: BLE001
        logger.exception("Groq chat call failed")
        return None

    text = (reply.content or "").strip() if hasattr(reply, "content") else ""
    return text or None
