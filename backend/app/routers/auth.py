import secrets
import logging
from datetime import timedelta
from threading import BoundedSemaphore
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from sqlalchemy import select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask
from app.database import SessionLocal, get_db
from app.models import User, ResetToken, now
from app.schemas import CreatePatient, Credentials, ForgotPassword, ResetPassword
from app.core.config import settings
from app.core.security import current_user, limiter, access_token, verify, digest, hasher, dummy_hash
from app.services.accounts import create_account, user_view, commit
from app.services.mail import send_reset

router = APIRouter(prefix='/auth', tags=['Authentication'])
reset_capacity = BoundedSemaphore(8)


class PasswordResetResponse(JSONResponse):
    async def __call__(self, scope, receive, send):
        # Reserve capacity before acknowledging the request, independently of account status.
        if not reset_capacity.acquire(blocking=False):
            response = JSONResponse(
                {'detail': 'Data could not be saved or retrieved. Please try again.'},
                status_code=503,
            )
            await response(scope, receive, send)
            return
        try:
            await super().__call__(scope, receive, send)
        finally:
            reset_capacity.release()


@router.post('/register', status_code=201)
def register(data: CreatePatient, request: Request, db: Session = Depends(get_db)):
    limiter.check(request, 'register', 20)
    return user_view(db, create_account(db, data))


@router.post('/login')
def login(data: Credentials, request: Request, db: Session = Depends(get_db)):
    limiter.check(request, 'login', 20)
    user = db.scalar(select(User).where(User.Email == str(data.email).lower()))
    valid = verify(data.password, user.PasswordHash if user else dummy_hash)
    if not user or not valid:
        raise HTTPException(401, 'Incorrect email or password.')
    if user.Status != 'active':
        raise HTTPException(403, 'Your account is inactive. Contact your administrator.')
    return dict(access_token=access_token(user), token_type='bearer', user=user_view(db, user))


@router.get('/me')
def me(user=Depends(current_user), db: Session = Depends(get_db)):
    return user_view(db, user)


@router.post('/forgot-password')
async def forgot(data: ForgotPassword, request: Request):
    limiter.check(request, 'reset', 5)
    response = {'message': 'If your address is registered, check your inbox for reset instructions.'}
    email = str(data.email).lower()
    if settings.environment == 'development' and settings.dev_reset_links and not settings.smtp_host:
        delivery = await run_in_threadpool(issue_reset_link, email)
        if delivery:
            response['development_reset_link'] = delivery[1]
        return response
    return PasswordResetResponse(response, background=BackgroundTask(process_reset_request, email))


def issue_reset_link(email):
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.Email == email, User.Status == 'active').with_for_update())
        if not user:
            return None
        token = secrets.token_urlsafe(48)
        issued_at = now()
        db.execute(update(ResetToken).where(ResetToken.UserID == user.UserID, ResetToken.UsedAt.is_(None)).values(UsedAt=issued_at))
        db.add(ResetToken(UserID=user.UserID, TokenHash=digest(token), ExpiresAt=issued_at + timedelta(minutes=30)))
        commit(db)
        return user.Email, f'{settings.frontend_url}/reset-password#token={token}'


def process_reset_request(email):
    try:
        delivery = issue_reset_link(email)
    except (SQLAlchemyError, HTTPException):
        logging.getLogger(__name__).error('Password reset link could not be issued')
        return
    if delivery and settings.smtp_host:
        deliver_reset_email(*delivery)


def deliver_reset_email(email, link):
    try:
        send_reset(email, link)
    except Exception:
        # Never log SMTP exception details, addresses, or reset links.
        logging.getLogger(__name__).error('Password reset email delivery failed')


@router.post('/reset-password')
def reset(data: ResetPassword, request: Request, db: Session = Depends(get_db)):
    limiter.check(request, 'reset-confirm', 20)
    # Resolve identity first, then lock the account to serialize simultaneous resets.
    candidate = db.scalar(select(ResetToken).where(ResetToken.TokenHash == digest(data.token)))
    if not candidate:
        raise HTTPException(400, 'Invalid or expired reset link.')
    user = db.scalar(select(User).where(User.UserID == candidate.UserID).with_for_update())
    token = db.scalar(select(ResetToken).where(ResetToken.ResetID == candidate.ResetID).with_for_update().execution_options(populate_existing=True))
    if token.UsedAt or token.ExpiresAt <= now() or user.Status != 'active':
        raise HTTPException(400, 'Invalid or expired reset link.')
    user.PasswordHash = hasher.hash(data.password)
    db.execute(update(ResetToken).where(ResetToken.UserID == user.UserID, ResetToken.UsedAt.is_(None)).values(UsedAt=now()))
    commit(db)
    return {'message': 'Password updated successfully. You can now log in.'}
