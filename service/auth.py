"""Same-machine session gate for protected helper routes."""
from __future__ import annotations

import secrets

from fastapi import HTTPException, Request, Response

SESSION_COOKIE = "aebridge_session"
SESSION_HEADER = "x-aebridge-session"
_SESSION_TOKEN = secrets.token_urlsafe(32)


def set_session_cookie(response: Response) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        _SESSION_TOKEN,
        httponly=True,
        samesite="strict",
        secure=False,
        path="/",
    )


def require_session(request: Request) -> None:
    if (
        request.cookies.get(SESSION_COOKIE) != _SESSION_TOKEN
        and request.headers.get(SESSION_HEADER) != _SESSION_TOKEN
    ):
        raise HTTPException(status_code=401, detail="AEBridge session required")
