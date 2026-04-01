from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

_PASSWORD_REGEX = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$")


class AuthCredentialsMixin(BaseModel):
    email: EmailStr = Field(
        ...,
        description="Valid email address is required.",
    )
    password: str = Field(
        ...,
        description=(
            "Password must be at least 8 characters and include uppercase, lowercase, and number."
        ),
    )

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not _PASSWORD_REGEX.match(value):
            msg = (
                "Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number."
            )
            raise ValueError(msg)
        return value


class LoginRequest(AuthCredentialsMixin):
    pass


class RegisterRequest(AuthCredentialsMixin):
    display_name: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UpdateProfileRequest(BaseModel):
    email: EmailStr | None = None
    display_name: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(
        ...,
        description=(
            "Password must be at least 8 characters and include uppercase, lowercase, and number."
        ),
    )

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not _PASSWORD_REGEX.match(value):
            msg = (
                "Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number."
            )
            raise ValueError(msg)
        return value


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class MessageResponse(BaseModel):
    detail: str
