from fastapi import HTTPException, Depends
from datetime import datetime, timedelta
from app.config.settings import settings
import pyjwt as jwt
import bcrypt

users_db = {
    "john@example.com": {
        "user_id": 1,
        "username": "john",
        "email": "john@email.com",
        "password": "$2b$12$i7KQpT5uMIOJ6UzUJuXt9eDFb.ACRGz8TaC9PgPGD07UH57oY02Ma"  # hashed version of "secret"
    }
}

def authenticate_user(username: str, password: str):
    # TODO: implement user retrieval from database
    user = users_db.get(username)
    if not user:
        return False
    if not verify_password(password, user["password"]):
        return False
    return user

def get_password_hash(password: str) -> str:
    password = password.encode('utf-8')  # Password must be in bytes
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password, salt)
    return hashed_password.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ENCODING_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ENCODING_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials")
        return username
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

def token_expired(token: str) -> bool:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ENCODING_ALGORITHM])
        exp = payload.get("exp")
        if exp is None:
            return True
        return datetime.utcnow() > datetime.utcfromtimestamp(exp)
    except jwt.PyJWTError:
        return True