from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8-sig', extra='ignore')
    database_url: str
    jwt_secret: str
    environment: str = 'development'
    frontend_url: str = 'http://localhost:5173'
    cors_origins: list[str] = ['http://localhost:5173', 'http://127.0.0.1:5173']
    dev_reset_links: bool = False
    smtp_host: str = ''
    smtp_port: int = 587
    smtp_username: str = ''
    smtp_password: str = ''
    smtp_from: str = 'neuroadapt@example.com'

    @model_validator(mode='after')
    def secure_config(self):
        if len(self.jwt_secret) < 32 or self.jwt_secret.startswith('REPLACE_'):
            raise ValueError('Configure a random JWT_SECRET of at least 32 characters')
        if self.environment != 'test' and not self.database_url.startswith('mysql+pymysql://'):
            raise ValueError('The application requires MySQL/MariaDB')
        if self.environment == 'production' and (self.dev_reset_links or not self.smtp_host):
            raise ValueError('Production requires SMTP and DEV_RESET_LINKS=false')
        return self


settings = Settings()
