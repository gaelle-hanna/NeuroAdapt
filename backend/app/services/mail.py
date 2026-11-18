import smtplib
import ssl
from email.message import EmailMessage
from app.core.config import settings


def send_reset(email, link):
    message = EmailMessage()
    message['Subject'] = 'Reset your NeuroAdapt password'
    message['From'], message['To'] = settings.smtp_from, email
    message.set_content(f'Use this link within 30 minutes to reset your password:\n{link}\nIf you did not request this, ignore this email.')
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        server.starttls(context=ssl.create_default_context())
        if settings.smtp_username:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)
