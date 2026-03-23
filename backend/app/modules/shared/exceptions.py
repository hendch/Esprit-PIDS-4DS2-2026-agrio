from __future__ import annotations


class DomainError(Exception):
    """Base class for all domain-level errors."""


class InvalidBoundaryError(DomainError):
    """Raised when a geographic boundary is geometrically invalid."""


class EntityNotFoundError(DomainError):
    """Raised when a requested entity does not exist."""


class AuthorizationError(DomainError):
    """Raised when the current user lacks permission for an operation."""
