from pydantic import BaseModel, EmailStr, field_validator
from typing import List, Optional, Any
from datetime import date, datetime


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


class LocationBase(BaseModel):
    name: str
    address: Optional[str] = None
    household_id: Optional[int] = None


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


class InvoiceBase(BaseModel):
    location_id: int
    provider_id: int
    invoice_date: date
    due_date: Optional[date] = None
    amount: float
    currency: str = "RON"
    consumption_value: Optional[float] = None

    @field_validator("invoice_date")
    @classmethod
    def invoice_date_not_in_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Invoice date cannot be in the future")
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
    status: Optional[str] = None
    paid_at: Optional[datetime] = None
    payment_reference: Optional[str] = None
    parse_confidence: Optional[float] = None
    needs_review: Optional[bool] = None
    review_notes: Optional[str] = None
    source_type: Optional[str] = None
    source_name: Optional[str] = None
    processing_notes: Optional[str] = None

    @field_validator("location_id", "provider_id", mode="before")
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

    @field_validator("invoice_ids", mode="before")
    @classmethod
    def coerce_ids(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            return [int(float(x.strip())) for x in v.split(",") if x.strip().replace(".", "").isdigit()]
        if isinstance(v, list):
            res = []
            for x in v:
                try:
                    res.append(int(float(x)))
                except Exception:
                    pass
            return res
        return v


class Invoice(InvoiceBase):
    id: int
    user_id: int
    pdf_path: Optional[str] = None
    status: str
    paid_at: Optional[datetime] = None
    payment_reference: Optional[str] = None
    parse_confidence: float
    needs_review: bool
    review_notes: Optional[str] = None
    source_type: str
    source_name: Optional[str] = None
    processing_notes: Optional[str] = None
    created_at: datetime
    provider: Optional[ProviderSimple] = None
    location: Optional[LocationSimple] = None

    class Config:
        from_attributes = True


class InvoiceListResponse(BaseModel):
    items: List[Invoice]
    total: int
    skip: int
    limit: int


class ConsumptionIndexBase(BaseModel):
    location_id: int
    category_id: int
    value: float
    reading_date: date
    source_type: str = "manual"
    notes: Optional[str] = None

    @field_validator("reading_date")
    @classmethod
    def reading_date_not_in_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Reading date cannot be in the future")
        return v


class ConsumptionIndexCreate(ConsumptionIndexBase):
    pass


class ConsumptionIndexUpdate(BaseModel):
    value: Optional[float] = None
    reading_date: Optional[date] = None
    source_type: Optional[str] = None
    photo_path: Optional[str] = None
    notes: Optional[str] = None


class ConsumptionIndex(ConsumptionIndexBase):
    id: int
    user_id: int
    photo_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class HouseholdBase(BaseModel):
    name: str
    description: Optional[str] = None


class HouseholdCreate(HouseholdBase):
    pass


class HouseholdMemberBase(BaseModel):
    user_id: int
    role: str = "viewer"


class HouseholdMemberCreate(HouseholdMemberBase):
    pass


class HouseholdMember(HouseholdMemberBase):
    id: int
    household_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class Household(HouseholdBase):
    id: int
    owner_user_id: int
    created_at: datetime
    members: List[HouseholdMember] = []

    class Config:
        from_attributes = True


class BudgetBase(BaseModel):
    category_id: int
    location_id: Optional[int] = None
    household_id: Optional[int] = None
    monthly_limit: float
    warning_threshold: float = 0.85
    is_active: bool = True


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseModel):
    monthly_limit: Optional[float] = None
    warning_threshold: Optional[float] = None
    is_active: Optional[bool] = None
    location_id: Optional[int] = None
    household_id: Optional[int] = None


class Budget(BudgetBase):
    id: int
    user_id: int
    created_at: datetime
    category: Optional[Category] = None
    location: Optional[LocationSimple] = None

    class Config:
        from_attributes = True


class BudgetStatus(BaseModel):
    budget: Budget
    spent: float
    remaining: float
    usage_ratio: float
    status: str


class AlertBase(BaseModel):
    category: str
    severity: str = "info"
    title: str
    message: str
    context_json: Optional[str] = None


class AlertCreate(AlertBase):
    pass


class Alert(AlertBase):
    id: int
    user_id: int
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AutomationEventCreate(BaseModel):
    source: str
    event_type: str
    payload_json: Optional[str] = None


class AutomationEvent(BaseModel):
    id: int
    user_id: int
    source: str
    event_type: str
    payload_json: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


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


class AnalyticsSummary(BaseModel):
    total_spend: float
    invoice_count: int
    overdue_invoices: int
    needs_review_count: int
    active_alerts: int
    unpaid_total: float
    avg_monthly_spend: float


class ForecastPoint(BaseModel):
    label: str
    amount: float


class ReportBundle(BaseModel):
    summary: AnalyticsSummary
    budget_statuses: List[BudgetStatus]
    alerts: List[Alert]
    forecast: List[ForecastPoint]


class DashboardSummary(BaseModel):
    total_cost: float
    avg_monthly_cost: float
    previous_period_cost: float
    change_ratio: float
    active_categories: int
    months_covered: int


class DashboardSeriesPoint(BaseModel):
    label: str
    cost: float
    consumption: float
    unit_cost: Optional[float] = None
    last_year_cost: Optional[float] = None
    forecast_cost: Optional[float] = None


class LocationComparisonPoint(BaseModel):
    location_id: int
    location_name: str
    cost: float
    consumption: float
    unit_cost: Optional[float] = None


class DashboardCategorySection(BaseModel):
    category_id: int
    category_name: str
    unit: str
    total_cost: float
    total_consumption: float
    avg_unit_cost: Optional[float] = None
    monthly_series: List[DashboardSeriesPoint]
    location_comparison: List[LocationComparisonPoint]


class DashboardAnalyticsResponse(BaseModel):
    summary: DashboardSummary
    available_locations: List[LocationSimple]
    selected_location_id: Optional[int] = None
    period_key: str
    start_date: date
    end_date: date
    overall_cost_series: List[DashboardSeriesPoint]
    avizier_cost_series: List[DashboardSeriesPoint]
    avizier_location_comparison: List[LocationComparisonPoint]
    supplier_sections: List[DashboardCategorySection]
    avizier_sections: List[DashboardCategorySection]


class AppStats(BaseModel):
    invoices: int
    locations: int
    providers: int
    categories: int
    households: int
    manual_meter_readings: int
    unread_alerts: int


class AppEnvironmentInfo(BaseModel):
    api_version: str
    database_dialect: str
    upload_dir: str
    app_env: str
    allowed_origins: List[str]
    server_time_utc: datetime


class AboutResponse(BaseModel):
    version: str
    release_notes_markdown: str
    stats: AppStats
    environment: AppEnvironmentInfo


class AssociationStatementLine(BaseModel):
    id: int
    location_id: int
    category_id: Optional[int] = None
    raw_label: str
    normalized_label: str
    line_kind: str
    amount: float
    consumption_value: Optional[float] = None
    unit: Optional[str] = None
    include_in_overall_analytics: bool
    include_in_category_analytics: bool
    include_in_unit_cost: bool
    created_at: datetime
    location: Optional[LocationSimple] = None
    category: Optional[Category] = None

    class Config:
        from_attributes = True


class AssociationStatement(BaseModel):
    id: int
    statement_month: date
    display_month: str
    posted_date: Optional[date] = None
    due_date: Optional[date] = None
    source_name: Optional[str] = None
    pdf_path: Optional[str] = None
    total_payable: Optional[float] = None
    parsing_profile: Optional[str] = None
    created_at: datetime
    lines: List[AssociationStatementLine] = []

    class Config:
        from_attributes = True


class AssociationStatementUploadResult(BaseModel):
    filename: str
    status: str
    detail: str
    statement_id: Optional[int] = None
    display_month: Optional[str] = None
    imported_locations: List[str] = []
    imported_lines: int = 0


class RentRoomBase(BaseModel):
    name: str
    sort_order: int = 0


class RentRoomCreate(RentRoomBase):
    pass


class RentRoomUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None


class RentRoom(RentRoomBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RentTenantBase(BaseModel):
    name: str
    default_room_id: Optional[int] = None
    sort_order: int = 0
    is_active_default: bool = True
    pays_rent_default: bool = True
    pays_utilities_default: bool = True
    default_rent_amount: float = 0.0


class RentTenantCreate(RentTenantBase):
    pass


class RentTenantUpdate(BaseModel):
    name: Optional[str] = None
    default_room_id: Optional[int] = None
    sort_order: Optional[int] = None
    is_active_default: Optional[bool] = None
    pays_rent_default: Optional[bool] = None
    pays_utilities_default: Optional[bool] = None
    default_rent_amount: Optional[float] = None


class RentTenant(RentTenantBase):
    id: int
    created_at: datetime
    default_room: Optional[RentRoom] = None

    class Config:
        from_attributes = True


class RentLeaseBase(BaseModel):
    location_id: int
    electricity_provider_id: Optional[int] = None
    name: str
    notes: Optional[str] = None
    is_active: bool = True


class RentLeaseCreate(RentLeaseBase):
    pass


class RentLeaseUpdate(BaseModel):
    location_id: Optional[int] = None
    electricity_provider_id: Optional[int] = None
    name: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class RentLeaseSummary(BaseModel):
    id: int
    name: str
    is_active: bool
    created_at: datetime
    location: LocationSimple

    class Config:
        from_attributes = True


class RentMonthTenantConfigInput(BaseModel):
    tenant_id: int
    room_id: Optional[int] = None
    is_active: bool = True
    pays_rent: bool = True
    pays_utilities: bool = True
    rent_amount: float = 0.0
    other_adjustment: float = 0.0


class RentRoomUsageInput(BaseModel):
    room_id: int
    usage_value: float = 0.0


class RentMonthUpsert(BaseModel):
    month: date
    notes: Optional[str] = None
    tenant_configs: List[RentMonthTenantConfigInput]
    room_usages: List[RentRoomUsageInput] = []


class RentPaymentCreate(BaseModel):
    tenant_id: int
    month: date
    payment_date: date
    amount: float
    notes: Optional[str] = None


class RentPayment(BaseModel):
    id: int
    tenant_id: int
    month: date
    payment_date: date
    amount: float
    notes: Optional[str] = None
    created_at: datetime
    tenant: Optional[RentTenant] = None

    class Config:
        from_attributes = True


class RentTenantMonthConfig(BaseModel):
    tenant_id: int
    tenant_name: str
    room_id: Optional[int] = None
    room_name: Optional[str] = None
    is_active: bool
    pays_rent: bool
    pays_utilities: bool
    rent_amount: float
    other_adjustment: float


class RentRoomUsage(BaseModel):
    room_id: int
    room_name: str
    usage_value: float


class RentSourceSummary(BaseModel):
    electricity_total: float
    avizier_total: float
    heating_total: float
    non_heating_utilities_total: float


class RentTenantStatement(BaseModel):
    tenant_id: int
    tenant_name: str
    room_name: Optional[str] = None
    is_active: bool
    pays_rent: bool
    pays_utilities: bool
    rent_amount: float
    electricity_amount: float
    shared_utilities_amount: float
    heating_amount: float
    utilities_amount: float
    other_adjustment: float
    current_total: float
    previous_balance: float
    payments_in_month: float
    amount_due: float


class RentMonthStatement(BaseModel):
    month: date
    notes: Optional[str] = None
    source_summary: RentSourceSummary
    utility_payer_count: int
    heating_allocation_mode: str
    tenant_configs: List[RentTenantMonthConfig]
    room_usages: List[RentRoomUsage]
    payments: List[RentPayment]
    tenant_statements: List[RentTenantStatement]
    totals: dict[str, float]


class RentLeaseDetail(BaseModel):
    id: int
    name: str
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    location: LocationSimple
    electricity_provider: Optional[ProviderSimple] = None
    tenants: List[RentTenant] = []
    rooms: List[RentRoom] = []
    available_statement_months: List[date] = []
    configured_months: List[date] = []

    class Config:
        from_attributes = True
