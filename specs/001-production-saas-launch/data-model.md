# Data Model: HireIQ Production SaaS Launch

**Phase 1 output** | **Date**: 2026-05-10

## Entity Overview

```
User ──────────────────────── Subscription ──── SubscriptionPlan ──── FeatureEntitlement
  │                                │
  ├── CVSession ─────────── InterviewResult
  │        └── (skill_inventory JSON)
  │
  ├── EmailVerificationToken
  ├── PasswordResetToken
  ├── JobApplication
  └── RecruiterList ────────── RecruiterCandidate ──── CVSession
```

---

## Modified Entities

### User (extends existing)

```python
class User(Base):
    __tablename__ = "users"

    id                  = Column(Integer, primary_key=True)
    email               = Column(String, unique=True, nullable=False, index=True)
    username            = Column(String, unique=True, nullable=False, index=True)
    hashed_password     = Column(String, nullable=False)
    created_at          = Column(DateTime, default=datetime.utcnow)

    # ── Auth hardening (NEW) ──────────────────────────────────────────────────
    email_verified      = Column(Boolean, default=False, nullable=False)
    failed_login_count  = Column(Integer, default=0, nullable=False)
    locked_until        = Column(DateTime, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    sessions            = relationship("CVSession", back_populates="user")
    subscription        = relationship("Subscription", back_populates="user", uselist=False)
    job_applications    = relationship("JobApplication", back_populates="user")
    recruiter_lists     = relationship("RecruiterList", back_populates="user")
    verification_tokens = relationship("EmailVerificationToken", back_populates="user")
    reset_tokens        = relationship("PasswordResetToken", back_populates="user")
```

**Migration**: `002_auth_hardening.py` — add three columns, default `email_verified=false`
for existing rows.

---

### CVSession (extends existing)

```python
class CVSession(Base):
    __tablename__ = "cv_sessions"

    id                  = Column(Integer, primary_key=True)
    user_id             = Column(Integer, ForeignKey("users.id"), nullable=False)  # was nullable
    cv_filename         = Column(String, nullable=False)
    jd_text             = Column(Text, nullable=False)
    match_score         = Column(Float, nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)

    # ── Enhanced analysis output (NEW) ────────────────────────────────────────
    skill_inventory     = Column(JSON, nullable=True)   # {hard: [], soft: [], experience: {}}
    gap_report          = Column(JSON, nullable=True)   # [{skill, importance, resources}]
    study_roadmap       = Column(JSON, nullable=True)   # [{topic, priority, resources}]
    subscription_tier   = Column(String, nullable=True) # tier at time of creation, for audit
```

**Migration**: `003_cv_session_extended.py` — add four columns, fix `user_id NOT NULL`.

---

## New Entities

### EmailVerificationToken

```python
class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    token       = Column(String, unique=True, nullable=False, index=True)  # UUID4
    expires_at  = Column(DateTime, nullable=False)   # 24 hours from creation
    used_at     = Column(DateTime, nullable=True)    # set when consumed

    user        = relationship("User", back_populates="verification_tokens")
```

**Validation rules**:
- `expires_at` MUST be > `now` for the token to be valid
- `used_at` MUST be NULL for the token to be valid
- Only one active token per user (invalidate previous before creating new)

---

### PasswordResetToken

```python
class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    token       = Column(String, unique=True, nullable=False, index=True)  # UUID4
    expires_at  = Column(DateTime, nullable=False)   # 1 hour from creation
    used_at     = Column(DateTime, nullable=True)

    user        = relationship("User", back_populates="reset_tokens")
```

---

### SubscriptionPlan

```python
class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id              = Column(Integer, primary_key=True)
    slug            = Column(String, unique=True, nullable=False)  # "free", "professional", "recruiter"
    name            = Column(String, nullable=False)               # "Free", "Professional", "Recruiter"
    price_egp       = Column(Integer, nullable=False)              # 0, 29900, 79900  (piastres)
    price_usd_cents = Column(Integer, nullable=False)              # 0, 999, 1999
    billing_cycle   = Column(String, nullable=False)               # "monthly" | "none"
    is_active       = Column(Boolean, default=True)

    entitlements    = relationship("FeatureEntitlement", back_populates="plan")
    subscriptions   = relationship("Subscription", back_populates="plan")
```

**Seed data** (applied in migration):

| slug | name | price_egp | price_usd_cents |
|------|------|-----------|-----------------|
| free | Free | 0 | 0 |
| professional | Professional | 29900 | 999 |
| recruiter | Recruiter | 79900 | 1999 |

---

### FeatureEntitlement

```python
class FeatureEntitlement(Base):
    __tablename__ = "feature_entitlements"

    id          = Column(Integer, primary_key=True)
    plan_id     = Column(Integer, ForeignKey("subscription_plans.id"), nullable=False)
    feature_slug = Column(String, nullable=False)  # see feature slug table below

    plan        = relationship("SubscriptionPlan", back_populates="entitlements")
```

**Feature slugs and tier assignments**:

| feature_slug | free | professional | recruiter |
|--------------|------|--------------|-----------|
| cv-upload | ✅ (3/month) | ✅ unlimited | ✅ unlimited |
| basic-analysis | ✅ | ✅ | ✅ |
| mock-interview | ✅ (1/session) | ✅ unlimited | ✅ unlimited |
| enhanced-analysis | ❌ | ✅ | ✅ |
| linkedin-import | ❌ | ✅ | ✅ |
| pdf-report | ❌ | ✅ | ✅ |
| job-tracker | ❌ | ✅ | ✅ |
| recruiter-dashboard | ❌ | ❌ | ✅ |

---

### Subscription

```python
class Subscription(Base):
    __tablename__ = "subscriptions"

    id              = Column(Integer, primary_key=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    plan_id         = Column(Integer, ForeignKey("subscription_plans.id"), nullable=False)
    status          = Column(String, nullable=False)   # pending | active | cancelled | lapsed
    started_at      = Column(DateTime, nullable=True)
    ends_at         = Column(DateTime, nullable=True)  # NULL for free tier
    cancelled_at    = Column(DateTime, nullable=True)
    gateway         = Column(String, nullable=True)    # "paymob" | "stripe" | NULL (free)
    gateway_customer_id = Column(String, nullable=True)  # reserved for future gateway use

    user            = relationship("User", back_populates="subscription")
    plan            = relationship("SubscriptionPlan", back_populates="subscriptions")
    payments        = relationship("Payment", back_populates="subscription")
```

**State transitions**:
```
free (no row) ──[upgrade]──→ pending ──[payment confirmed]──→ active
active ──[cancel]──→ cancelled (access until ends_at)
active ──[ends_at passes, no renewal]──→ lapsed (reverts to free)
active ──[payment fails 3x]──→ lapsed
```

---

### Payment

```python
class Payment(Base):
    __tablename__ = "payments"

    id                  = Column(Integer, primary_key=True)
    subscription_id     = Column(Integer, ForeignKey("subscriptions.id"), nullable=False)
    amount_piastres     = Column(Integer, nullable=False)   # Paymob uses piastres
    amount_cents        = Column(Integer, nullable=False)   # reserved for future international gateway
    currency            = Column(String, nullable=False)    # "EGP" | "USD"
    gateway             = Column(String, nullable=False)    # "paymob" | "stripe"
    gateway_reference   = Column(String, nullable=True)     # gateway transaction ID
    status              = Column(String, nullable=False)    # pending | paid | failed | refunded
    created_at          = Column(DateTime, default=datetime.utcnow)
    completed_at        = Column(DateTime, nullable=True)

    subscription        = relationship("Subscription", back_populates="payments")
```

---

### JobApplication

```python
class JobApplication(Base):
    __tablename__ = "job_applications"

    id              = Column(Integer, primary_key=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_title       = Column(String, nullable=False)
    company         = Column(String, nullable=False)
    job_url         = Column(String, nullable=True)
    status          = Column(String, nullable=False, default="saved")
                      # saved | applied | screening | interview | offer | rejected
    match_score     = Column(Float, nullable=True)    # populated if CV session linked
    session_id      = Column(Integer, ForeignKey("cv_sessions.id"), nullable=True)
    notes           = Column(Text, nullable=True)
    applied_at      = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    user            = relationship("User", back_populates="job_applications")
```

**Valid status values and transitions**:
```
saved → applied → screening → interview → offer | rejected
```

---

### RecruiterList

```python
class RecruiterList(Base):
    __tablename__ = "recruiter_lists"

    id              = Column(Integer, primary_key=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False)
    name            = Column(String, nullable=False)
    job_title       = Column(String, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    user            = relationship("User", back_populates="recruiter_lists")
    candidates      = relationship("RecruiterCandidate", back_populates="recruiter_list")
```

---

### RecruiterCandidate

```python
class RecruiterCandidate(Base):
    __tablename__ = "recruiter_candidates"

    id                  = Column(Integer, primary_key=True)
    recruiter_list_id   = Column(Integer, ForeignKey("recruiter_lists.id"), nullable=False)
    session_id          = Column(Integer, ForeignKey("cv_sessions.id"), nullable=False)
    rank                = Column(Integer, nullable=True)   # manual override rank
    created_at          = Column(DateTime, default=datetime.utcnow)

    recruiter_list      = relationship("RecruiterList", back_populates="candidates")
    session             = relationship("CVSession")
```

---

### SecurityAuditLog

```python
class SecurityAuditLog(Base):
    __tablename__ = "security_audit_logs"

    id              = Column(Integer, primary_key=True)
    event_type      = Column(String, nullable=False)
                      # auth.login.success | auth.login.failed | auth.logout
                      # auth.password_change | auth.account_locked
                      # payment.webhook.success | payment.webhook.invalid_signature
                      # payment.webhook.duplicate
                      # access.ownership_violation | access.feature_gate_hit
                      # access.rate_limit_exceeded
                      # upload.rejected_mime | upload.rejected_size
                      # admin.panel_access
    user_id         = Column(Integer, nullable=True)   # NULL for unauthenticated events
    source_ip       = Column(String, nullable=False)
    outcome         = Column(String, nullable=False)   # "blocked" | "allowed" | "logged"
    detail          = Column(Text, nullable=True)      # opaque reference (no PII, no secrets)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)
```

**Design constraints**:
- No `ForeignKey` on `user_id` — audit records MUST persist even if the user is deleted.
- No UPDATE or DELETE operations permitted on this table (append-only invariant enforced
  in `security_service.py` — no ORM `session.delete()` calls for this model).
- `detail` field MUST NOT contain PII, card numbers, tokens, or passwords.
  Use opaque references only (e.g., `gateway_ref=PAY-12345`, not card numbers).

---

## Migration Sequence

| File | Content |
|------|---------|
| `001_initial.py` | Baseline — captures current users, cv_sessions, interview_results tables |
| `002_auth_hardening.py` | Add email_verified, failed_login_count, locked_until to users; add EmailVerificationToken, PasswordResetToken; fix user_id NOT NULL on cv_sessions |
| `003_subscriptions.py` | Add SubscriptionPlan, FeatureEntitlement, Subscription, Payment; seed plan data and feature entitlements |
| `004_jobs_recruiter.py` | Add JobApplication, RecruiterList, RecruiterCandidate |
| `005_cv_session_extended.py` | Add skill_inventory, gap_report, study_roadmap, subscription_tier to cv_sessions |
| `006_security_audit_log.py` | Add security_audit_logs table (append-only — no FK constraints to avoid cascade deletes) |
