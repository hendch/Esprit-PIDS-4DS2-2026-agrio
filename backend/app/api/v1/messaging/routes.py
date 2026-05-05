from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.di import get_db
from app.middleware.auth import CurrentUser
from app.modules.auth.models import User
from app.modules.messaging.models import Conversation, ConversationParticipant, Message
from .schemas import (
    ConversationResponse,
    ConversationUserResponse,
    MessageCreateRequest,
    MessageResponse,
    UserSearchResponse,
)

router = APIRouter()


def _current_user_id(current_user: dict) -> uuid.UUID:
    try:
        return uuid.UUID(current_user["user_id"])
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid authenticated user") from exc


def _direct_key(user_a: uuid.UUID, user_b: uuid.UUID) -> str:
    first, second = sorted([str(user_a), str(user_b)])
    return f"{first}_{second}"


def _message_response(message: Message) -> MessageResponse:
    return MessageResponse(
        id=str(message.id),
        conversation_id=str(message.conversation_id),
        sender_id=str(message.sender_id),
        body=message.body,
        message_type=message.message_type,
        created_at=message.created_at,
        updated_at=message.updated_at,
    )


@router.get("/users/search", response_model=list[UserSearchResponse])
async def search_users(
    q: str = Query(default="", min_length=0),
    current_user: dict = CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> list[UserSearchResponse]:
    user_id = _current_user_id(current_user)
    search = f"%{q.strip()}%"

    stmt = (
        select(User)
        .where(User.id != user_id)
        .where(User.is_active.is_(True))
        .where(
            or_(
                User.email.ilike(search),
                User.display_name.ilike(search),
            )
        )
        .limit(20)
    )

    result = await db.execute(stmt)
    users = result.scalars().all()

    return [
        UserSearchResponse(
            id=str(user.id),
            email=user.email,
            display_name=user.display_name,
        )
        for user in users
    ]


@router.post("/conversations/direct/{other_user_id}", response_model=ConversationResponse)
async def create_or_get_direct_conversation(
    other_user_id: uuid.UUID,
    current_user: dict = CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> ConversationResponse:
    user_id = _current_user_id(current_user)

    if user_id == other_user_id:
        raise HTTPException(status_code=400, detail="You cannot message yourself")

    other_user = await db.get(User, other_user_id)
    if other_user is None or not other_user.is_active:
        raise HTTPException(status_code=404, detail="User not found")

    direct_key = _direct_key(user_id, other_user_id)

    existing_result = await db.execute(
        select(Conversation).where(Conversation.direct_key == direct_key)
    )
    conversation = existing_result.scalar_one_or_none()

    if conversation is None:
        conversation = Conversation(direct_key=direct_key)
        db.add(conversation)
        await db.flush()

        db.add_all(
            [
                ConversationParticipant(conversation_id=conversation.id, user_id=user_id),
                ConversationParticipant(conversation_id=conversation.id, user_id=other_user_id),
            ]
        )
        await db.commit()
        await db.refresh(conversation)

    return ConversationResponse(
        id=str(conversation.id),
        other_user=ConversationUserResponse(
            id=str(other_user.id),
            email=other_user.email,
            display_name=other_user.display_name,
        ),
        last_message=None,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    current_user: dict = CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> list[ConversationResponse]:
    user_id = _current_user_id(current_user)

    participant_result = await db.execute(
        select(ConversationParticipant.conversation_id)
        .where(ConversationParticipant.user_id == user_id)
    )
    conversation_ids = [row[0] for row in participant_result.all()]

    conversations: list[ConversationResponse] = []

    for conversation_id in conversation_ids:
        conversation = await db.get(Conversation, conversation_id)
        if conversation is None:
            continue

        other_participant_result = await db.execute(
            select(ConversationParticipant)
            .where(ConversationParticipant.conversation_id == conversation_id)
            .where(ConversationParticipant.user_id != user_id)
        )
        other_participant = other_participant_result.scalar_one_or_none()

        other_user_response = None
        if other_participant is not None:
            other_user = await db.get(User, other_participant.user_id)
            if other_user is not None:
                other_user_response = ConversationUserResponse(
                    id=str(other_user.id),
                    email=other_user.email,
                    display_name=other_user.display_name,
                )

        last_message_result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_message = last_message_result.scalar_one_or_none()

        conversations.append(
            ConversationResponse(
                id=str(conversation.id),
                other_user=other_user_response,
                last_message=_message_response(last_message) if last_message else None,
                created_at=conversation.created_at,
                updated_at=conversation.updated_at,
            )
        )

    conversations.sort(
        key=lambda item: item.last_message.created_at if item.last_message else item.updated_at,
        reverse=True,
    )

    return conversations


async def _ensure_participant(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    result = await db.execute(
        select(ConversationParticipant)
        .where(ConversationParticipant.conversation_id == conversation_id)
        .where(ConversationParticipant.user_id == user_id)
    )
    participant = result.scalar_one_or_none()

    if participant is None:
        raise HTTPException(status_code=403, detail="You are not part of this conversation")


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    conversation_id: uuid.UUID,
    current_user: dict = CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> list[MessageResponse]:
    user_id = _current_user_id(current_user)
    await _ensure_participant(db, conversation_id, user_id)

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .limit(100)
    )
    messages = result.scalars().all()

    return [_message_response(message) for message in messages]


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: uuid.UUID,
    body: MessageCreateRequest,
    current_user: dict = CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    user_id = _current_user_id(current_user)
    await _ensure_participant(db, conversation_id, user_id)

    text = body.body.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    message = Message(
        conversation_id=conversation_id,
        sender_id=user_id,
        body=text,
        message_type="text",
    )

    db.add(message)

    await db.commit()
    await db.refresh(message)

    return _message_response(message)