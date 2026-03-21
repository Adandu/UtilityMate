from fastapi import APIRouter, Depends, HTTPException, status, Request, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Optional
from ..database.session import get_db
from ..models import database_models
from ..schemas import api_schemas
from ..utils import auth_utils
from ..utils.rate_limiter import limiter
from ..utils.logging_config import logger

router = APIRouter()

@router.post("/register", response_model=api_schemas.User)
@limiter.limit("5/minute")
def register_user(request: Request, user: api_schemas.UserCreate, db: Session = Depends(get_db)):
    logger.info("Registering new user: %s", user.email)
    db_user = db.query(database_models.User).filter(database_models.User.email == user.email).first()
    if db_user:
        logger.warning("Registration failed: Email already exists - %s", user.email)
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if len(user.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
    if len(user.password) > 72:
        raise HTTPException(status_code=400, detail="Password must be at most 72 characters long")
        
    hashed_password = auth_utils.get_password_hash(user.password)
    new_user = database_models.User(email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=api_schemas.Token)
@limiter.limit("10/minute")
def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    logger.info("Login attempt for user: %s", form_data.username)
    user = db.query(database_models.User).filter(database_models.User.email == form_data.username).first()
    if not user or not auth_utils.verify_password(form_data.password, user.hashed_password):
        logger.warning("Login failed for user: %s", form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth_utils.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth_utils.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=api_schemas.User)
async def read_users_me(current_user: database_models.User = Depends(auth_utils.get_current_user)):
    return current_user

@router.put("/me", response_model=api_schemas.User)
async def update_user_me(
    user_update: api_schemas.UserBase, 
    theme_pref: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: database_models.User = Depends(auth_utils.get_current_user)
):
    current_user.email = user_update.email
    if theme_pref:
        current_user.theme_pref = theme_pref
    db.commit()
    db.refresh(current_user)
    return current_user

@router.post("/change-password")
async def change_password(
    old_password: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db),
    current_user: database_models.User = Depends(auth_utils.get_current_user)
):
    if not auth_utils.verify_password(old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    if len(new_password) < 8 or len(new_password) > 72:
        raise HTTPException(status_code=400, detail="New password must be 8-72 characters")
        
    current_user.hashed_password = auth_utils.get_password_hash(new_password)
    db.commit()
    return {"message": "Password updated successfully"}
