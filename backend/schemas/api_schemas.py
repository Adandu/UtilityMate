from pydantic import BaseModel, EmailStr, field_validator
from typing import List, Optional, Any
from datetime import date, datetime

# Category Schemas
class CategoryBase(BaseModel):
    name: str
    unit: str

class CategoryCreate(CategoryBase):
    pass

class Category(CategoryBase):
    id: int
    user_id: Optional[int] = None
    class Config:
        from_attributes = True

# Provider Schemas
class ProviderBase(BaseModel):
    name: str
    category_id: int
    is_custom: bool = False

class ProviderCreate(ProviderBase):
    pass

class Provider(ProviderBase):
    id: int
    user_id: Optional[int] = None
    class Config:
        from_attributes = True

# Location Schemas
class LocationBase(BaseModel):
    name: str
    address: Optional[str] = None

class LocationCreate(LocationBase):
    pass

class Location(LocationBase):
    id: int
    user_id: int
    class Config:
        from_attributes = True

class ProviderSimple(BaseModel):
    id: int
    name: str
    category: Category
    class Config:
        from_attributes = True

class LocationSimple(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

# Invoice Schemas
class InvoiceBase(BaseModel):
    location_id: int
    provider_id: int
    invoice_date: date
    due_date: Optional[date] = None
    amount: float
    currency: str = "RON"
    consumption_value: Optional[float] = None

    @field_validator('invoice_date')
    @classmethod
    def invoice_date_not_in_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError('Invoice date cannot be in the future')
        return v

class InvoiceCreate(InvoiceBase):
    pass

class InvoiceUpdate(BaseModel):
    location_id: Optional[Any] = None
    provider_id: Optional[Any] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    consumption_value: Optional[float] = None

    @field_validator('location_id', 'provider_id', mode='before')
    @classmethod
    def coerce_int(cls, v):
        if v is None or v == "":
            return None
        try:
            return int(float(v))
        except (ValueError, TypeError):
            return None

class InvoiceBulkUpdate(BaseModel):
    invoice_ids: Any
    update_data: InvoiceUpdate

    @field_validator('invoice_ids', mode='before')
    @classmethod
    def coerce_ids(cls, v):
        if v is None: return []
        if isinstance(v, str):
            return [int(float(x.strip())) for x in v.split(',') if x.strip().replace('.','').isdigit()]
        if isinstance(v, list):
            res = []
            for x in v:
                try: res.append(int(float(x)))
                except: pass
            return res
        return v

class Invoice(InvoiceBase):
    id: int
    user_id: int
    pdf_path: Optional[str] = None
    created_at: datetime
    provider: Optional[ProviderSimple] = None
    location: Optional[LocationSimple] = None
    class Config:
        from_attributes = True

# Consumption Index Schemas
class ConsumptionIndexBase(BaseModel):
    location_id: int
    category_id: int
    value: float
    reading_date: date

    @field_validator('reading_date')
    @classmethod
    def reading_date_not_in_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError('Reading date cannot be in the future')
        return v

class ConsumptionIndexCreate(ConsumptionIndexBase):
    pass

class ConsumptionIndex(ConsumptionIndexBase):
    id: int
    user_id: int
    created_at: datetime
    class Config:
        from_attributes = True

# User Schemas
class UserBase(BaseModel):
    email: EmailStr

class UserUpdate(UserBase):
    current_password: Optional[str] = None
    dashboard_config: Optional[str] = None

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool
    theme_pref: str
    dashboard_config: Optional[str] = None
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
