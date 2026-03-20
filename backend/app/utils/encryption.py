"""
Password hashing utilities
FIX: passlib + bcrypt 4.x conflict on Python 3.11
     passlib reads bcrypt.__about__.__version__ which doesn't
     exist in bcrypt 4.x — causes AttributeError and then
     ValueError: password cannot be longer than 72 bytes.
     Fixed by pinning bcrypt==4.0.1 AND using a try/except
     fallback that uses bcrypt directly if passlib fails.
"""
import os
import logging
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

# ── Fernet encryption for stored credentials ──────────────────
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")

def _get_fernet():
    if not ENCRYPTION_KEY:
        logger.warning("ENCRYPTION_KEY not set — using fallback key")
        return Fernet(Fernet.generate_key())
    try:
        return Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
    except Exception as e:
        logger.error(f"Fernet init failed: {e}")
        return Fernet(Fernet.generate_key())

def encrypt_password(password: str) -> str:
    """Encrypt a broker/MT5 password for storage."""
    try:
        f = _get_fernet()
        return f.encrypt(password.encode()).decode()
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        return password

def decrypt_password(encrypted: str) -> str:
    """Decrypt a stored broker/MT5 password."""
    try:
        f = _get_fernet()
        return f.decrypt(encrypted.encode()).decode()
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return encrypted


# ── Password hashing for user accounts ────────────────────────
# FIX: passlib 1.7.4 + bcrypt 4.x have a version detection bug.
# We try passlib first (for compatibility), then fall back to
# bcrypt directly if passlib fails.

def _make_pwd_context():
    try:
        from passlib.context import CryptContext
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return ctx
    except Exception as e:
        logger.warning(f"passlib CryptContext failed: {e}")
        return None

_pwd_context = _make_pwd_context()


def hash_user_password(password: str) -> str:
    """Hash a user password using bcrypt."""
    # Truncate to 72 bytes — bcrypt hard limit
    if isinstance(password, str):
        password_bytes = password.encode("utf-8")[:72]
        password = password_bytes.decode("utf-8", errors="ignore")

    # Try passlib first
    if _pwd_context:
        try:
            return _pwd_context.hash(password)
        except Exception as e:
            logger.warning(f"passlib hash failed, using bcrypt directly: {e}")

    # Fallback: use bcrypt directly
    import bcrypt
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_user_password(plain: str, hashed: str) -> bool:
    """Verify a user password against its hash."""
    # Truncate to 72 bytes — bcrypt hard limit
    if isinstance(plain, str):
        plain_bytes = plain.encode("utf-8")[:72]
        plain = plain_bytes.decode("utf-8", errors="ignore")

    # Try passlib first
    if _pwd_context:
        try:
            return _pwd_context.verify(plain, hashed)
        except Exception as e:
            logger.warning(f"passlib verify failed, using bcrypt directly: {e}")

    # Fallback: use bcrypt directly
    import bcrypt
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception as e:
        logger.error(f"bcrypt verify failed: {e}")
        return False



