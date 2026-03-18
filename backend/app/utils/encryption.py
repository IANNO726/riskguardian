"""
Encryption utilities for storing sensitive data
"""
from cryptography.fernet import Fernet
import os
import base64
from typing import Optional

# Generate or load encryption key
# In production, store this in environment variable or secure vault
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", Fernet.generate_key())
cipher_suite = Fernet(ENCRYPTION_KEY)

def encrypt_password(password: str) -> str:
    """Encrypt a password for storage"""
    encrypted = cipher_suite.encrypt(password.encode())
    return base64.b64encode(encrypted).decode()

def decrypt_password(encrypted_password: str) -> str:
    """Decrypt a stored password"""
    try:
        encrypted = base64.b64decode(encrypted_password.encode())
        decrypted = cipher_suite.decrypt(encrypted)
        return decrypted.decode()
    except Exception as e:
        raise ValueError(f"Failed to decrypt password: {e}")

def hash_user_password(password: str) -> str:
    """Hash user login password (for authentication)"""
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    return pwd_context.hash(password)

def verify_user_password(plain_password: str, hashed_password: str) -> bool:
    """Verify user login password"""
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    return pwd_context.verify(plain_password, hashed_password)



