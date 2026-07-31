"""Auth endpoints. Thin: parse, delegate to services, shape response."""
from fastapi import APIRouter, Depends, Request, Response

from app.core.dependencies import get_client_ip, get_current_user
from app.core.security import clear_auth_cookies, set_access_cookie, set_auth_cookies
from app.models.auth import LoginInput, RegisterInput
from app.models.user import UserOut, user_to_out
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, response_model_by_alias=False)
async def register(body: RegisterInput, response: Response):
    user = await auth_service.register_user(body.email, body.password, body.name)
    access, refresh = auth_service.issue_tokens(user)
    set_auth_cookies(response, access, refresh)
    return user_to_out(user)


@router.post("/login", response_model=UserOut, response_model_by_alias=False)
async def login(body: LoginInput, request: Request, response: Response):
    user = await auth_service.login_user(body.email, body.password, get_client_ip(request))
    access, refresh = auth_service.issue_tokens(user)
    set_auth_cookies(response, access, refresh)
    return user_to_out(user)


@router.post("/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"message": "Logged out"}


@router.get("/me", response_model=UserOut, response_model_by_alias=False)
async def me(user: dict = Depends(get_current_user)):
    return user_to_out(user)


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    _, access = await auth_service.refresh_access_token(token or "")
    set_access_cookie(response, access)
    return {"message": "Token refreshed"}
