"""Integration tests for referral endpoints — Phase 9, US9"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from models.user import User
from services.auth_service import hash_password


class TestReferralCodeEndpoint:
    def test_get_code_returns_for_authenticated_user(self, test_client: TestClient, auth_headers: dict):
        resp = test_client.get("/referrals/my-code", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "code" in data
        assert "referral_url" in data
        assert data["code"] in data["referral_url"]

    def test_get_code_twice_is_idempotent(self, test_client: TestClient, auth_headers: dict):
        r1 = test_client.get("/referrals/my-code", headers=auth_headers)
        r2 = test_client.get("/referrals/my-code", headers=auth_headers)
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()["code"] == r2.json()["code"]

    def test_get_code_requires_auth(self, test_client: TestClient):
        resp = test_client.get("/referrals/my-code")
        assert resp.status_code == 403


class TestRegisterViaReferral:
    def test_register_with_valid_code_stores_pending_conversion(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        referrer_resp = test_client.get("/referrals/my-code", headers=auth_headers)
        code = referrer_resp.json()["code"]
        payload = {"email": "referred@test.com", "username": "referred", "password": "TestPass123!"}
        resp = test_client.post(f"/auth/register?ref={code}", json=payload)
        assert resp.status_code == 201
        from models.referral import ReferralConversion
        conversion = test_db.query(ReferralConversion).filter(
            ReferralConversion.referred_user_id == test_db.query(User).filter(User.email == "referred@test.com").first().id
        ).first()
        assert conversion is not None
        assert conversion.reward_applied is False

    def test_register_with_invalid_code_still_succeeds(self, test_client: TestClient):
        payload = {"email": "badref@test.com", "username": "badref", "password": "TestPass123!"}
        resp = test_client.post("/auth/register?ref=INVALIDCODE", json=payload)
        assert resp.status_code == 201


class TestReferralStats:
    def test_stats_returns_correct_shape(self, test_client: TestClient, auth_headers: dict):
        resp = test_client.get("/referrals/stats", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_referred" in data
        assert "total_converted" in data
        assert "days_earned" in data

    def test_stats_requires_auth(self, test_client: TestClient):
        resp = test_client.get("/referrals/stats")
        assert resp.status_code == 403


class TestLeaderboard:
    def test_leaderboard_returns_list(self, test_client: TestClient, auth_headers: dict):
        resp = test_client.get("/referrals/leaderboard", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if len(data) > 0:
            entry = data[0]
            assert "username" in entry
            assert "referral_count" in entry
            assert "email" not in entry
            assert "id" not in entry
