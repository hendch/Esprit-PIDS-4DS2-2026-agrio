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
