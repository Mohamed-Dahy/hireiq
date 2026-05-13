"""Unit tests for referral service — Phase 9, US9"""
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session
from models.user import User
from models.referral import ReferralCode, ReferralConversion
from services.referral_service import (
    get_or_create_referral_code,
    register_via_referral,
    apply_referral_reward,
    get_referral_stats,
    get_leaderboard,
)


class TestReferralCodeGeneration:
    def test_code_generation_returns_alphanumeric(self, test_db: Session, test_user: User):
        code = get_or_create_referral_code(test_db, test_user)
        assert code.code is not None
        assert len(code.code) > 0
        assert code.code.isalnum()

    def test_code_generation_is_unique(self, test_db: Session, test_user: User):
        code1 = get_or_create_referral_code(test_db, test_user)
        # Get the same code on second call (idempotent)
        code2 = get_or_create_referral_code(test_db, test_user)
        assert code1.code == code2.code

    def test_different_users_get_different_codes(self, test_db: Session):
        u1 = User(email="u1@t.com", username="u1", hashed_password="pw")
        u2 = User(email="u2@t.com", username="u2", hashed_password="pw")
        test_db.add_all([u1, u2])
        test_db.commit()
        c1 = get_or_create_referral_code(test_db, u1)
        c2 = get_or_create_referral_code(test_db, u2)
        assert c1.code != c2.code


class TestSelfReferral:
    def test_self_referral_is_blocked(self, test_db: Session, test_user: User):
        code = get_or_create_referral_code(test_db, test_user)
        register_via_referral(test_db, code.code, test_user)
        conversion = test_db.query(ReferralConversion).filter(
            ReferralConversion.referred_user_id == test_user.id
        ).first()
        assert conversion is None


class TestDuplicateReferral:
    def test_duplicate_referral_blocked(self, test_db: Session, test_user: User):
        code = get_or_create_referral_code(test_db, test_user)
        new_user = User(email="new@t.com", username="new", hashed_password="pw")
        test_db.add(new_user)
        test_db.commit()
        test_db.refresh(new_user)
        register_via_referral(test_db, code.code, new_user)
        count_before = test_db.query(ReferralConversion).count()
        register_via_referral(test_db, code.code, new_user)
        count_after = test_db.query(ReferralConversion).count()
        assert count_after == count_before


class TestApplyReward:
    def test_apply_reward_sets_flag(self, test_db: Session, test_user: User):
        code = get_or_create_referral_code(test_db, test_user)
        new_user = User(email="new2@t.com", username="new2", hashed_password="pw")
        test_db.add(new_user)
        test_db.commit()
        test_db.refresh(new_user)
        register_via_referral(test_db, code.code, new_user)
        apply_referral_reward(test_db, new_user.id)
        conversion = test_db.query(ReferralConversion).filter(
            ReferralConversion.referred_user_id == new_user.id
        ).first()
        assert conversion is not None
        assert conversion.reward_applied is True
        assert conversion.days_credited == 10
        assert conversion.converted_at is not None


class TestInvalidCode:
    def test_invalid_code_raises_404(self, test_db: Session, test_user: User):
        with pytest.raises(HTTPException) as exc:
            register_via_referral(test_db, "NONEXISTENT123", test_user)
        assert exc.value.status_code == 404
