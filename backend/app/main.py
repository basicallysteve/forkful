from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Annotated
from app.database import engine, Base
from app.models.user import User
from app.core.security import authenticate_user, create_access_token

# from app.routers import auth
app = FastAPI()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token",)
# def create_tables():
#     Base.metadata.create_all(bind=engine)

def fake_decode_token(token):
    return User(
        username=token + "fakedecoded", email="john@example.com", user_id=1, password="$2b$12$i7KQpT5uMIOJ6UzUJuXt9eDFb.ACRGz8TaC9PgPGD07UH57oY02Ma"
    )
def get_password_hash(password):
    password = password.encode('utf-8')  # Password must be in bytes
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password, salt)
    return hashed_password.decode('utf-8')

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]):
    user = fake_decode_token(token)
    return user

@app.on_event("startup")
# def on_startup():
#     create_tables()




@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/users/me")
async def read_users_me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user

@app.post("/login")
async def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()]):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        return HTTPException(status_code=400, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": user["username"]})
    
    return {"access_token": access_token, "token_type": "bearer"}