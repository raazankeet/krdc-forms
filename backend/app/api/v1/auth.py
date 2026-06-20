from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.db.base import get_db
from app.models.user import User, UserRole, Role, Permission
from app.schemas.auth import LoginRequest
from app.core.config import settings
from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    denylist_token,
    is_token_denylisted,
)
from app.core.exceptions import AuthenticationException, ValidationException
from app.services.audit import log_event

router = APIRouter()


def _set_auth_cookies(response: JSONResponse, access_token: str, refresh_token: str):
    """Set httpOnly, SameSite cookies for JWT tokens."""
    cookie_kwargs = dict(
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )
    if settings.COOKIE_DOMAIN:
        cookie_kwargs["domain"] = settings.COOKIE_DOMAIN

    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        **cookie_kwargs,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        **cookie_kwargs,
    )


def _clear_auth_cookies(response: JSONResponse):
    """Remove auth cookies on logout."""
    cookie_kwargs = dict(
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )
    if settings.COOKIE_DOMAIN:
        cookie_kwargs["domain"] = settings.COOKIE_DOMAIN

    response.delete_cookie(key="access_token", **cookie_kwargs)
    response.delete_cookie(key="refresh_token", **cookie_kwargs)


def _get_token_from_cookie(request: Request, key: str = "access_token") -> str | None:
    """Extract a JWT from an httpOnly cookie."""
    return request.cookies.get(key)


def get_user_permissions(user: User, db: Session) -> list[str]:
    """Get all permission codes for a user from their roles."""
    permissions = []
    for user_role in user.user_roles:
        role = db.query(Role).filter(Role.id == user_role.role_id).first()
        if role:
            for rp in role.role_permissions:
                perm = db.query(Permission).filter(Permission.id == rp.permission_id).first()
                if perm:
                    permissions.append(perm.code)
    return list(set(permissions))


def get_user_roles(user: User, db: Session) -> list[str]:
    """Get all role names for a user."""
    roles = []
    for user_role in user.user_roles:
        role = db.query(Role).filter(Role.id == user_role.role_id).first()
        if role:
            roles.append(role.name)
    return roles


def _build_user_roles(user: User, db: Session) -> list[dict]:
    """Build role objects with permissions for the response."""
    roles_out = []
    for user_role in user.user_roles:
        role = db.query(Role).filter(Role.id == user_role.role_id).first()
        if role:
            perms = []
            for rp in role.role_permissions:
                perm = db.query(Permission).filter(Permission.id == rp.permission_id).first()
                if perm:
                    perms.append({
                        "id": perm.id,
                        "code": perm.code,
                        "description": perm.description,
                        "resource": perm.resource,
                        "action": perm.action,
                    })
            roles_out.append({
                "id": role.id,
                "name": role.name,
                "description": role.description,
                "permissions": perms,
                "created_at": role.created_at.isoformat() if role.created_at else None,
            })
    return roles_out


@router.post("/login", response_model=dict)
async def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and set httpOnly JWT cookies."""
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise AuthenticationException("Invalid username or password")

    if not user.is_active:
        raise AuthenticationException("Account is disabled")

    roles = get_user_roles(user, db)
    permissions = get_user_permissions(user, db)

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    access_token = create_access_token(user.id, user.username, roles, permissions)
    refresh_token = create_refresh_token(user.id)

    # Build response with user info (same as /me for convenience)
    roles_out = _build_user_roles(user, db)
    response_data = {
        "success": True,
        "data": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "roles": roles_out,
        },
    }

    response = JSONResponse(content=response_data)
    _set_auth_cookies(response, access_token, refresh_token)

    # Log audit event
    await log_event(
        db=db,
        user=user,
        action="user.login",
        entity_type="user",
        entity_id=str(user.id),
        request=request,
    )

    return response


@router.post("/logout")
async def logout(request: Request, db: Session = Depends(get_db)):
    """Logout user — denylist token, clear cookies, and audit."""
    token = _get_token_from_cookie(request, "access_token")
    user = None
    if token:
        # Decode token to identify user for audit
        payload = decode_token(token)
        if payload:
            user_id = payload.get("sub")
            if user_id:
                user = db.query(User).filter(User.id == int(user_id)).first()
        denylist_token(token)

    response = JSONResponse(content={"success": True, "data": None, "message": "Logged out successfully"})
    _clear_auth_cookies(response)

    if user:
        await log_event(
            db=db,
            user=user,
            action="user.logout",
            entity_type="user",
            entity_id=str(user.id),
            request=request,
        )

    return response


@router.post("/refresh", response_model=dict)
async def refresh_token(request: Request, db: Session = Depends(get_db)):
    """Refresh access token using httpOnly refresh cookie."""
    refresh_token_value = _get_token_from_cookie(request, "refresh_token")
    if not refresh_token_value:
        raise AuthenticationException("Missing refresh token")

    payload = decode_token(refresh_token_value)
    if not payload or payload.get("type") != "refresh":
        raise AuthenticationException("Invalid or expired refresh token")

    user_id = int(payload.get("sub"))
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise AuthenticationException("User not found or disabled")

    roles = get_user_roles(user, db)
    permissions = get_user_permissions(user, db)

    access_token = create_access_token(user.id, user.username, roles, permissions)
    new_refresh_token = create_refresh_token(user.id)

    response = JSONResponse(content={"success": True, "data": {"message": "Token refreshed"}})
    _set_auth_cookies(response, access_token, new_refresh_token)
    return response


@router.get("/me", response_model=dict)
async def get_current_user_info(request: Request, db: Session = Depends(get_db)):
    """Get current authenticated user info from httpOnly cookie."""
    from app.core.deps import get_current_user_from_cookie
    user = await get_current_user_from_cookie(request, db)

    roles_out = _build_user_roles(user, db)

    return {
        "success": True,
        "data": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "roles": roles_out,
        },
    }
