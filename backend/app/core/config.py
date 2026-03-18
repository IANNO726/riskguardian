from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """Application Settings"""
    
    # API Configuration
    API_TITLE: str = "Risk Guardian Agent"
    API_VERSION: str = "1.0.0"
    API_DESCRIPTION: str = "Professional AI-powered risk management system for prop traders"
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    
    # Database
    DATABASE_URL: str = "postgresql://rga_user:rga_secure_password_change_me@localhost:5432/risk_guardian"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # JWT
    JWT_SECRET_KEY: str = "your_super_secret_jwt_key_change_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Telegram
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_CHAT_ID: Optional[str] = None
    
    # Email (SendGrid)
    SENDGRID_API_KEY: Optional[str] = None
    EMAIL_FROM: str = "noreply@riskguardian.dev"
    EMAIL_FROM_NAME: str = "Risk Guardian"
    
    # SMS (Twilio)
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None
    
    # MT4/MT5
    MT5_ACCOUNT_LOGIN: Optional[str] = None
    MT5_ACCOUNT_PASSWORD: Optional[str] = None
    MT5_ACCOUNT_SERVER: Optional[str] = None
    
    # CORS
    ALLOWED_HOSTS: str = "localhost,127.0.0.1"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3001"
    
    # RabbitMQ
    RABBITMQ_URL: str = "amqp://rga_user:rga_secure_password_change_me@localhost:5672/"
    RABBITMQ_VHOST: str = "/"
    
    # Celery
    CELERY_BROKER_URL: str = "amqp://rga_user:rga_secure_password_change_me@localhost:5672/"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    
    # Trading Rules (Defaults)
    DEFAULT_DAILY_LOSS_LIMIT: float = 2.0
    DEFAULT_MAX_DRAWDOWN: float = 5.0
    DEFAULT_MIN_RR_RATIO: float = 2.0
    DEFAULT_RISK_PER_TRADE: float = 1.0
    DEFAULT_CONSECUTIVE_LOSS_LIMIT: int = 3
    
    # Monitoring
    PROMETHEUS_ENABLED: bool = True
    PROMETHEUS_PORT: int = 9090
    
    # File Upload
    UPLOAD_FOLDER: str = "./uploads"
    MAX_FILE_SIZE: int = 10485760  # 10MB
    ALLOWED_FILE_TYPES: str = "jpg,jpeg,png,pdf,xlsx,csv"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"

settings = Settings()


