from __future__ import annotations

from fastapi import APIRouter

from .schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    # TODO: inject service
    return TokenResponse(
        access_token="stub-jwt-token",
        expires_in=86400,
    )


@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest) -> TokenResponse:
    # TODO: inject service
    return TokenResponse(
        access_token="stub-jwt-token",
        expires_in=86400,
    )


@router.get("/me", response_model=UserResponse)
async def me() -> UserResponse:
    # TODO: inject service
    return UserResponse(
        id="user-001",
        email="farmer@agrio.dev",
        display_name="Demo Farmer",
    )
