from fastapi import FastAPI
from app.models.user import User
app = FastAPI()


@app.get("/")
def read_root():
    # should return public/index.html content
    return User(user_id=1, username="testuser", email="test@gmail.com")


