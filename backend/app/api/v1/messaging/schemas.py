from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class UserSearchResponse(BaseModel):
    id: str
    email: str
    display_name: str | None = None


class MessageCreateRequest(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    body: str
    message_type: str
    created_at: datetime
    updated_at: datetime


class ConversationUserResponse(BaseModel):
    id: str
    email: str
    display_name: str | None = None


class ConversationResponse(BaseModel):
    id: str
    other_user: ConversationUserResponse | None = None
    last_message: MessageResponse | None = None
    created_at: datetime
    updated_at: datetime