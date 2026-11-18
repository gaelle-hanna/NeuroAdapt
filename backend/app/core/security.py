import hashlib
from datetime import datetime, timedelta, timezone
from threading import Lock
from collections import OrderedDict
import time
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.database import get_db
from app.models import User

hasher = PasswordHasher()
dummy_hash = hasher.hash('unusable-dummy-verification-value')
bearer = HTTPBearer(auto_error=False)


def verify(password, hashed):
    try:
        return hasher.verify(hashed, password)
    except (VerificationError, InvalidHashError):
        return False


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def access_token(user):
    now = datetime.now(timezone.utc)
    # A keyed password fingerprint invalidates old JWTs after a password reset.
    return jwt.encode({'sub': str(user.UserID), 'exp': now + timedelta(minutes=30),
                       'iat': now, 'iss': 'neuroadapt', 'aud': 'neuroadapt-web',
                       'pwd': digest(user.PasswordHash + settings.jwt_secret)}, settings.jwt_secret, algorithm='HS256')


def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)):
    try:
        if not credentials:
            raise ValueError()
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=['HS256'],
                             issuer='neuroadapt', audience='neuroadapt-web', options={'require': ['exp', 'iat', 'sub', 'pwd']})
        user = db.get(User, int(payload['sub']))
        if not user or user.Status != 'active' or payload['pwd'] != digest(user.PasswordHash + settings.jwt_secret):
            raise ValueError()
        return user
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise HTTPException(401, 'Your session has expired. Please log in again.', headers={'WWW-Authenticate': 'Bearer'})


def require_role(role):
    def dependency(user: User = Depends(current_user)):
        if user.Role != role:
            raise HTTPException(403, 'Access denied: this action is not available for your role.')
        return user
    return dependency


class RateLimiter:
    """Bounded process-local limiter. Use one worker locally; distributed limiter required when scaling."""
    def __init__(self):
        self.entries = OrderedDict()
        self.lock = Lock()

    def check(self, request: Request, action: str, limit: int, window=900):
        key = (action, request.client.host if request.client else 'unknown')
        now = time.monotonic()
        with self.lock:
            timestamps = [t for t in self.entries.pop(key, []) if t > now - window]
            if len(timestamps) >= limit:
                self.entries[key] = timestamps
                raise HTTPException(429, 'Too many attempts. Please try again later.', headers={'Retry-After': str(window)})
            self.entries[key] = timestamps + [now]
            while len(self.entries) > 10000:
                self.entries.popitem(last=False)


limiter = RateLimiter()
