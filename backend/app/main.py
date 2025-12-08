from fastapi import FastAPI
from app.database import engine, Base
# from app.routers import auth
app = FastAPI()
def create_tables():
    Base.metadata.create_all(bind=engine)
@app.on_event("startup")
def on_startup():
    create_tables()




@app.get("/")
def read_root():
    return {"Hello": "World"}
    # should return public/index.html content
    # return User(user_id=1, username="testuser", email="test@gmail.com")


