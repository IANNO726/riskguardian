from cryptography.fernet import Fernet
import os


class EncryptionService:

    def __init__(self):
        key = os.getenv("ENCRYPTION_KEY")

        if not key:
            raise Exception("ENCRYPTION_KEY not set in environment variables")

        self.cipher = Fernet(key.encode())

    def encrypt(self, plain_text: str) -> str:
        encrypted = self.cipher.encrypt(plain_text.encode())
        return encrypted.decode()

    def decrypt(self, encrypted_text: str) -> str:
        decrypted = self.cipher.decrypt(encrypted_text.encode())
        return decrypted.decode()