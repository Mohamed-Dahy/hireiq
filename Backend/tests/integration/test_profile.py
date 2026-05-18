import io
import pytest
from models.user import User, UserProfile
from services.auth_service import create_access_token, hash_password, create_default_profile


def _make_user(db, email="profile_user@example.com", username="profileuser") -> User:
    user = User(
        email=email,
        username=username,
        hashed_password=hash_password("TestPass123!"),
        email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    create_default_profile(db, user.id)
    db.refresh(user)
    return user


def _headers(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


class TestGetProfile:
    def test_get_profile_returns_extended_fields(self, test_client, test_db):
        user = _make_user(test_db)
        resp = test_client.get("/profile/me", headers=_headers(user))
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == user.email
        assert data["username"] == user.username
        assert "is_admin" in data
        assert "tier" in data
        assert "has_stored_cv" in data
        assert data["has_stored_cv"] is False
        assert "analyses_in_window" in data
        assert "roadmaps_generated" in data

    def test_get_profile_requires_auth(self, test_client):
        resp = test_client.get("/profile/me")
        assert resp.status_code == 403


class TestUpdateProfile:
    def test_update_username_success(self, test_client, test_db):
        user = _make_user(test_db, email="upd1@example.com", username="upd_user1")
        resp = test_client.put(
            "/profile/update",
            json={"username": "new_username_1"},
            headers=_headers(user),
        )
        assert resp.status_code == 200
        test_db.refresh(user)
        assert user.username == "new_username_1"

    def test_update_username_taken(self, test_client, test_db):
        user_a = _make_user(test_db, email="ua@example.com", username="user_alpha")
        user_b = _make_user(test_db, email="ub@example.com", username="user_beta")
        resp = test_client.put(
            "/profile/update",
            json={"username": "user_alpha"},
            headers=_headers(user_b),
        )
        assert resp.status_code == 400
        assert "taken" in resp.json()["detail"].lower()

    def test_update_social_links(self, test_client, test_db):
        user = _make_user(test_db, email="social@example.com", username="socialuser")
        resp = test_client.put(
            "/profile/update",
            json={
                "linkedin_url": "https://linkedin.com/in/testuser",
                "github_url": "https://github.com/testuser",
                "bio": "Test bio",
            },
            headers=_headers(user),
        )
        assert resp.status_code == 200
        test_db.refresh(user)
        assert user.profile.linkedin_url == "https://linkedin.com/in/testuser"
        assert user.profile.github_url == "https://github.com/testuser"
        assert user.profile.bio == "Test bio"

    def test_update_invalid_linkedin_url(self, test_client, test_db):
        user = _make_user(test_db, email="badli@example.com", username="badliuser")
        resp = test_client.put(
            "/profile/update",
            json={"linkedin_url": "https://twitter.com/someone"},
            headers=_headers(user),
        )
        assert resp.status_code == 422


class TestStoredCv:
    def test_upload_stored_cv_and_retrieve(self, test_client, test_db):
        user = _make_user(test_db, email="cvup@example.com", username="cvupuser")
        fake_pdf = io.BytesIO(b"%PDF-1.4 fake content")
        fake_pdf.name = "mycv.pdf"
        resp = test_client.post(
            "/profile/cv",
            files={"file": ("mycv.pdf", fake_pdf, "application/pdf")},
            headers=_headers(user),
        )
        assert resp.status_code == 200
        assert resp.json()["filename"] == "mycv.pdf"

        profile_resp = test_client.get("/profile/me", headers=_headers(user))
        assert profile_resp.json()["has_stored_cv"] is True
        assert profile_resp.json()["stored_cv_filename"] == "mycv.pdf"

    def test_delete_stored_cv(self, test_client, test_db):
        user = _make_user(test_db, email="cvdel@example.com", username="cvdeluser")
        fake_pdf = io.BytesIO(b"%PDF-1.4 fake content")
        test_client.post(
            "/profile/cv",
            files={"file": ("del.pdf", fake_pdf, "application/pdf")},
            headers=_headers(user),
        )
        resp = test_client.delete("/profile/cv", headers=_headers(user))
        assert resp.status_code == 200
        test_db.refresh(user)
        assert user.profile.stored_cv_path is None

    def test_delete_cv_no_cv_returns_404(self, test_client, test_db):
        user = _make_user(test_db, email="cvnone@example.com", username="cvnoneuser")
        resp = test_client.delete("/profile/cv", headers=_headers(user))
        assert resp.status_code == 404


class TestChangePassword:
    def test_change_password_with_otp(self, test_client, test_db):
        user = _make_user(test_db, email="pwchange@example.com", username="pwchangeuser")
        from services.otp_service import create_otp
        code = create_otp(test_db, user.email, "password_change", user.id)

        resp = test_client.post(
            "/profile/change-password",
            json={"otp_code": code, "new_password": "NewPass456!"},
            headers=_headers(user),
        )
        assert resp.status_code == 200
        assert "revoked" in resp.json()["message"].lower()

        login_resp = test_client.post(
            "/auth/login",
            json={"email": user.email, "password": "NewPass456!"},
        )
        assert login_resp.status_code == 200

    def test_change_password_wrong_otp(self, test_client, test_db):
        user = _make_user(test_db, email="pwwrong@example.com", username="pwwronguser")
        from services.otp_service import create_otp
        create_otp(test_db, user.email, "password_change", user.id)

        resp = test_client.post(
            "/profile/change-password",
            json={"otp_code": "00000", "new_password": "SomePass123!"},
            headers=_headers(user),
        )
        assert resp.status_code == 400
        assert "invalid" in resp.json()["detail"].lower()
