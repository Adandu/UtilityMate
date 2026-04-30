import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Home, Loader2, Plus, ReceiptText, Trash2, Users, BedDouble, CreditCard, Save, Download, Pencil } from 'lucide-react';
import api from '../utils/api';

interface LocationOption { id: number; name: string; }
interface ProviderOption { id: number; name: string; }
interface RentLeaseSummary { id: number; name: string; is_active: boolean; created_at: string; location: LocationOption; }
interface RentRoom { id: number; name: string; sort_order: number; }
interface RentTenant {
  id: number;
  name: string;
  default_room_id?: number | null;
  sort_order: number;
  is_active_default: boolean;
  pays_rent_default: boolean;
  pays_utilities_default: boolean;
  default_rent_amount: number;
  default_room?: RentRoom | null;
}
interface RentLeaseDetail {
  id: number;
  name: string;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  location: LocationOption;
  electricity_provider?: ProviderOption | null;
  tenants: RentTenant[];
  rooms: RentRoom[];
  available_statement_months: string[];
  configured_months: string[];
}
interface RentTenantMonthConfig {
  tenant_id: number;
  tenant_name: string;
  room_id?: number | null;
  room_name?: string | null;
  is_active: boolean;
  pays_rent: boolean;
  pays_utilities: boolean;
  rent_amount: number;
  other_adjustment: number;
  other_adjustment_note?: string | null;
}
interface RentRoomUsage { room_id: number; room_name: string; usage_value: number; }
interface RentRoomEnergyUsage { room_id: number; room_name: string; usage_kwh: number; }
interface RentPayment {
  id: number;
  tenant_id: number;
  month: string;
  payment_date: string;
  amount: number;
  notes?: string | null;
  tenant?: { id: number; name: string } | null;
}
interface RentTenantStatement {
  tenant_id: number;
  tenant_name: string;
  room_name?: string | null;
  rent_amount: number;
  electricity_amount: number;
  shared_utilities_amount: number;
  heating_amount: number;
  utilities_amount: number;
  other_adjustment: number;
  other_adjustment_note?: string | null;
  previous_balance: number;
  payments_in_month: number;
  amount_due: number;
}
interface RentMonthStatement {
  month: string;
  notes?: string | null;
  source_summary: {
    electricity_total: number;
    electricity_consumption_total: number;
    avizier_total: number;
    heating_total: number;
    non_heating_utilities_total: number;
  };
  utility_payer_count: number;
  electricity_allocation_mode: string;
  heating_allocation_mode: string;
  tenant_configs: RentTenantMonthConfig[];
  room_usages: RentRoomUsage[];
  room_energy_usages: RentRoomEnergyUsage[];
  payments: RentPayment[];
  tenant_statements: RentTenantStatement[];
  totals: {
    rent_total: number;
    electricity_total: number;
    avizier_total: number;
    current_total: number;
    payments_total: number;
    amount_due_total: number;
  };
}

const currentMonthValue = () => new Date().toISOString().slice(0, 7);
const monthInputToApi = (value: string) => `${value}-01`;
const apiMonthToInput = (value: string) => value.slice(0, 7);
const formatMoney = (value: number) => `${value.toFixed(2)} RON`;

const Rent: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [savingMonth, setSavingMonth] = useState(false);
  const [savingLeaseName, setSavingLeaseName] = useState(false);
  const [editingLeaseName, setEditingLeaseName] = useState(false);
  const [leases, setLeases] = useState<RentLeaseSummary[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<number | null>(null);
  const [leaseDetail, setLeaseDetail] = useState<RentLeaseDetail | null>(null);
  const [statement, setStatement] = useState<RentMonthStatement | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue());
  const [draftConfigs, setDraftConfigs] = useState<RentTenantMonthConfig[]>([]);
  const [draftRoomUsages, setDraftRoomUsages] = useState<RentRoomUsage[]>([]);
  const [draftRoomEnergyUsages, setDraftRoomEnergyUsages] = useState<RentRoomEnergyUsage[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [leaseNameDraft, setLeaseNameDraft] = useState('');
  const [exportingStatement, setExportingStatement] = useState(false);
  const leaseNameInputRef = useRef<HTMLInputElement | null>(null);

  const [newLeaseName, setNewLeaseName] = useState('');
  const [newLeaseLocationId, setNewLeaseLocationId] = useState('');
  const [newLeaseProviderId, setNewLeaseProviderId] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantRoomId, setNewTenantRoomId] = useState('');
  const [newTenantRentAmount, setNewTenantRentAmount] = useState('');
  const [paymentTenantId, setPaymentTenantId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const fetchBaseData = useCallback(async () => {
    const [leasesResponse, locationsResponse, providersResponse] = await Promise.all([
      api.get<RentLeaseSummary[]>('/rent/leases'),
      api.get<LocationOption[]>('/locations/'),
      api.get<ProviderOption[]>('/providers/'),
    ]);
    setLeases(leasesResponse.data);
    setLocations(locationsResponse.data);
    setProviders(providersResponse.data);
    setSelectedLeaseId((current) => current || leasesResponse.data[0]?.id || null);
  }, []);

  const fetchLeaseDetail = async (leaseId: number) => {
    const response = await api.get<RentLeaseDetail>(`/rent/leases/${leaseId}`);
    setLeaseDetail(response.data);
    setLeaseNameDraft(response.data.name);
  };

  const fetchStatement = async (leaseId: number, month: string) => {
    const response = await api.get<RentMonthStatement>(`/rent/leases/${leaseId}/statement`, {
      params: { month: monthInputToApi(month) },
    });
    setStatement(response.data);
    setDraftConfigs(response.data.tenant_configs);
    setDraftRoomUsages(response.data.room_usages);
    setDraftRoomEnergyUsages(response.data.room_energy_usages);
    setNoteDraft(response.data.notes || '');
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await fetchBaseData();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fetchBaseData]);

  useEffect(() => {
    if (!selectedLeaseId) {
      setLeaseDetail(null);
      setStatement(null);
      return;
    }
    const loadLease = async () => {
      setLoading(true);
      try {
        await fetchLeaseDetail(selectedLeaseId);
        await fetchStatement(selectedLeaseId, selectedMonth);
      } finally {
        setLoading(false);
      }
    };
    loadLease();
  }, [selectedLeaseId, selectedMonth]);

  useEffect(() => {
    if (editingLeaseName) {
      leaseNameInputRef.current?.focus();
      leaseNameInputRef.current?.select();
    }
  }, [editingLeaseName]);

  const statementMonthOptions = useMemo(() => {
    if (!leaseDetail) return [];
    const months = new Set<string>([
      ...leaseDetail.available_statement_months.map(apiMonthToInput),
      ...leaseDetail.configured_months.map(apiMonthToInput),
      selectedMonth,
    ]);
    return Array.from(months).sort();
  }, [leaseDetail, selectedMonth]);

  const refreshCurrentLease = async () => {
    await fetchBaseData();
    if (selectedLeaseId) {
      await fetchLeaseDetail(selectedLeaseId);
      await fetchStatement(selectedLeaseId, selectedMonth);
    }
  };

  const createLease = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await api.post<RentLeaseDetail>('/rent/leases', {
      name: newLeaseName,
      location_id: parseInt(newLeaseLocationId, 10),
      electricity_provider_id: newLeaseProviderId ? parseInt(newLeaseProviderId, 10) : null,
      notes: '',
      is_active: true,
    });
    setNewLeaseName('');
    setNewLeaseLocationId('');
    setNewLeaseProviderId('');
    await fetchBaseData();
    setSelectedLeaseId(response.data.id);
  };

  const deleteLease = async (leaseId: number) => {
    if (!window.confirm('Delete this rent workspace, including tenants, rooms, monthly setups, and payments?')) return;
    await api.delete(`/rent/leases/${leaseId}`);
    const remaining = leases.filter((lease) => lease.id !== leaseId);
    setSelectedLeaseId(remaining[0]?.id ?? null);
    await fetchBaseData();
  };

  const renameLease = async () => {
    if (!leaseDetail) return;
    const trimmedName = leaseNameDraft.trim();
    if (!trimmedName) {
      setLeaseNameDraft(leaseDetail.name);
      setEditingLeaseName(false);
      return;
    }
    if (trimmedName === leaseDetail.name) {
      setEditingLeaseName(false);
      return;
    }
    setSavingLeaseName(true);
    try {
      await api.put(`/rent/leases/${leaseDetail.id}`, { name: trimmedName });
      await refreshCurrentLease();
      setEditingLeaseName(false);
    } finally {
      setSavingLeaseName(false);
    }
  };

  const cancelLeaseRename = () => {
    if (!leaseDetail) return;
    setLeaseNameDraft(leaseDetail.name);
    setEditingLeaseName(false);
  };

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeaseId) return;
    await api.post(`/rent/leases/${selectedLeaseId}/rooms`, {
      name: newRoomName,
      sort_order: leaseDetail?.rooms.length || 0,
    });
    setNewRoomName('');
    await refreshCurrentLease();
  };

  const deleteRoom = async (roomId: number) => {
    if (!window.confirm('Delete this room? Default assignments and saved month assignments will be cleared.')) return;
    await api.delete(`/rent/rooms/${roomId}`);
    await refreshCurrentLease();
  };

  const createTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeaseId) return;
    await api.post(`/rent/leases/${selectedLeaseId}/tenants`, {
      name: newTenantName,
      default_room_id: newTenantRoomId ? parseInt(newTenantRoomId, 10) : null,
      default_rent_amount: parseFloat(newTenantRentAmount || '0'),
      sort_order: leaseDetail?.tenants.length || 0,
      is_active_default: true,
      pays_rent_default: true,
      pays_utilities_default: true,
    });
    setNewTenantName('');
    setNewTenantRoomId('');
    setNewTenantRentAmount('');
    await refreshCurrentLease();
  };

  const deleteTenant = async (tenantId: number) => {
    if (!window.confirm('Delete this tenant and all month configurations and payments tied to them?')) return;
    await api.delete(`/rent/tenants/${tenantId}`);
    await refreshCurrentLease();
  };

  const saveMonthSetup = async () => {
    if (!selectedLeaseId) return;
    setSavingMonth(true);
    try {
      const response = await api.put<RentMonthStatement>(`/rent/leases/${selectedLeaseId}/month`, {
        month: monthInputToApi(selectedMonth),
        notes: noteDraft,
        tenant_configs: draftConfigs.map((config) => ({
          tenant_id: config.tenant_id,
          room_id: config.room_id,
          is_active: config.is_active,
          pays_rent: config.pays_rent,
          pays_utilities: config.pays_utilities,
          rent_amount: Number(config.rent_amount || 0),
          other_adjustment: Number(config.other_adjustment || 0),
          other_adjustment_note: config.other_adjustment_note || null,
        })),
        room_usages: draftRoomUsages.map((usage) => ({
          room_id: usage.room_id,
          usage_value: Number(usage.usage_value || 0),
        })),
        room_energy_usages: draftRoomEnergyUsages.map((usage) => ({
          room_id: usage.room_id,
          usage_kwh: Number(usage.usage_kwh || 0),
        })),
      });
      setStatement(response.data);
      setDraftConfigs(response.data.tenant_configs);
      setDraftRoomUsages(response.data.room_usages);
      setDraftRoomEnergyUsages(response.data.room_energy_usages);
      await fetchLeaseDetail(selectedLeaseId);
    } finally {
      setSavingMonth(false);
    }
  };

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeaseId) return;
    await api.post(`/rent/leases/${selectedLeaseId}/payments`, {
      tenant_id: parseInt(paymentTenantId, 10),
      month: monthInputToApi(selectedMonth),
      payment_date: paymentDate,
      amount: parseFloat(paymentAmount),
      notes: paymentNotes,
    });
    setPaymentTenantId('');
    setPaymentAmount('');
    setPaymentNotes('');
    await fetchStatement(selectedLeaseId, selectedMonth);
  };

  const deletePayment = async (paymentId: number) => {
    await api.delete(`/rent/payments/${paymentId}`);
    if (selectedLeaseId) {
      await fetchStatement(selectedLeaseId, selectedMonth);
    }
  };

  const updateDraftConfig = (tenantId: number, key: keyof RentTenantMonthConfig, value: string | number | boolean | null) => {
    setDraftConfigs((current) => current.map((config) => (config.tenant_id === tenantId ? { ...config, [key]: value } : config)));
  };

  const updateRoomUsage = (roomId: number, value: string) => {
    setDraftRoomUsages((current) => current.map((usage) => (usage.room_id === roomId ? { ...usage, usage_value: Number(value || 0) } : usage)));
  };

  const updateRoomEnergyUsage = (roomId: number, value: string) => {
    setDraftRoomEnergyUsages((current) => current.map((usage) => (usage.room_id === roomId ? { ...usage, usage_kwh: Number(value || 0) } : usage)));
  };

  const exportStatementPdf = async () => {
    if (!selectedLeaseId || !leaseDetail) return;
    setExportingStatement(true);
    try {
      const response = await api.get(`/rent/leases/${selectedLeaseId}/statement-export`, {
        params: { month: monthInputToApi(selectedMonth) },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const objectUrl = window.URL.createObjectURL(blob);
      const contentDisposition = response.headers['content-disposition'] as string | undefined;
      const match = contentDisposition?.match(/filename="?([^"]+)"?/i);
      const fallbackName = `utilitymate-rent-${leaseDetail.location.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${selectedMonth}.pdf`;
      const filename = match?.[1] || fallbackName;
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Rent statement export failed', error);
      window.alert('Rent statement export failed. Please try again in a few seconds.');
    } finally {
      setExportingStatement(false);
    }
  };

  if (loading && !leaseDetail && leases.length === 0) {
    return <div className="flex min-h-screen items-center justify-center bg-surface md:ml-64"><Loader2 className="animate-spin text-emerald-500" size={48} /></div>;
  }

  return (
    <div className="min-h-screen bg-surface px-4 pb-6 pt-20 text-on-surface sm:px-6 md:ml-64 md:p-8">
      <header className="mb-8 flex flex-col gap-3">
        <h2 className="font-headline text-3xl font-extrabold">Rent</h2>
        <p className="max-w-4xl text-on-surface-variant opacity-75">Separate monthly rent accounting for shared apartments. Rent stays manual per person, electricity and shared avizier charges can be split automatically, heating can be allocated by room usage, and payments stay tracked per tenant.</p>
      </header>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[360px,minmax(0,1fr)]">
        <aside className="space-y-6">
          <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
            <div className="mb-4 flex items-center gap-3"><Home className="text-emerald-600" /><h3 className="font-headline text-xl font-black">Rent Workspaces</h3></div>
            <form onSubmit={createLease} className="space-y-3">
              <input required value={newLeaseName} onChange={(e) => setNewLeaseName(e.target.value)} placeholder="Workspace name" className="w-full rounded-xl border border-outline-variant bg-surface-container p-3" />
              <select required value={newLeaseLocationId} onChange={(e) => setNewLeaseLocationId(e.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container p-3">
                <option value="">Location</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
              <select value={newLeaseProviderId} onChange={(e) => setNewLeaseProviderId(e.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container p-3">
                <option value="">Electricity provider (optional)</option>
                {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
              </select>
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white"><Plus size={16} /> Create Workspace</button>
            </form>

            <div className="mt-6 space-y-3">
              {leases.length === 0 && <p className="text-sm opacity-60">No rent workspaces yet.</p>}
              {leases.map((lease) => (
                <button key={lease.id} onClick={() => setSelectedLeaseId(lease.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedLeaseId === lease.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'border-outline-variant bg-white/70 dark:bg-slate-900/40'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{lease.name}</p>
                      <p className="text-sm opacity-70">{lease.location.name}</p>
                    </div>
                    <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-black uppercase text-white dark:bg-white dark:text-slate-900">{lease.is_active ? 'Active' : 'Paused'}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="space-y-6">
          {!leaseDetail ? (
            <div className="rounded-3xl border border-outline-variant bg-surface-container-low p-10 text-center opacity-70">Choose a rent workspace to start configuring tenants, rooms, monthly splits, and payments.</div>
          ) : (
            <>
              <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      {editingLeaseName ? (
                        <div className="flex items-center gap-2">
                          <input
                            ref={leaseNameInputRef}
                            value={leaseNameDraft}
                            onChange={(e) => setLeaseNameDraft(e.target.value)}
                            onBlur={() => {
                              if (!savingLeaseName) {
                                void renameLease();
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void renameLease();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelLeaseRename();
                              }
                            }}
                            className="rounded-xl border border-outline-variant bg-surface-container px-4 py-2 text-2xl font-black"
                            aria-label="Rent workspace name"
                          />
                          {savingLeaseName && <Loader2 size={18} className="animate-spin text-emerald-600" />}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="font-headline text-2xl font-black">{leaseDetail.name}</h3>
                          <button
                            onClick={() => setEditingLeaseName(true)}
                            className="rounded-lg border border-outline-variant bg-white/70 p-2 text-slate-700 transition hover:bg-slate-100 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-800/60"
                            aria-label="Rename workspace"
                            title="Rename workspace"
                          >
                            <Pencil size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm opacity-70">{leaseDetail.location.name}{leaseDetail.electricity_provider ? ` • Electricity from ${leaseDetail.electricity_provider.name}` : ' • Electricity from Energy invoices'}</p>
                    {leaseDetail.notes && <p className="mt-2 text-sm opacity-60">{leaseDetail.notes}</p>}
                  </div>
                  <button onClick={() => deleteLease(leaseDetail.id)} className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-black uppercase text-red-600">Delete Workspace</button>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/40"><p className="text-xs font-black uppercase opacity-50">Tenants</p><p className="mt-2 text-2xl font-black">{leaseDetail.tenants.length}</p></div>
                  <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/40"><p className="text-xs font-black uppercase opacity-50">Rooms</p><p className="mt-2 text-2xl font-black">{leaseDetail.rooms.length}</p></div>
                  <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/40"><p className="text-xs font-black uppercase opacity-50">Source Months</p><p className="mt-2 text-2xl font-black">{leaseDetail.available_statement_months.length}</p></div>
                  <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/40"><p className="text-xs font-black uppercase opacity-50">Configured Months</p><p className="mt-2 text-2xl font-black">{leaseDetail.configured_months.length}</p></div>
                </div>
              </section>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
                  <div className="mb-4 flex items-center gap-3"><BedDouble className="text-violet-600" /><h3 className="font-headline text-xl font-black">Rooms</h3></div>
                  <form onSubmit={createRoom} className="mb-4 flex gap-3">
                    <input required value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Room name" className="flex-1 rounded-xl border border-outline-variant bg-surface-container p-3" />
                    <button type="submit" className="rounded-xl bg-violet-600 px-4 py-3 font-bold text-white"><Plus size={16} /></button>
                  </form>
                  <div className="space-y-3">
                    {leaseDetail.rooms.map((room) => (
                      <div key={room.id} className="flex items-center justify-between rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                        <p className="font-black">{room.name}</p>
                        <button onClick={() => deleteRoom(room.id)} className="text-red-600"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
                  <div className="mb-4 flex items-center gap-3"><Users className="text-blue-600" /><h3 className="font-headline text-xl font-black">Tenants</h3></div>
                  <form onSubmit={createTenant} className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input required value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} placeholder="Tenant name" className="rounded-xl border border-outline-variant bg-surface-container p-3" />
                    <select value={newTenantRoomId} onChange={(e) => setNewTenantRoomId(e.target.value)} className="rounded-xl border border-outline-variant bg-surface-container p-3">
                      <option value="">Default room</option>
                      {leaseDetail.rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                    </select>
                    <input type="number" step="0.01" value={newTenantRentAmount} onChange={(e) => setNewTenantRentAmount(e.target.value)} placeholder="Default rent amount" className="rounded-xl border border-outline-variant bg-surface-container p-3" />
                    <button type="submit" className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white md:col-span-3">Add Tenant</button>
                  </form>
                  <div className="space-y-3">
                    {leaseDetail.tenants.map((tenant) => (
                      <div key={tenant.id} className="flex items-start justify-between rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                        <div>
                          <p className="font-black">{tenant.name}</p>
                          <p className="text-sm opacity-60">{tenant.default_room?.name || 'No default room'} • default rent {formatMoney(tenant.default_rent_amount || 0)}</p>
                        </div>
                        <button onClick={() => deleteTenant(tenant.id)} className="text-red-600"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
                <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3"><ReceiptText className="text-emerald-600" /><h3 className="font-headline text-xl font-black">Monthly Statement</h3></div>
                  <div className="flex flex-wrap items-center gap-3">
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="rounded-xl border border-outline-variant bg-surface-container p-3" />
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="rounded-xl border border-outline-variant bg-surface-container p-3">
                      {statementMonthOptions.map((month) => <option key={month} value={month}>{month}</option>)}
                    </select>
                    <button onClick={exportStatementPdf} disabled={!statement || exportingStatement} className="flex items-center gap-2 rounded-xl border border-outline-variant bg-white/70 px-4 py-3 font-bold disabled:opacity-60 dark:bg-slate-900/40">
                      {exportingStatement ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                      Export Tenant PDF
                    </button>
                    <button onClick={saveMonthSetup} disabled={savingMonth} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-60">
                      {savingMonth ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      Save Month Setup
                    </button>
                  </div>
                </div>

                {statement && (
                  <>
                    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
                      <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/40"><p className="text-xs font-black uppercase opacity-50">Rent Total</p><p className="mt-2 text-xl font-black">{formatMoney(statement.totals.rent_total)}</p></div>
                      <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/40"><p className="text-xs font-black uppercase opacity-50">Electricity</p><p className="mt-2 text-xl font-black">{formatMoney(statement.source_summary.electricity_total)}</p></div>
                      <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/40"><p className="text-xs font-black uppercase opacity-50">Avizier</p><p className="mt-2 text-xl font-black">{formatMoney(statement.source_summary.avizier_total)}</p></div>
                      <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/40"><p className="text-xs font-black uppercase opacity-50">Heating</p><p className="mt-2 text-xl font-black">{formatMoney(statement.source_summary.heating_total)}</p></div>
                      <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/40"><p className="text-xs font-black uppercase opacity-50">Amount Due</p><p className="mt-2 text-xl font-black">{formatMoney(statement.totals.amount_due_total)}</p></div>
                    </div>

                    <div className="mb-6 rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                      <p className="text-sm font-bold">Utilities are split across <span className="font-black">{statement.utility_payer_count}</span> utility-paying tenants. Electricity allocation mode: <span className="font-black">{statement.electricity_allocation_mode === 'room_usage_remainder_split' ? 'Room kWh plus equal remainder' : 'Equal fallback'}</span>. Heating allocation mode: <span className="font-black">{statement.heating_allocation_mode === 'room_usage' ? 'Room usage' : 'Equal fallback'}</span>.</p>
                    </div>

                    <div className="mb-6 overflow-x-auto rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                      <h4 className="mb-4 font-headline text-lg font-black">Tenant Month Setup</h4>
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase opacity-60">
                            <th className="px-3 py-2">Tenant</th>
                            <th className="px-3 py-2">Room</th>
                            <th className="px-3 py-2">Active</th>
                            <th className="px-3 py-2">Pays Rent</th>
                            <th className="px-3 py-2">Pays Utilities</th>
                            <th className="px-3 py-2">Rent</th>
                          </tr>
                        </thead>
                        <tbody>
                          {draftConfigs.map((config) => (
                            <tr key={config.tenant_id} className="border-t border-outline-variant/50">
                              <td className="px-3 py-2 font-bold">{config.tenant_name}</td>
                              <td className="px-3 py-2">
                                <select value={config.room_id ?? ''} onChange={(e) => updateDraftConfig(config.tenant_id, 'room_id', e.target.value ? Number(e.target.value) : null)} className="rounded-lg border border-outline-variant bg-surface-container px-2 py-2">
                                  <option value="">No room</option>
                                  {leaseDetail.rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-2"><input type="checkbox" checked={config.is_active} onChange={(e) => updateDraftConfig(config.tenant_id, 'is_active', e.target.checked)} /></td>
                              <td className="px-3 py-2"><input type="checkbox" checked={config.pays_rent} onChange={(e) => updateDraftConfig(config.tenant_id, 'pays_rent', e.target.checked)} /></td>
                              <td className="px-3 py-2"><input type="checkbox" checked={config.pays_utilities} onChange={(e) => updateDraftConfig(config.tenant_id, 'pays_utilities', e.target.checked)} /></td>
                              <td className="px-3 py-2"><input type="number" step="0.01" value={config.rent_amount} onChange={(e) => updateDraftConfig(config.tenant_id, 'rent_amount', Number(e.target.value || 0))} className="w-28 rounded-lg border border-outline-variant bg-surface-container px-2 py-2" /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                      <div className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                        <h4 className="mb-4 font-headline text-lg font-black">Room Energy Usage</h4>
                        <p className="mb-4 text-sm opacity-65">Enter room kWh for the Hidroelectrica invoice only. Any invoice kWh left over after the room entries, plus usage entered for an unassigned room, is split equally across all utility-paying tenants.</p>
                        <div className="space-y-3">
                          {draftRoomEnergyUsages.map((usage) => (
                            <label key={usage.room_id} className="flex items-center justify-between gap-4">
                              <span className="font-bold">{usage.room_name}</span>
                              <input type="number" step="0.01" value={usage.usage_kwh} onChange={(e) => updateRoomEnergyUsage(usage.room_id, e.target.value)} className="w-32 rounded-lg border border-outline-variant bg-surface-container px-3 py-2" />
                            </label>
                          ))}
                          {draftRoomEnergyUsages.length === 0 && <p className="text-sm opacity-60">Add rooms first if you want room-based electricity allocation.</p>}
                          <div className="flex items-center justify-between border-t border-outline-variant/60 pt-3 text-sm">
                            <span>Invoice electricity usage</span>
                            <span className="font-bold">{statement.source_summary.electricity_consumption_total.toFixed(2)} kWh</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Room-entered usage</span>
                            <span className="font-bold">{draftRoomEnergyUsages.reduce((sum, usage) => sum + usage.usage_kwh, 0).toFixed(2)} kWh</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Equal-share remainder</span>
                            <span className="font-bold">{Math.max(statement.source_summary.electricity_consumption_total - draftRoomEnergyUsages.reduce((sum, usage) => sum + usage.usage_kwh, 0), 0).toFixed(2)} kWh</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                        <h4 className="mb-4 font-headline text-lg font-black">Room Heating Usage</h4>
                        <p className="mb-4 text-sm opacity-65">Heating usage follows the room entries. If a room has no assigned tenant for that month, that room's heating usage is split equally across all utility-paying tenants.</p>
                        <div className="space-y-3">
                          {draftRoomUsages.map((usage) => (
                            <label key={usage.room_id} className="flex items-center justify-between gap-4">
                              <span className="font-bold">{usage.room_name}</span>
                              <input type="number" step="0.01" value={usage.usage_value} onChange={(e) => updateRoomUsage(usage.room_id, e.target.value)} className="w-32 rounded-lg border border-outline-variant bg-surface-container px-3 py-2" />
                            </label>
                          ))}
                          {draftRoomUsages.length === 0 && <p className="text-sm opacity-60">Add rooms first if you want room-based heating allocation.</p>}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                        <h4 className="mb-4 font-headline text-lg font-black">Other Adjustments</h4>
                        <p className="mb-4 text-sm opacity-65">Positive values add to that tenant’s total, negative values reduce it. Notes will also be included in the PDF export.</p>
                        <div className="space-y-3">
                          {draftConfigs.map((config) => (
                            <div key={config.tenant_id} className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
                              <div className="space-y-2">
                                <span className="font-bold">{config.tenant_name}</span>
                                <input
                                  type="text"
                                  value={config.other_adjustment_note || ''}
                                  onChange={(e) => updateDraftConfig(config.tenant_id, 'other_adjustment_note', e.target.value)}
                                  placeholder="Optional adjustment note"
                                  className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2"
                                />
                              </div>
                              <label className="space-y-2">
                                <span className="block text-sm font-bold opacity-70">Amount</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={config.other_adjustment}
                                  onChange={(e) => updateDraftConfig(config.tenant_id, 'other_adjustment', Number(e.target.value || 0))}
                                  className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2"
                                />
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40 xl:col-span-2">
                        <h4 className="mb-4 font-headline text-lg font-black">Month Notes</h4>
                        <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Optional notes for move-ins, credits, unusual bills, or custom split decisions." className="h-40 w-full rounded-xl border border-outline-variant bg-surface-container p-3" />
                      </div>
                    </div>

                    <div className="mb-6 overflow-x-auto rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                      <h4 className="mb-4 font-headline text-lg font-black">Tenant Statement</h4>
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase opacity-60">
                            <th className="px-3 py-2">Tenant</th>
                            <th className="px-3 py-2">Room</th>
                            <th className="px-3 py-2">Rent</th>
                            <th className="px-3 py-2">Electricity</th>
                            <th className="px-3 py-2">Shared Utilities</th>
                            <th className="px-3 py-2">Heating</th>
                            <th className="px-3 py-2">Other</th>
                            <th className="px-3 py-2">Previous</th>
                            <th className="px-3 py-2">Payments</th>
                            <th className="px-3 py-2">Due</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statement.tenant_statements.map((row) => (
                            <tr key={row.tenant_id} className="border-t border-outline-variant/50">
                              <td className="px-3 py-2 font-bold">{row.tenant_name}</td>
                              <td className="px-3 py-2">{row.room_name || 'Unassigned'}</td>
                              <td className="px-3 py-2">{formatMoney(row.rent_amount)}</td>
                              <td className="px-3 py-2">{formatMoney(row.electricity_amount)}</td>
                              <td className="px-3 py-2">{formatMoney(row.shared_utilities_amount)}</td>
                              <td className="px-3 py-2">{formatMoney(row.heating_amount)}</td>
                              <td className="px-3 py-2">
                                <div>{formatMoney(row.other_adjustment)}</div>
                                {row.other_adjustment_note && <div className="mt-1 text-xs opacity-65">{row.other_adjustment_note}</div>}
                              </td>
                              <td className="px-3 py-2">{formatMoney(row.previous_balance)}</td>
                              <td className="px-3 py-2">{formatMoney(row.payments_in_month)}</td>
                              <td className="px-3 py-2 font-black">{formatMoney(row.amount_due)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                      <section className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                        <div className="mb-4 flex items-center gap-3"><CreditCard className="text-amber-600" /><h4 className="font-headline text-lg font-black">Payments</h4></div>
                        <form onSubmit={addPayment} className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                          <select required value={paymentTenantId} onChange={(e) => setPaymentTenantId(e.target.value)} className="rounded-xl border border-outline-variant bg-surface-container p-3">
                            <option value="">Tenant</option>
                            {leaseDetail.tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
                          </select>
                          <input required type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="rounded-xl border border-outline-variant bg-surface-container p-3" />
                          <input required type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Amount" className="rounded-xl border border-outline-variant bg-surface-container p-3" />
                          <input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Notes" className="rounded-xl border border-outline-variant bg-surface-container p-3" />
                          <button type="submit" className="rounded-xl bg-amber-600 px-4 py-3 font-bold text-white md:col-span-2">Add Payment</button>
                        </form>
                        <div className="space-y-3">
                          {statement.payments.length === 0 && <p className="text-sm opacity-60">No payments logged for this month.</p>}
                          {statement.payments.map((payment) => (
                            <div key={payment.id} className="flex items-center justify-between rounded-xl border border-outline-variant px-4 py-3">
                              <div>
                                <p className="font-bold">{payment.tenant?.name || 'Tenant'} • {formatMoney(payment.amount)}</p>
                                <p className="text-xs opacity-60">{payment.payment_date}{payment.notes ? ` • ${payment.notes}` : ''}</p>
                              </div>
                              <button onClick={() => deletePayment(payment.id)} className="text-red-600"><Trash2 size={16} /></button>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                        <h4 className="mb-4 font-headline text-lg font-black">Current Month Sources</h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex items-center justify-between"><span>Electricity invoice total</span><span className="font-bold">{formatMoney(statement.source_summary.electricity_total)}</span></div>
                          <div className="flex items-center justify-between"><span>Electricity invoice usage</span><span className="font-bold">{statement.source_summary.electricity_consumption_total.toFixed(2)} kWh</span></div>
                          <div className="flex items-center justify-between"><span>Avizier total</span><span className="font-bold">{formatMoney(statement.source_summary.avizier_total)}</span></div>
                          <div className="flex items-center justify-between"><span>Heating inside avizier</span><span className="font-bold">{formatMoney(statement.source_summary.heating_total)}</span></div>
                          <div className="flex items-center justify-between"><span>Shared non-heating utilities</span><span className="font-bold">{formatMoney(statement.source_summary.non_heating_utilities_total)}</span></div>
                          <div className="flex items-center justify-between border-t border-outline-variant pt-3"><span>Payments logged this month</span><span className="font-bold">{formatMoney(statement.totals.payments_total)}</span></div>
                        </div>
                      </section>
                    </div>
                  </>
                )}
              </section>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default Rent;
