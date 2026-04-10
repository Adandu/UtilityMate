from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Date, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timezone

Base = declarative_base()


class Household(Base):
    __tablename__ = "households"
    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="owned_households", foreign_keys=[owner_user_id])
    members = relationship("HouseholdMember", back_populates="household", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="household", cascade="all, delete-orphan")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    theme_pref = Column(String, default="light")
    dashboard_config = Column(String, nullable=True) # JSON string of widgets
    
    locations = relationship("Location", back_populates="owner", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="owner", cascade="all, delete-orphan")
    indexes = relationship("ConsumptionIndex", back_populates="owner", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="owner", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="owner", cascade="all, delete-orphan")
    automation_events = relationship("AutomationEvent", back_populates="owner", cascade="all, delete-orphan")
    owned_households = relationship("Household", back_populates="owner", cascade="all, delete-orphan", foreign_keys=[Household.owner_user_id])
    household_memberships = relationship("HouseholdMember", back_populates="user", cascade="all, delete-orphan")

class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="SET NULL"), index=True, nullable=True)
    name = Column(String, nullable=False) # e.g. "AP12", "AP15"
    address = Column(String, nullable=True)
    
    owner = relationship("User", back_populates="locations")
    invoices = relationship("Invoice", back_populates="location", cascade="all, delete-orphan")
    indexes = relationship("ConsumptionIndex", back_populates="location", cascade="all, delete-orphan")

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True) # Null for system defaults
    name = Column(String, index=True, nullable=False) # Removed unique=True to allow same names for different users
    unit = Column(String, nullable=False) # e.g. "kWh", "m3"
    
    providers = relationship("Provider", back_populates="category", cascade="all, delete-orphan")
    indexes = relationship("ConsumptionIndex", back_populates="category", cascade="all, delete-orphan")

class Provider(Base):
    __tablename__ = "providers"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True) # Null for system defaults
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
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="RON")
    consumption_value = Column(Float, nullable=True)
    pdf_path = Column(String, nullable=True)
    status = Column(String, default="received")
    paid_at = Column(DateTime, nullable=True)
    payment_reference = Column(String, nullable=True)
    parse_confidence = Column(Float, default=0.0)
    needs_review = Column(Boolean, default=False)
    review_notes = Column(Text, nullable=True)
    source_type = Column(String, default="pdf")
    source_name = Column(String, nullable=True)
    processing_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
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
    source_type = Column(String, default="manual")
    photo_path = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    owner = relationship("User", back_populates="indexes")
    location = relationship("Location", back_populates="indexes")
    category = relationship("Category", back_populates="indexes")
    
    # Avoid duplicate readings for same location/category on same date
    __table_args__ = (
        Index("idx_consumption_unique", "location_id", "category_id", "reading_date", unique=True),
    )


class HouseholdMember(Base):
    __tablename__ = "household_members"
    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    role = Column(String, default="viewer")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    household = relationship("Household", back_populates="members")
    user = relationship("User", back_populates="household_memberships")


class Budget(Base):
    __tablename__ = "budgets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="SET NULL"), index=True, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), index=True, nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"), index=True, nullable=True)
    monthly_limit = Column(Float, nullable=False)
    warning_threshold = Column(Float, default=0.85)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="budgets")
    household = relationship("Household", back_populates="budgets")
    category = relationship("Category")
    location = relationship("Location")


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    category = Column(String, nullable=False)
    severity = Column(String, default="info")
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    context_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="alerts")


class AutomationEvent(Base):
    __tablename__ = "automation_events"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    source = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    payload_json = Column(Text, nullable=True)
    status = Column(String, default="received")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="automation_events")
