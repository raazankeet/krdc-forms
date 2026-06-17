from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.core.security import decode_token, is_token_denylisted
from app.core.exceptions import AuthenticationException, AuthorizationException


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
):
    """Extract and validate the current user from httpOnly JWT cookie."""
    from app.models.user import User

    token = request.cookies.get("access_token")
    if not token:
        raise AuthenticationException("Missing authentication token")

    if is_token_denylisted(token):
        raise AuthenticationException("Token has been revoked")

    payload = decode_token(token)
    if payload is None:
        raise AuthenticationException("Invalid or expired token")

    if payload.get("type") != "access":
        raise AuthenticationException("Invalid token type")

    user_id: str = payload.get("sub")
    if user_id is None:
        raise AuthenticationException("Invalid token payload")

    user = db.query(User).filter(User.id == int(user_id), User.is_active == True).first()
    if user is None:
        raise AuthenticationException("User not found or disabled")

    return user


# Alias used by auth.py /me endpoint
async def get_current_user_from_cookie(
    request: Request,
    db: Session = Depends(get_db),
):
    """Same as get_current_user — reads from httpOnly cookie."""
    return await get_current_user(request=request, db=db)


class PermissionChecker:
    """Dependency that checks if the current user has a specific permission."""

    def __init__(self, required_permission: str):
        self.required_permission = required_permission

    async def __call__(
        self,
        request: Request,
    ):
        token = request.cookies.get("access_token")
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

        if is_token_denylisted(token):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")

        payload = decode_token(token)
        if payload is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        permissions: list[str] = payload.get("permissions", [])
        if self.required_permission not in permissions:
            raise AuthorizationException(
                f"Permission '{self.required_permission}' is required"
            )

        return payload


def require_permission(permission: str) -> PermissionChecker:
    """Factory for PermissionChecker dependency."""
    return PermissionChecker(permission)
