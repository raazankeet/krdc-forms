"""Tests for authentication endpoints."""
from fastapi.testclient import TestClient


class TestAuth:
    """Test authentication flow."""

    def test_health_check(self, client: TestClient):
        """Test health endpoint returns healthy."""
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["status"] == "healthy"

    def test_login_success(self, client: TestClient, seed_user):
        """Test successful login with valid credentials."""
        response = client.post("/api/v1/auth/login", json={
            "username": "testuser",
            "password": "password123",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "access_token" in data["data"]
        assert "refresh_token" in data["data"]
        assert data["data"]["token_type"] == "bearer"

    def test_login_invalid_password(self, client: TestClient, seed_user):
        """Test login with wrong password returns 401."""
        response = client.post("/api/v1/auth/login", json={
            "username": "testuser",
            "password": "wrongpassword",
        })
        assert response.status_code == 401

    def test_login_invalid_user(self, client: TestClient):
        """Test login with non-existent user returns 401."""
        response = client.post("/api/v1/auth/login", json={
            "username": "nonexistent",
            "password": "password123",
        })
        assert response.status_code == 401

    def test_me_endpoint(self, client: TestClient, auth_headers, seed_user):
        """Test /auth/me returns current user."""
        response = client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["username"] == "testuser"
        assert data["data"]["email"] == "test@example.com"
        assert len(data["data"]["roles"]) > 0

    def test_me_without_auth(self, client: TestClient):
        """Test /auth/me without auth returns 401."""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401

    def test_refresh_token(self, client: TestClient, seed_user):
        """Test token refresh."""
        # First login
        login_res = client.post("/api/v1/auth/login", json={
            "username": "testuser",
            "password": "password123",
        })
        refresh_token = login_res.json()["data"]["refresh_token"]

        # Then refresh
        response = client.post("/api/v1/auth/refresh", json={
            "refresh_token": refresh_token,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "access_token" in data["data"]

    def test_logout(self, client: TestClient, auth_headers, seed_user):
        """Test logout succeeds."""
        response = client.post("/api/v1/auth/logout", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
