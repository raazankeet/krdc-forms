from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "GLP Forms"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite:///./glp_forms.db"

    # JWT
    JWT_SECRET_KEY: str = "dev-secret-key-change-in-production-use-256-bit-random"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "https://krdc-forms.vercel.app",
    ]

    # Cookie settings (httpOnly JWT)
    COOKIE_SECURE: bool = True  # Required for HTTPS (Render/Vercel)
    COOKIE_SAMESITE: str = "none"  # none = allow cross-origin cookies (requires Secure)
    COOKIE_DOMAIN: str = ""  # Empty = current domain only

    # Password policy
    PASSWORD_MIN_LENGTH: int = 8

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
