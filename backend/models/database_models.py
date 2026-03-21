from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Date, Enum as SqlEnum, CheckConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timezone

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    theme_pref = Column(String, default="light")
    
    locations = relationship("Location", back_populates="owner", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="owner", cascade="all, delete-orphan")
    indexes = relationship("ConsumptionIndex", back_populates="owner", cascade="all, delete-orphan")

class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name = Column(String, nullable=False) # e.g. "AP12", "AP15"
    address = Column(String, nullable=True)
    
    owner = relationship("User", back_populates="locations")
    invoices = relationship("Invoice", back_populates="location", cascade="all, delete-orphan")
    indexes = relationship("ConsumptionIndex", back_populates="location", cascade="all, delete-orphan")

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False) # e.g. "Electricity", "Water"
    unit = Column(String, nullable=False) # e.g. "kWh", "m3"
    
    providers = relationship("Provider", back_populates="category")
    indexes = relationship("ConsumptionIndex", back_populates="category")

class Provider(Base):
    __tablename__ = "providers"
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), index=True)
    name = Column(String, nullable=False) # e.g. "Hidroelectrica", "ENGIE"
    is_custom = Column(Boolean, default=False)
    
    category = relationship("Category", back_populates="providers")
    invoices = relationship("Invoice", back_populates="provider")

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), index=True)
    provider_id = Column(Integer, ForeignKey("providers.id"), index=True)
    billing_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="RON")
    consumption_value = Column(Float, nullable=True)
    pdf_path = Column(String, nullable=True)
    status = Column(String, default="unpaid") # paid, unpaid, overdue
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        CheckConstraint("status IN ('paid', 'unpaid', 'overdue')", name="status_check"),
    )
    
    owner = relationship("User", back_populates="invoices")
    location = relationship("Location", back_populates="invoices")
    provider = relationship("Provider", back_populates="invoices")

class ConsumptionIndex(Base):
    __tablename__ = "consumption_indexes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), index=True)
    value = Column(Float, nullable=False)
    reading_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    owner = relationship("User", back_populates="indexes")
    location = relationship("Location", back_populates="indexes")
    category = relationship("Category", back_populates="indexes")
    
    # Avoid duplicate readings for same location/category on same date
    __table_args__ = (
        Index("idx_consumption_unique", "location_id", "category_id", "reading_date", unique=True),
    )
