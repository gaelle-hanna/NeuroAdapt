import secrets
import logging
from datetime import timedelta
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, ResetToken, now
from app.schemas import CreatePatient, Credentials, ForgotPassword, ResetPassword
from app.core.config import settings
from app.core.security import current_user, limiter, access_token, verify, digest, hasher, dummy_hash
from app.services.accounts import create_account, user_view, commit
from app.services.mail import send_reset

router = APIRouter(prefix='/auth', tags=['Authentication'])


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
def forgot(data: ForgotPassword, request: Request, background_tasks: BackgroundTasks,
           db: Session = Depends(get_db)):
    limiter.check(request, 'reset', 5)
    response = {'message': 'If your address is registered, check your inbox for reset instructions.'}
    user = db.scalar(select(User).where(User.Email == str(data.email).lower(), User.Status == 'active').with_for_update())
    if user:
        token = secrets.token_urlsafe(48)
        db.execute(update(ResetToken).where(ResetToken.UserID == user.UserID, ResetToken.UsedAt.is_(None)).values(UsedAt=now()))
        db.add(ResetToken(UserID=user.UserID, TokenHash=digest(token), ExpiresAt=now() + timedelta(minutes=30)))
        commit(db)
        link = f'{settings.frontend_url}/reset-password#token={token}'
        if settings.smtp_host:
            background_tasks.add_task(deliver_reset_email, user.Email, link)
        elif settings.environment == 'development' and settings.dev_reset_links:
            response['development_reset_link'] = link
    return response


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
