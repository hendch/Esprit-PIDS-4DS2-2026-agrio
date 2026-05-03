from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.di import get_db
from app.middleware.auth import CurrentUser
from app.modules.auth.models import TutorialProgress, User
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import AuthService, is_profile_complete

from .schemas import (
    ChangePasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
)

router = APIRouter()


def _to_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        is_active=user.is_active,
        phone=user.phone,
        region=user.region,
        years_experience=user.years_experience,
        animal_types=user.animal_types,
        bio=user.bio,
        avatar_url=user.avatar_url,
        is_verified_farmer=user.is_verified_farmer,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


async def _maybe_award_badge(db: AsyncSession, user: User) -> None:
    """Set is_verified_farmer=True when profile is complete AND tutorial is done."""
    if user.is_verified_farmer or not is_profile_complete(user):
        return
    result = await db.execute(
        select(TutorialProgress).where(TutorialProgress.user_id == user.id)
    )
    tutorial = result.scalar_one_or_none()
    if tutorial and tutorial.is_completed:
        user.is_verified_farmer = True
        await db.commit()
        await db.refresh(user)


def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(AuthRepository(db))


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
    service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    try:
        access_token, refresh_token, expires_in = await service.login(body.email, body.password)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Authentication service is temporarily unavailable. Please try again shortly.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    _result = await db.execute(
        select(User.id, User.is_verified_farmer).where(User.email == body.email.lower())
    )
    _row = _result.one_or_none()
    if _row:
        _uid, _ivf = str(_row.id), bool(_row.is_verified_farmer)

        async def _login_award_bg() -> None:
            from app.persistence.db import AsyncSessionLocal
            from app.modules.gamification.service import GamificationService
            async with AsyncSessionLocal() as _db:
                await GamificationService().award_daily_login(_db, _uid, _ivf)

        asyncio.create_task(_login_award_bg())

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    body: RegisterRequest,
    service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    try:
        await service.register(body.email, body.password, body.display_name)
        access_token, refresh_token, expires_in = await service.login(body.email, body.password)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Authentication service is temporarily unavailable. Please try again shortly.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: dict = CurrentUser,
    service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    try:
        user = await service.get_profile(uuid.UUID(current_user["user_id"]))
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=404, detail="User not found") from exc
    return _to_user_response(user)


@router.get("/me/farm")
async def get_my_farm(
    current_user: dict = CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return the farm owned by the authenticated user, creating one if needed."""
    from sqlalchemy import select, text
    from app.modules.livestock.models import Animal  # noqa: F401 — ensure mapping loaded
    try:
        from app.persistence.base_model import Base
        farm_table = Base.metadata.tables.get("farms")
        if farm_table is None:
            raise HTTPException(status_code=404, detail="Farm not found")
        user_uuid = uuid.UUID(current_user["user_id"])
        stmt = text("SELECT id FROM farms WHERE owner_id = :uid LIMIT 1")
        result = await db.execute(stmt, {"uid": str(user_uuid)})
        row = result.fetchone()
        if row:
            return {"farm_id": str(row[0])}
        # Auto-create a farm for this user if none exists
        new_id = uuid.uuid4()
        await db.execute(
            text("INSERT INTO farms (id, name, owner_id, created_at, updated_at) VALUES (:id, :name, :owner_id, now(), now())"),
            {"id": str(new_id), "name": "My Farm", "owner_id": str(user_uuid)},
        )
        await db.commit()
        return {"farm_id": str(new_id)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not resolve farm: {exc}") from exc


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshRequest,
    service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    try:
        access_token, refresh_token, expires_in = await service.refresh_access_token(
            body.refresh_token,
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )


@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: UpdateProfileRequest,
    current_user: dict = CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    all_fields = [body.email, body.display_name, body.phone, body.region,
                  body.years_experience, body.animal_types, body.bio, body.avatar_url]
    if all(v is None for v in all_fields):
        raise HTTPException(status_code=400, detail="Nothing to update")

    user_id = uuid.UUID(current_user["user_id"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Email requires uniqueness check
    if body.email is not None:
        dup = await db.execute(
            select(User).where(User.email == body.email.lower(), User.id != user_id)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email is already registered")
        user.email = body.email.lower()

    if body.display_name is not None:
        user.display_name = body.display_name
    if body.phone is not None:
        user.phone = body.phone
    if body.region is not None:
        user.region = body.region
    if body.years_experience is not None:
        user.years_experience = body.years_experience
    if body.animal_types is not None:
        user.animal_types = body.animal_types
    if body.bio is not None:
        user.bio = body.bio
    if body.avatar_url is not None:
        user.avatar_url = body.avatar_url

    await db.commit()
    await db.refresh(user)
    await _maybe_award_badge(db, user)
    return _to_user_response(user)


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    request: Request,
    file: UploadFile,
    current_user: dict = CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    from app.modules.media.storage.local_storage import LocalObjectStorage

    ALLOWED = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=422, detail="Unsupported type. Allowed: jpeg, png, webp.")

    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 5 MB).")

    ext = "jpg"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()

    key = f"avatar_{uuid.uuid4()}.{ext}"
    storage = LocalObjectStorage(root_dir="./media_uploads")
    await storage.put(key, data, file.content_type or "image/jpeg")

    base = str(request.base_url).rstrip("/")
    avatar_url = f"{base}/media_uploads/{key}"

    user_id = uuid.UUID(current_user["user_id"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    user.avatar_url = avatar_url
    await db.commit()
    await db.refresh(user)
    await _maybe_award_badge(db, user)
    return _to_user_response(user)


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    body: ChangePasswordRequest,
    current_user: dict = CurrentUser,
    service: AuthService = Depends(get_auth_service),
) -> MessageResponse:
    try:
        await service.change_password(
            uuid.UUID(current_user["user_id"]),
            current_password=body.current_password,
            new_password=body.new_password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MessageResponse(detail="Password updated successfully")


@router.post("/logout", response_model=MessageResponse)
async def logout(
    body: RefreshRequest,
    service: AuthService = Depends(get_auth_service),
) -> MessageResponse:
    await service.logout(body.refresh_token)
    return MessageResponse(detail="Logged out successfully")
