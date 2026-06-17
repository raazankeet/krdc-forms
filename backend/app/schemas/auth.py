from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


# ============= Auth =============
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ============= Permission =============
class PermissionOut(BaseModel):
    id: int
    code: str
    description: Optional[str] = None
    resource: str
    action: str

    class Config:
        from_attributes = True


# ============= Role =============
class RoleBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None


class RoleCreate(RoleBase):
    permission_ids: List[int] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permission_ids: Optional[List[int]] = None


class RoleOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    permissions: List[PermissionOut] = []
    created_at: datetime

    class Config:
        from_attributes = True


class RoleListOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    permission_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


# ============= User =============
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    role_ids: List[int] = []


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    role_ids: Optional[List[int]] = None


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    roles: List[RoleOut] = []

    class Config:
        from_attributes = True


class UserListOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    roles: List[RoleListOut] = []

    class Config:
        from_attributes = True


# ============= Pagination =============
class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    pages: int


class PaginatedResponse(BaseModel):
    success: bool = True
    data: List
    pagination: PaginationMeta
