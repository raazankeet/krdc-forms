class AppException(Exception):
    """Base application exception."""
    def __init__(self, message: str, status_code: int = 400, detail: dict | None = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail or {}
        super().__init__(self.message)


class ValidationException(AppException):
    def __init__(self, message: str = "Validation error", detail: dict | None = None):
        super().__init__(message, status_code=400, detail=detail)


class AuthenticationException(AppException):
    def __init__(self, message: str = "Authentication required"):
        super().__init__(message, status_code=401)


class AuthorizationException(AppException):
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(message, status_code=403)


class NotFoundException(AppException):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=404)


class ConflictException(AppException):
    def __init__(self, message: str = "Resource conflict"):
        super().__init__(message, status_code=409)


class WorkflowException(AppException):
    def __init__(self, message: str = "Invalid workflow transition"):
        super().__init__(message, status_code=422)
