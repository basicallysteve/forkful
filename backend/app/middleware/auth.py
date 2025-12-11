from app.core.security import token_expired
from fastapi import Request, HTTPException

async def verify_token_middleware(request: Request, call_next):
    protected_paths = ["/api"]

    if not any(request.url.path.startswith(path) for path in protected_paths):
        return await call_next(request)
    
    token = request.cookies.get("access_token")
    expired = token_expired(token) if token else True
    if expired:
        request.cookies.clear()
        raise HTTPException(status_code=401, detail="Token is invalid or has expired")
    else:
        # add token to request headers for downstream processing
        request.headers.__dict__["_list"].append((b"authorization", f"Bearer {token}".encode()))
    return await call_next(request)