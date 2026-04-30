import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronRight, Gauge, Loader2, Pencil, Plus, Receipt, Save, Trash2, X } from 'lucide-react';
import axios from 'axios';
import api from '../utils/api';

interface Category {
  id: number;
  name: string;
  unit: string;
}

interface Location {
  id: number;
  name: string;
}

interface Provider {
  id: number;
  name: string;
  category: Category;
}

interface LinkedInvoice {
  id: number;
  invoice_date: string;
  amount: number;
  consumption_value?: number | null;
  status: string;
  provider?: Provider | null;
}

interface ReadingRow {
  id: number;
  location_id: number;
  category_id: number;
  meter_label: string;
  value: number;
  reading_date: string;
  source_type: string;
  notes?: string | null;
  created_at: string;
  location?: Location | null;
  category?: Category | null;
  previous_value?: number | null;
  delta_value?: number | null;
  linked_invoice?: LinkedInvoice | null;
}

interface ReadingListResponse {
  items: ReadingRow[];
  total: number;
  skip: number;
  limit: number;
}

interface StreamSummary {
  location_id: number;
  category_id: number;
  meter_label: string;
  location?: Location | null;
  category?: Category | null;
  reading_count: number;
  latest_reading_date?: string | null;
  latest_value?: number | null;
  latest_delta?: number | null;
  linked_invoice?: LinkedInvoice | null;
}

interface StreamListResponse {
  items: StreamSummary[];
}

const streamKey = (locationId: number, categoryId: number, meterLabel: string) => `${locationId}:${categoryId}:${meterLabel}`;

const formatNumber = (value?: number | null) => (typeof value === 'number' ? value.toFixed(2) : '—');
const formatStreamLabel = (stream: StreamSummary) => `${stream.location?.name || 'Location'} • ${stream.category?.name || 'Category'} • ${stream.meter_label || 'Default stream'}`;

const MeterReadings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [streams, setStreams] = useState<StreamSummary[]>([]);
  const [readings, setReadings] = useState<ReadingRow[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pageError, setPageError] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedStreamKey, setSelectedStreamKey] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formMeterLabel, setFormMeterLabel] = useState('');
  const [formReadingDate, setFormReadingDate] = useState(new Date().toISOString().split('T')[0]);
  const [formValue, setFormValue] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editReadingDate, setEditReadingDate] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editMeterLabel, setEditMeterLabel] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const fetchBaseData = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const [streamResponse, locationResponse, categoryResponse] = await Promise.all([
        api.get<StreamListResponse>('/consumption/streams', {
          params: {
            location_id: locationFilter || undefined,
            category_id: categoryFilter || undefined,
          },
        }),
        api.get<Location[]>('/locations/'),
        api.get<Category[]>('/categories/'),
      ]);

      setStreams(streamResponse.data.items);
      setLocations(locationResponse.data);
      setCategories(categoryResponse.data);

      setSelectedStreamKey((current) => {
        if (streamResponse.data.items.length === 0) return '';
        if (streamResponse.data.items.some((stream) => streamKey(stream.location_id, stream.category_id, stream.meter_label) === current)) {
          return current;
        }
        const first = streamResponse.data.items[0];
        return streamKey(first.location_id, first.category_id, first.meter_label);
      });
    } catch {
      setPageError('Meter streams could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, locationFilter]);

  const fetchReadings = useCallback(async () => {
    if (!selectedStreamKey) {
      setReadings([]);
      return;
    }

    const selectedStream = streams.find((stream) => streamKey(stream.location_id, stream.category_id, stream.meter_label) === selectedStreamKey);
    if (!selectedStream) {
      setReadings([]);
      return;
    }

    try {
      const response = await api.get<ReadingListResponse>('/consumption/', {
        params: {
          location_id: selectedStream.location_id,
          category_id: selectedStream.category_id,
          meter_label: selectedStream.meter_label,
          limit: 500,
        },
      });
      setReadings(response.data.items);
    } catch {
      setPageError('Meter reading history could not be loaded.');
    }
  }, [selectedStreamKey, streams]);

  useEffect(() => {
    fetchBaseData();
  }, [fetchBaseData]);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  const selectedStream = streams.find((stream) => streamKey(stream.location_id, stream.category_id, stream.meter_label) === selectedStreamKey) || null;
  const selectedCategory = categories.find((category) => category.id === Number(formCategory));

  const syncFormToStream = (stream: StreamSummary) => {
    setFormLocation(String(stream.location_id));
    setFormCategory(String(stream.category_id));
    setFormMeterLabel(stream.meter_label);
  };

  const handleSelectStream = (stream: StreamSummary) => {
    const key = streamKey(stream.location_id, stream.category_id, stream.meter_label);
    setSelectedStreamKey(key);
    syncFormToStream(stream);
    setEditId(null);
  };

  const resetForm = () => {
    setFormReadingDate(new Date().toISOString().split('T')[0]);
    setFormValue('');
    setFormNotes('');
  };

  const createReading = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setPageError('');
    const nextStreamKey = streamKey(Number(formLocation), Number(formCategory), formMeterLabel.trim());
    try {
      await api.post('/consumption/', {
        location_id: Number(formLocation),
        category_id: Number(formCategory),
        meter_label: formMeterLabel.trim(),
        value: Number(formValue),
        reading_date: formReadingDate,
        source_type: 'manual',
        notes: formNotes.trim() || null,
      });
      setSelectedStreamKey(nextStreamKey);
      resetForm();
      await fetchBaseData();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setPageError(error?.response?.data?.detail || 'Meter reading could not be saved.');
      } else {
        setPageError('An unexpected error occurred.');
      }
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (reading: ReadingRow) => {
    setEditId(reading.id);
    setEditReadingDate(reading.reading_date);
    setEditValue(String(reading.value));
    setEditMeterLabel(reading.meter_label);
    setEditNotes(reading.notes || '');
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditReadingDate('');
    setEditValue('');
    setEditMeterLabel('');
    setEditNotes('');
  };

  const saveEdit = async (readingId: number) => {
    setSaving(true);
    setPageError('');
    try {
      const reading = readings.find((item) => item.id === readingId);
      await api.patch(`/consumption/${readingId}`, {
        reading_date: editReadingDate,
        value: Number(editValue),
        meter_label: editMeterLabel.trim(),
        notes: editNotes.trim() || null,
      });
      if (reading) {
        setSelectedStreamKey(streamKey(reading.location_id, reading.category_id, editMeterLabel.trim()));
      }
      cancelEdit();
      await fetchBaseData();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setPageError(error?.response?.data?.detail || 'Meter reading could not be updated.');
      } else {
        setPageError('An unexpected error occurred.');
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteReading = async (readingId: number) => {
    if (!window.confirm('Delete this meter reading? Later deltas for this stream will update automatically.')) return;
    setSaving(true);
    setPageError('');
    try {
      await api.delete(`/consumption/${readingId}`);
      if (editId === readingId) cancelEdit();
      await fetchBaseData();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setPageError(error?.response?.data?.detail || 'Meter reading could not be deleted.');
      } else {
        setPageError('An unexpected error occurred.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-surface md:ml-64"><Loader2 className="animate-spin text-emerald-500" size={48} /></div>;
  }

  return (
    <div className="min-h-screen bg-surface px-4 pb-6 pt-20 text-on-surface sm:px-6 md:ml-64 md:p-8">
      <header className="mb-10">
        <div className="flex items-center gap-3">
          <Gauge className="text-emerald-600" />
          <div>
            <h2 className="font-headline text-3xl font-extrabold">Meter Readings</h2>
            <p className="text-on-surface-variant opacity-70">Track device-specific reading history, inspect deltas against previous readings, edit older entries safely, and compare them with the invoices already stored in UtilityMate.</p>
          </div>
        </div>
      </header>

      {pageError && (
        <div className="mb-6 rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-700/40 dark:bg-red-950/30 dark:text-red-100">
          {pageError}
        </div>
      )}

      <section className="mb-8 grid grid-cols-1 gap-4 rounded-3xl border border-outline-variant bg-surface-container-low p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-6">
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="rounded-xl border border-outline-variant bg-surface-container p-3">
          <option value="">All locations</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-xl border border-outline-variant bg-surface-container p-3">
          <option value="">All categories</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select value={selectedStreamKey} onChange={(e) => setSelectedStreamKey(e.target.value)} className="rounded-xl border border-outline-variant bg-surface-container p-3">
          <option value="">All meter streams</option>
          {streams.map((stream) => {
            const key = streamKey(stream.location_id, stream.category_id, stream.meter_label);
            return <option key={key} value={key}>{formatStreamLabel(stream)}</option>;
          })}
        </select>
        <div className="rounded-xl border border-outline-variant bg-surface-container px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Streams</p>
          <p className="mt-1 text-2xl font-black">{streams.length}</p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Readings in View</p>
          <p className="mt-1 text-2xl font-black">{readings.length}</p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Selected Unit</p>
          <p className="mt-1 text-2xl font-black">{selectedStream?.category?.unit || selectedCategory?.unit || '—'}</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
            <div className="mb-4 flex items-center gap-2">
              <Plus size={18} className="text-emerald-600" />
              <h3 className="font-headline text-xl font-black">Add Reading</h3>
            </div>
            <form onSubmit={createReading} className="space-y-3">
              <select required value={formLocation} onChange={(e) => setFormLocation(e.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container p-3">
                <option value="">Location</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
              <select required value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container p-3">
                <option value="">Category</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <input value={formMeterLabel} onChange={(e) => setFormMeterLabel(e.target.value)} placeholder="Meter label, for example Kitchen Hot Water" className="w-full rounded-xl border border-outline-variant bg-surface-container p-3" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input required type="date" value={formReadingDate} onChange={(e) => setFormReadingDate(e.target.value)} className="rounded-xl border border-outline-variant bg-surface-container p-3" />
                <input required type="number" step="0.01" value={formValue} onChange={(e) => setFormValue(e.target.value)} placeholder="Reading value" className="rounded-xl border border-outline-variant bg-surface-container p-3" />
              </div>
              <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Notes (optional)" rows={3} className="w-full rounded-xl border border-outline-variant bg-surface-container p-3" />
              <button disabled={saving} type="submit" className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Reading'}
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-headline text-xl font-black">Meter Streams</h3>
              <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-black uppercase">{streams.length}</span>
            </div>
            <div className="space-y-3">
              {streams.length === 0 && <p className="text-sm opacity-60">No readings yet. Start by adding the first reading for a stream.</p>}
              {streams.map((stream) => {
                const key = streamKey(stream.location_id, stream.category_id, stream.meter_label);
                const isActive = key === selectedStreamKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectStream(stream)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${isActive ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' : 'border-outline-variant bg-white/70 dark:bg-slate-900/40'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black">{stream.location?.name || 'Location'} • {stream.category?.name || 'Category'}</p>
                        <p className="text-sm opacity-70">{stream.meter_label || 'Default stream'}</p>
                        <p className="mt-2 text-xs font-bold uppercase opacity-50">{stream.reading_count} readings</p>
                      </div>
                      <ChevronRight size={18} className={isActive ? 'text-emerald-600' : 'opacity-40'} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-surface-container px-3 py-2">
                        <p className="font-black uppercase opacity-50">Latest</p>
                        <p className="mt-1 font-bold">{formatNumber(stream.latest_value)} {stream.category?.unit || ''}</p>
                      </div>
                      <div className="rounded-xl bg-surface-container px-3 py-2">
                        <p className="font-black uppercase opacity-50">Delta</p>
                        <p className="mt-1 font-bold">{formatNumber(stream.latest_delta)} {stream.category?.unit || ''}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
          {selectedStream ? (
            <>
              <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Selected Stream</p>
                  <h3 className="mt-2 font-headline text-2xl font-black">{selectedStream.location?.name} • {selectedStream.category?.name}</h3>
                  <p className="text-on-surface-variant opacity-70">{selectedStream.meter_label || 'Default stream'} • {selectedStream.category?.unit || 'unit'} • {selectedStream.reading_count} readings</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-outline-variant bg-surface-container px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Latest Reading</p>
                    <p className="mt-1 text-xl font-black">{formatNumber(selectedStream.latest_value)} {selectedStream.category?.unit || ''}</p>
                  </div>
                  <div className="rounded-2xl border border-outline-variant bg-surface-container px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Difference</p>
                    <p className="mt-1 text-xl font-black">{formatNumber(selectedStream.latest_delta)} {selectedStream.category?.unit || ''}</p>
                  </div>
                  <div className="rounded-2xl border border-outline-variant bg-surface-container px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Latest Invoice</p>
                    <p className="mt-1 text-sm font-black">{selectedStream.linked_invoice ? `${selectedStream.linked_invoice.amount.toFixed(2)} RON` : 'No match'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 lg:hidden">
                {readings.map((reading) => {
                  const isEditing = editId === reading.id;

                  return (
                    <article key={reading.id} className="rounded-2xl border border-outline-variant bg-white/70 p-4 shadow-sm dark:bg-slate-900/40">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-50">{reading.reading_date}</p>
                          <p className="mt-2 text-lg font-black">{reading.meter_label || 'Default stream'}</p>
                          <p className="text-sm opacity-70">{reading.location?.name || 'Location'} • {reading.category?.name || 'Category'}</p>
                        </div>
                        <div className="rounded-xl bg-surface-container px-3 py-2 text-right">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-50">Reading</p>
                          <p className="mt-1 font-black">{reading.value.toFixed(2)} {reading.category?.unit || ''}</p>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="mt-4 space-y-3">
                          <input type="date" value={editReadingDate} onChange={(e) => setEditReadingDate(e.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container p-3" />
                          <input value={editMeterLabel} onChange={(e) => setEditMeterLabel(e.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container p-3" />
                          <input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container p-3" />
                          <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} className="w-full rounded-xl border border-outline-variant bg-surface-container p-3" />
                        </div>
                      ) : (
                        <>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-xl bg-surface-container px-3 py-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-50">Previous</p>
                              <p className="mt-1 font-bold">{formatNumber(reading.previous_value)} {reading.category?.unit || ''}</p>
                            </div>
                            <div className="rounded-xl bg-surface-container px-3 py-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-50">Difference</p>
                              <p className="mt-1 font-bold">{formatNumber(reading.delta_value)} {reading.category?.unit || ''}</p>
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl bg-surface-container px-3 py-3 text-sm">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-50">Notes</p>
                            <p className="mt-1 opacity-70">{reading.notes || '—'}</p>
                          </div>

                          <div className="mt-4 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-3 text-sm">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-50">Linked Invoice</p>
                            {reading.linked_invoice ? (
                              <>
                                <p className="mt-1 font-bold">{reading.linked_invoice.provider?.name || 'Invoice'} • {reading.linked_invoice.invoice_date}</p>
                                <p className="mt-1 opacity-70">
                                  {reading.linked_invoice.amount.toFixed(2)} RON
                                  {typeof reading.linked_invoice.consumption_value === 'number'
                                    ? ` • ${reading.linked_invoice.consumption_value.toFixed(2)} ${reading.category?.unit || ''}`
                                    : ''}
                                </p>
                              </>
                            ) : (
                              <p className="mt-1 opacity-50">No matching invoice</p>
                            )}
                          </div>
                        </>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(reading.id)} disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase text-white disabled:opacity-60">
                              Save
                            </button>
                            <button onClick={cancelEdit} className="rounded-xl border border-outline-variant px-4 py-2 text-xs font-black uppercase">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(reading)} className="rounded-xl border border-outline-variant px-4 py-2 text-xs font-black uppercase">
                              Edit
                            </button>
                            <button onClick={() => deleteReading(reading.id)} className="rounded-xl border border-red-200 px-4 py-2 text-xs font-black uppercase text-red-600">
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1100px] text-left">
                  <thead>
                    <tr className="border-b border-outline-variant text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Meter Label</th>
                      <th className="px-4 py-3 text-right">Reading</th>
                      <th className="px-4 py-3 text-right">Previous</th>
                      <th className="px-4 py-3 text-right">Difference</th>
                      <th className="px-4 py-3">Linked Invoice</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40">
                    {readings.map((reading) => {
                      const isEditing = editId === reading.id;
                      return (
                        <tr key={reading.id}>
                          <td className="px-4 py-4">
                            {isEditing ? (
                              <input type="date" value={editReadingDate} onChange={(e) => setEditReadingDate(e.target.value)} className="rounded-xl border border-outline-variant bg-surface-container p-2" />
                            ) : (
                              <div className="flex items-center gap-2">
                                <CalendarDays size={14} className="opacity-50" />
                                <span>{reading.reading_date}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {isEditing ? (
                              <input value={editMeterLabel} onChange={(e) => setEditMeterLabel(e.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container p-2" />
                            ) : (
                              <span className="font-semibold">{reading.meter_label || 'Default stream'}</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {isEditing ? (
                              <input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-28 rounded-xl border border-outline-variant bg-surface-container p-2 text-right" />
                            ) : (
                              <span className="font-black">{reading.value.toFixed(2)} {reading.category?.unit || ''}</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right">{formatNumber(reading.previous_value)} {reading.category?.unit || ''}</td>
                          <td className="px-4 py-4 text-right font-bold">{formatNumber(reading.delta_value)} {reading.category?.unit || ''}</td>
                          <td className="px-4 py-4">
                            {reading.linked_invoice ? (
                              <div className="rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-xs">
                                <div className="flex items-center gap-2 font-black"><Receipt size={14} /> {reading.linked_invoice.provider?.name || 'Invoice'} • {reading.linked_invoice.invoice_date}</div>
                                <p className="mt-1">{reading.linked_invoice.amount.toFixed(2)} RON{typeof reading.linked_invoice.consumption_value === 'number' ? ` • ${reading.linked_invoice.consumption_value.toFixed(2)} ${reading.category?.unit || ''}` : ''}</p>
                              </div>
                            ) : (
                              <span className="text-sm opacity-50">No matching invoice</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {isEditing ? (
                              <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className="w-full rounded-xl border border-outline-variant bg-surface-container p-2" />
                            ) : (
                              <span className="text-sm opacity-70">{reading.notes || '—'}</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <button onClick={() => saveEdit(reading.id)} disabled={saving} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black uppercase text-white disabled:opacity-60">
                                    <Save size={14} />
                                  </button>
                                  <button onClick={cancelEdit} className="rounded-xl border border-outline-variant px-3 py-2 text-xs font-black uppercase">
                                    <X size={14} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => startEdit(reading)} className="rounded-xl border border-outline-variant px-3 py-2 text-xs font-black uppercase">
                                    <Pencil size={14} />
                                  </button>
                                  <button onClick={() => deleteReading(reading.id)} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-black uppercase text-red-600">
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-outline-variant bg-surface-container">
              <div className="text-center">
                <Gauge size={48} className="mx-auto mb-4 opacity-40" />
                <p className="font-headline text-xl font-black">No meter stream selected</p>
                <p className="mt-2 max-w-md text-sm opacity-70">Choose an existing stream from the left or create the first reading for a new device. Once a stream exists, you’ll be able to inspect history, compare the delta against the previous reading, and edit any row later on.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default MeterReadings;
