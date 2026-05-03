from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.di import get_db
from app.middleware.auth import CurrentUser
from app.modules.auth.models import User
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import AuthService

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
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(AuthRepository(db))


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
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
    service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    if body.email is None and body.display_name is None:
        raise HTTPException(status_code=400, detail="Nothing to update")

    try:
        user = await service.update_profile(
            uuid.UUID(current_user["user_id"]),
            email=body.email,
            display_name=body.display_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
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
