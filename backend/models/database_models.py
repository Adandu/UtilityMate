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
    rent_leases = relationship("RentLease", back_populates="owner", cascade="all, delete-orphan")

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
    association_statement_lines = relationship("AssociationStatementLine", back_populates="location", cascade="all, delete-orphan")
    rent_leases = relationship("RentLease", back_populates="location", cascade="all, delete-orphan")

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True) # Null for system defaults
    name = Column(String, index=True, nullable=False) # Removed unique=True to allow same names for different users
    unit = Column(String, nullable=False) # e.g. "kWh", "m3"
    
    providers = relationship("Provider", back_populates="category", cascade="all, delete-orphan")
    indexes = relationship("ConsumptionIndex", back_populates="category", cascade="all, delete-orphan")
    association_statement_lines = relationship("AssociationStatementLine", back_populates="category")

class Provider(Base):
    __tablename__ = "providers"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True) # Null for system defaults
    category_id = Column(Integer, ForeignKey("categories.id"), index=True)
    name = Column(String, nullable=False) # e.g. "Hidroelectrica", "ENGIE"
    is_custom = Column(Boolean, default=False)
    
    category = relationship("Category", back_populates="providers")
    invoices = relationship("Invoice", back_populates="provider")
    rent_leases = relationship("RentLease", back_populates="electricity_provider")

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


class AssociationStatement(Base):
    __tablename__ = "association_statements"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    statement_month = Column(Date, nullable=False, index=True)
    display_month = Column(String, nullable=False)
    posted_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    source_name = Column(String, nullable=True)
    pdf_path = Column(String, nullable=True)
    total_payable = Column(Float, nullable=True)
    parsing_profile = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User")
    lines = relationship("AssociationStatementLine", back_populates="statement", cascade="all, delete-orphan")


class AssociationStatementLine(Base):
    __tablename__ = "association_statement_lines"
    id = Column(Integer, primary_key=True, index=True)
    statement_id = Column(Integer, ForeignKey("association_statements.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), index=True, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), index=True, nullable=True)
    raw_label = Column(String, nullable=False)
    normalized_label = Column(String, nullable=False)
    line_kind = Column(String, nullable=False, default="utility")
    amount = Column(Float, nullable=False, default=0.0)
    consumption_value = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    include_in_overall_analytics = Column(Boolean, default=True)
    include_in_category_analytics = Column(Boolean, default=False)
    include_in_unit_cost = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    statement = relationship("AssociationStatement", back_populates="lines")
    location = relationship("Location", back_populates="association_statement_lines")
    category = relationship("Category", back_populates="association_statement_lines")

class ConsumptionIndex(Base):
    __tablename__ = "consumption_indexes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), index=True)
    meter_label = Column(String, nullable=False, default="")
    value = Column(Float, nullable=False)
    reading_date = Column(Date, nullable=False)
    source_type = Column(String, default="manual")
    photo_path = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    owner = relationship("User", back_populates="indexes")
    location = relationship("Location", back_populates="indexes")
    category = relationship("Category", back_populates="indexes")
    
    # Avoid duplicate readings for the same device stream on the same date.
    __table_args__ = (
        Index("idx_consumption_stream_unique", "location_id", "category_id", "meter_label", "reading_date", unique=True),
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


class RentLease(Base):
    __tablename__ = "rent_leases"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), index=True, nullable=False)
    electricity_provider_id = Column(Integer, ForeignKey("providers.id"), index=True, nullable=True)
    name = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="rent_leases")
    location = relationship("Location", back_populates="rent_leases")
    electricity_provider = relationship("Provider", back_populates="rent_leases")
    tenants = relationship("RentTenant", back_populates="lease", cascade="all, delete-orphan", order_by="RentTenant.sort_order")
    rooms = relationship("RentRoom", back_populates="lease", cascade="all, delete-orphan", order_by="RentRoom.sort_order")
    months = relationship("RentMonth", back_populates="lease", cascade="all, delete-orphan", order_by="RentMonth.month")
    payments = relationship("RentPayment", back_populates="lease", cascade="all, delete-orphan", order_by="RentPayment.payment_date")


class RentRoom(Base):
    __tablename__ = "rent_rooms"
    id = Column(Integer, primary_key=True, index=True)
    lease_id = Column(Integer, ForeignKey("rent_leases.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    lease = relationship("RentLease", back_populates="rooms")
    tenants = relationship("RentTenant", back_populates="default_room")
    month_tenants = relationship("RentMonthTenant", back_populates="room")
    room_usages = relationship("RentRoomUsage", back_populates="room", cascade="all, delete-orphan")
    energy_usages = relationship("RentRoomEnergyUsage", back_populates="room", cascade="all, delete-orphan")


class RentTenant(Base):
    __tablename__ = "rent_tenants"
    id = Column(Integer, primary_key=True, index=True)
    lease_id = Column(Integer, ForeignKey("rent_leases.id", ondelete="CASCADE"), index=True, nullable=False)
    default_room_id = Column(Integer, ForeignKey("rent_rooms.id"), index=True, nullable=True)
    name = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)
    is_active_default = Column(Boolean, default=True)
    pays_rent_default = Column(Boolean, default=True)
    pays_utilities_default = Column(Boolean, default=True)
    default_rent_amount = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    lease = relationship("RentLease", back_populates="tenants")
    default_room = relationship("RentRoom", back_populates="tenants")
    month_configs = relationship("RentMonthTenant", back_populates="tenant", cascade="all, delete-orphan")
    payments = relationship("RentPayment", back_populates="tenant", cascade="all, delete-orphan")


class RentMonth(Base):
    __tablename__ = "rent_months"
    id = Column(Integer, primary_key=True, index=True)
    lease_id = Column(Integer, ForeignKey("rent_leases.id", ondelete="CASCADE"), index=True, nullable=False)
    month = Column(Date, nullable=False, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    lease = relationship("RentLease", back_populates="months")
    tenant_configs = relationship("RentMonthTenant", back_populates="rent_month", cascade="all, delete-orphan")
    room_usages = relationship("RentRoomUsage", back_populates="rent_month", cascade="all, delete-orphan")
    room_energy_usages = relationship("RentRoomEnergyUsage", back_populates="rent_month", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_rent_month_unique", "lease_id", "month", unique=True),
    )


class RentMonthTenant(Base):
    __tablename__ = "rent_month_tenants"
    id = Column(Integer, primary_key=True, index=True)
    rent_month_id = Column(Integer, ForeignKey("rent_months.id", ondelete="CASCADE"), index=True, nullable=False)
    tenant_id = Column(Integer, ForeignKey("rent_tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    room_id = Column(Integer, ForeignKey("rent_rooms.id"), index=True, nullable=True)
    is_active = Column(Boolean, default=True)
    pays_rent = Column(Boolean, default=True)
    pays_utilities = Column(Boolean, default=True)
    rent_amount = Column(Float, default=0.0)
    other_adjustment = Column(Float, default=0.0)
    other_adjustment_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    rent_month = relationship("RentMonth", back_populates="tenant_configs")
    tenant = relationship("RentTenant", back_populates="month_configs")
    room = relationship("RentRoom", back_populates="month_tenants")

    __table_args__ = (
        Index("idx_rent_month_tenant_unique", "rent_month_id", "tenant_id", unique=True),
    )


class RentRoomUsage(Base):
    __tablename__ = "rent_room_usages"
    id = Column(Integer, primary_key=True, index=True)
    rent_month_id = Column(Integer, ForeignKey("rent_months.id", ondelete="CASCADE"), index=True, nullable=False)
    room_id = Column(Integer, ForeignKey("rent_rooms.id", ondelete="CASCADE"), index=True, nullable=False)
    usage_value = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    rent_month = relationship("RentMonth", back_populates="room_usages")
    room = relationship("RentRoom", back_populates="room_usages")

    __table_args__ = (
        Index("idx_rent_room_usage_unique", "rent_month_id", "room_id", unique=True),
    )


class RentRoomEnergyUsage(Base):
    __tablename__ = "rent_room_energy_usages"
    id = Column(Integer, primary_key=True, index=True)
    rent_month_id = Column(Integer, ForeignKey("rent_months.id", ondelete="CASCADE"), index=True, nullable=False)
    room_id = Column(Integer, ForeignKey("rent_rooms.id", ondelete="CASCADE"), index=True, nullable=False)
    usage_kwh = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    rent_month = relationship("RentMonth", back_populates="room_energy_usages")
    room = relationship("RentRoom", back_populates="energy_usages")

    __table_args__ = (
        Index("idx_rent_room_energy_usage_unique", "rent_month_id", "room_id", unique=True),
    )


class RentPayment(Base):
    __tablename__ = "rent_payments"
    id = Column(Integer, primary_key=True, index=True)
    lease_id = Column(Integer, ForeignKey("rent_leases.id", ondelete="CASCADE"), index=True, nullable=False)
    tenant_id = Column(Integer, ForeignKey("rent_tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    month = Column(Date, nullable=False, index=True)
    payment_date = Column(Date, nullable=False)
    amount = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    lease = relationship("RentLease", back_populates="payments")
    tenant = relationship("RentTenant", back_populates="payments")


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
