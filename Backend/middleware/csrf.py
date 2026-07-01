"""
middleware/csrf.py
------------------
Defense-in-depth CSRF check for state-changing requests.

With JWT-in-Authorization-header, CSRF is a low-residual risk because
bearer tokens are not auto-attached by browsers like cookies are. This
middleware provides an additional layer by requiring the standard
X-Requested-With: XMLHttpRequest header on non-safe methods.

Exemptions:
  - Safe methods: GET, HEAD, OPTIONS (no state change)
  - Public auth paths: login, register, send-otp, verify-otp, etc. (API clients)
  - /health (monitoring probes)
  - Any path containing /webhook (third-party callbacks cannot set custom headers)
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

_CSRF_EXEMPT_PREFIXES = (
    "/auth/login",
    "/auth/register",
    "/auth/send-otp",
    "/auth/verify-otp",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/refresh",
    "/health",
)


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method in _SAFE_METHODS:
            return await call_next(request)

        path = request.url.path

        if any(path.startswith(prefix) for prefix in _CSRF_EXEMPT_PREFIXES):
            return await call_next(request)

        if "/webhook" in path:
            return await call_next(request)

        if request.headers.get("X-Requested-With") != "XMLHttpRequest":
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF check failed: X-Requested-With header missing or invalid"},
            )

        return await call_next(request)
