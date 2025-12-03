from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def read_root():
    # should return public/index.html content
    return {"message": "Welcome to the Forkful api!"}


