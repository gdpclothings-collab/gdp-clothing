import React, { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  ArrowRightLeft,
  History,
  Plus,
  RefreshCw,
  CheckCircle2,
  X,
  Search,
  Boxes,
  Truck,
  PackageCheck,
  AlertTriangle,
} from "lucide-react";
import { adminInventoryOperationsApi } from "@/lib/adminInventoryOperationsApi";

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function prettify(value) {
  return String(value || "—").replaceAll("_", " ");
}

export default function InventoryOperationsModule() {
  const [tab, setTab] = useState("locations");
  const [locations, setLocations] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [variants, setVariants] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [levels, setLevels] = useState([]);
  const [createLocationOpen, setCreateLocationOpen] = useState(false);
  const [createTransferOpen, setCreateTransferOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [locationRows, transferRows, adjustmentRows, variantRows] = await Promise.all([
        adminInventoryOperationsApi.locations(),
        adminInventoryOperationsApi.transfers(),
        adminInventoryOperationsApi.adjustments(),
        adminInventoryOperationsApi.variants(),
      ]);

      setLocations(locationRows);
      setTransfers(transferRows);
      setAdjustments(adjustmentRows);
      setVariants(variantRows);

      const nextLocation =
        selectedLocationId ||
        locationRows.find((location) => location.is_default)?.id ||
        locationRows[0]?.id ||
        "";

      setSelectedLocationId(nextLocation);
      if (nextLocation) {
        setLevels(await adminInventoryOperationsApi.locationLevels(nextLocation));
      } else {
        setLevels([]);
      }

      if (selectedTransfer) {
        const refreshed = transferRows.find((row) => row.id === selectedTransfer.id);
        if (refreshed) setSelectedTransfer(refreshed);
      }
    } catch (err) {
      console.error("Inventory operations load failed:", err);
      setError(err?.message || "Could not load inventory operations.");
    } finally {
      setLoading(false);
    }
  };

  const loadLevels = async (locationId) => {
    setSelectedLocationId(locationId);
    if (!locationId) {
      setLevels([]);
      return;
    }
    try {
      setLevels(await adminInventoryOperationsApi.locationLevels(locationId));
    } catch (err) {
      console.error("Location levels load failed:", err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const activeTransfers = transfers.filter((row) =>
    ["draft", "ready", "in_transit"].includes(row.status)
  ).length;

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      {notice && (
        <div className="fixed z-[80] right-4 top-20 rounded-lg bg-[#202020] text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <Metric label="Locations" value={locations.length} icon={MapPin} />
        <Metric label="Active transfers" value={activeTransfers} icon={ArrowRightLeft} />
        <Metric label="Tracked variants" value={variants.length} icon={Boxes} />
        <Metric label="Adjustment records" value={adjustments.length} icon={History} />
      </div>

      <div className="mb-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[#d5d5d5] bg-white p-1 w-fit">
          {[
            ["locations", "Locations", MapPin],
            ["transfers", "Transfers", ArrowRightLeft],
            ["history", "Adjustment history", History],
          ].map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-2 ${
                tab === id ? "bg-[#222] text-white" : "hover:bg-[#f5f5f5]"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <button
          onClick={load}
          className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center justify-center gap-2 w-fit"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {tab === "locations" && (
        <LocationsTab
          locations={locations}
          levels={levels}
          variants={variants}
          selectedLocationId={selectedLocationId}
          onSelectLocation={loadLevels}
          onCreate={() => setCreateLocationOpen(true)}
          onChanged={async (message) => {
            showNotice(message);
            await load();
          }}
          loading={loading}
        />
      )}

      {tab === "transfers" && (
        <TransfersTab
          transfers={transfers}
          loading={loading}
          onCreate={() => setCreateTransferOpen(true)}
          onOpen={setSelectedTransfer}
        />
      )}

      {tab === "history" && (
        <HistoryTab adjustments={adjustments} loading={loading} />
      )}

      {createLocationOpen && (
        <LocationModal
          onClose={() => setCreateLocationOpen(false)}
          onSaved={async () => {
            setCreateLocationOpen(false);
            showNotice("Inventory location created.");
            await load();
          }}
        />
      )}

      {createTransferOpen && (
        <TransferModal
          locations={locations}
          variants={variants}
          onClose={() => setCreateTransferOpen(false)}
          onSaved={async () => {
            setCreateTransferOpen(false);
            showNotice("Inventory transfer created.");
            await load();
          }}
        />
      )}

      {selectedTransfer && (
        <TransferDrawer
          transfer={selectedTransfer}
          onClose={() => setSelectedTransfer(null)}
          onChanged={async (message) => {
            showNotice(message);
            await load();
          }}
        />
      )}
    </div>
  );
}

function LocationsTab({
  locations,
  levels,
  variants,
  selectedLocationId,
  onSelectLocation,
  onCreate,
  onChanged,
  loading,
}) {
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    setDrafts({});
  }, [selectedLocationId, levels]);

  const selected = locations.find((location) => location.id === selectedLocationId);
  const levelMap = useMemo(
    () => new Map(levels.map((level) => [level.variant_id, level])),
    [levels]
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return variants.filter((variant) => {
      if (!term) return true;
      return [
        variant.products?.name,
        variant.name,
        variant.sku,
        variant.color,
        variant.size,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [variants, search]);

  const save = async (variant) => {
    const current = levelMap.get(variant.id)?.available || 0;
    const next = drafts[variant.id] ?? current;
    if (Number(next) === Number(current)) return;

    try {
      await adminInventoryOperationsApi.adjustStock({
        variantId: variant.id,
        locationId: selectedLocationId,
        newAvailable: next,
        reason: "manual",
        note: "Manual location adjustment",
      });
      await onChanged(`${variant.products?.name || "Variant"} inventory updated.`);
    } catch (err) {
      console.error("Location stock save failed:", err);
      window.alert(err?.message || "Could not update inventory.");
    }
  };

  return (
    <div className="grid xl:grid-cols-[300px_1fr] gap-5">
      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden h-fit">
        <div className="p-3 border-b border-[#e8e8e8] flex items-center justify-between">
          <div className="text-sm font-semibold">Locations</div>
          <button onClick={onCreate} className="w-8 h-8 rounded-lg border border-[#d5d5d5] grid place-items-center">
            <Plus size={14} />
          </button>
        </div>
        <div className="divide-y divide-[#eeeeee]">
          {locations.map((location) => (
            <button
              key={location.id}
              onClick={() => onSelectLocation(location.id)}
              className={`w-full px-4 py-3 text-left hover:bg-[#fafafa] ${
                selectedLocationId === location.id ? "bg-[#f7f7f7]" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-[#777]" />
                <span className="text-sm font-semibold">{location.name}</span>
                {location.is_default && (
                  <span className="ml-auto rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[9px] font-semibold">
                    DEFAULT
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#777] mt-1">{location.code}</div>
            </button>
          ))}
          {!locations.length && (
            <div className="p-4 text-sm text-[#777]">No inventory locations.</div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="p-3 border-b border-[#e8e8e8] flex flex-col md:flex-row md:items-center gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{selected?.name || "Select a location"}</div>
            <div className="text-xs text-[#777] mt-0.5">
              {selected ? `${selected.code} · ${selected.fulfills_online ? "Fulfills online orders" : "Not used for online fulfillment"}` : ""}
            </div>
          </div>
          <div className="relative md:ml-auto w-full md:max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product or SKU"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#d5d5d5] text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="bg-[#fafafa] text-[#707070] text-xs">
              <tr>
                <Th>Product / variant</Th>
                <Th>SKU</Th>
                <Th right>Available</Th>
                <Th right>Committed</Th>
                <Th right>Incoming</Th>
                <Th right>Adjust</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="py-12 text-center text-[#777]">Loading inventory…</td></tr>
              ) : !selected ? (
                <tr><td colSpan="6" className="py-12 text-center text-[#777]">Choose a location.</td></tr>
              ) : rows.length ? (
                rows.map((variant) => {
                  const level = levelMap.get(variant.id);
                  const current = Number(level?.available || 0);
                  const draft = drafts[variant.id] ?? current;
                  return (
                    <tr key={variant.id} className="border-t border-[#eeeeee]">
                      <Td>
                        <div className="font-semibold">{variant.products?.name || "Product"}</div>
                        <div className="text-[11px] text-[#777]">{[variant.name, variant.color, variant.size].filter(Boolean).join(" · ") || "Default"}</div>
                      </Td>
                      <Td>{variant.sku || "—"}</Td>
                      <Td right><span className="font-semibold">{current}</span></Td>
                      <Td right>{level?.committed || 0}</Td>
                      <Td right>{level?.incoming || 0}</Td>
                      <Td right>
                        <div className="inline-flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={draft}
                            onChange={(event) =>
                              setDrafts((state) => ({
                                ...state,
                                [variant.id]: Math.max(0, Number(event.target.value || 0)),
                              }))
                            }
                            className="w-20 h-8 rounded-lg border border-[#d5d5d5] text-center text-xs"
                          />
                          <button
                            onClick={() => save(variant)}
                            disabled={Number(draft) === current}
                            className="h-8 px-2.5 rounded-lg bg-[#222] text-white text-xs disabled:opacity-30"
                          >
                            Save
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan="6" className="py-12 text-center text-[#777]">No matching variants.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TransfersTab({ transfers, loading, onCreate, onOpen }) {
  return (
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <div className="p-3 border-b border-[#e8e8e8] flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Inventory transfers</div>
          <div className="text-xs text-[#777] mt-0.5">Move stock between GDP inventory locations with auditable state changes</div>
        </div>
        <button
          onClick={onCreate}
          className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center gap-2"
        >
          <Plus size={14} /> Create transfer
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-[#fafafa] text-[#707070] text-xs">
            <tr>
              <Th>Transfer</Th>
              <Th>From</Th>
              <Th>To</Th>
              <Th>Items</Th>
              <Th>Status</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="py-12 text-center text-[#777]">Loading transfers…</td></tr>
            ) : transfers.length ? (
              transfers.map((transfer) => (
                <tr
                  key={transfer.id}
                  onClick={() => onOpen(transfer)}
                  className="border-t border-[#eeeeee] hover:bg-[#fafafa] cursor-pointer"
                >
                  <Td><span className="font-semibold">{transfer.transfer_number}</span></Td>
                  <Td>{transfer.from_location?.name || "—"}</Td>
                  <Td>{transfer.to_location?.name || "—"}</Td>
                  <Td>{(transfer.inventory_transfer_items || []).length}</Td>
                  <Td><TransferStatus value={transfer.status} /></Td>
                  <Td>{formatDate(transfer.created_at)}</Td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="6" className="py-12 text-center text-[#777]">No transfers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HistoryTab({ adjustments, loading }) {
  return (
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#e8e8e8]">
        <div className="text-sm font-semibold">Inventory adjustment history</div>
        <div className="text-xs text-[#777] mt-0.5">Manual changes, transfers, returns, damage and corrections</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-[#fafafa] text-[#707070] text-xs">
            <tr>
              <Th>Date</Th>
              <Th>Location</Th>
              <Th>Product / variant</Th>
              <Th>Reason</Th>
              <Th right>Before</Th>
              <Th right>Change</Th>
              <Th right>After</Th>
              <Th>Note</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="py-12 text-center text-[#777]">Loading history…</td></tr>
            ) : adjustments.length ? (
              adjustments.map((row) => (
                <tr key={row.id} className="border-t border-[#eeeeee]">
                  <Td>{formatDate(row.created_at)}</Td>
                  <Td>{row.inventory_locations?.name || "—"}</Td>
                  <Td>
                    <div className="font-medium">{row.product_variants?.products?.name || "Product"}</div>
                    <div className="text-[11px] text-[#777]">{[row.product_variants?.name, row.product_variants?.sku].filter(Boolean).join(" · ")}</div>
                  </Td>
                  <Td><span className="capitalize">{prettify(row.reason)}</span></Td>
                  <Td right>{row.before_quantity}</Td>
                  <Td right>
                    <span className={row.adjustment > 0 ? "text-emerald-700 font-semibold" : "text-red-700 font-semibold"}>
                      {row.adjustment > 0 ? "+" : ""}{row.adjustment}
                    </span>
                  </Td>
                  <Td right>{row.after_quantity}</Td>
                  <Td>{row.note || "—"}</Td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="8" className="py-12 text-center text-[#777]">No adjustment history yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LocationModal({ onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    active: true,
    isDefault: false,
    fulfillsOnline: true,
    address: { address: "", city: "", province: "", postalCode: "", country: "Canada" },
  });

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) return;
    setSaving(true);
    try {
      await adminInventoryOperationsApi.createLocation(form);
      await onSaved();
    } catch (err) {
      console.error("Create inventory location failed:", err);
      window.alert(err?.message || "Could not create location.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Create inventory location" subtitle="Add a warehouse, studio, pickup or fulfillment location" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Location code">
            <input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} className={inputClass} placeholder="SASK" />
          </Field>
          <Field label="Location name">
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} placeholder="Saskatoon Studio" />
          </Field>
        </div>
        <Field label="Address">
          <input
            value={form.address.address}
            onChange={(event) => setForm({ ...form, address: { ...form.address, address: event.target.value } })}
            className={inputClass}
          />
        </Field>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="City">
            <input value={form.address.city} onChange={(event) => setForm({ ...form, address: { ...form.address, city: event.target.value } })} className={inputClass} />
          </Field>
          <Field label="Province">
            <input value={form.address.province} onChange={(event) => setForm({ ...form, address: { ...form.address, province: event.target.value } })} className={inputClass} />
          </Field>
          <Field label="Postal code">
            <input value={form.address.postalCode} onChange={(event) => setForm({ ...form, address: { ...form.address, postalCode: event.target.value } })} className={inputClass} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.fulfillsOnline} onChange={(event) => setForm({ ...form, fulfillsOnline: event.target.checked })} />
          Fulfill online orders from this location
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} />
          Make this the default inventory location
        </label>

        <div className="pt-3 flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 rounded-lg border border-[#d5d5d5] text-sm">Cancel</button>
          <button onClick={save} disabled={saving || !form.code.trim() || !form.name.trim()} className="h-9 px-4 rounded-lg bg-[#222] text-white text-sm font-medium disabled:opacity-40">
            {saving ? "Saving…" : "Create location"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TransferModal({ locations, variants, onClose, onSaved }) {
  const [fromLocationId, setFromLocationId] = useState(locations.find((row) => row.is_default)?.id || locations[0]?.id || "");
  const [toLocationId, setToLocationId] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState({});
  const [saving, setSaving] = useState(false);

  const visibleVariants = useMemo(() => {
    const term = search.trim().toLowerCase();
    return variants
      .filter((variant) => {
        if (!term) return true;
        return [variant.products?.name, variant.name, variant.sku, variant.color, variant.size]
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .slice(0, 100);
  }, [variants, search]);

  const create = async () => {
    if (!fromLocationId || !toLocationId || fromLocationId === toLocationId) return;

    const items = Object.entries(quantities)
      .filter(([, quantity]) => Number(quantity || 0) > 0)
      .map(([variantId, quantity]) => ({ variantId, quantity: Number(quantity) }));

    setSaving(true);
    try {
      await adminInventoryOperationsApi.createTransfer({
        fromLocationId,
        toLocationId,
        note,
        items,
      });
      await onSaved();
    } catch (err) {
      console.error("Create transfer failed:", err);
      window.alert(err?.message || "Could not create transfer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Create inventory transfer" subtitle="Draft a controlled stock movement between locations" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="From">
            <select value={fromLocationId} onChange={(event) => setFromLocationId(event.target.value)} className={inputClass}>
              <option value="">Choose location</option>
              {locations.filter((row) => row.active).map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </Field>
          <Field label="To">
            <select value={toLocationId} onChange={(event) => setToLocationId(event.target.value)} className={inputClass}>
              <option value="">Choose location</option>
              {locations.filter((row) => row.active && row.id !== fromLocationId).map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Transfer note">
          <input value={note} onChange={(event) => setNote(event.target.value)} className={inputClass} placeholder="Reason or shipment reference" />
        </Field>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search variants" className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#d5d5d5] text-sm" />
        </div>

        <div className="max-h-[360px] overflow-y-auto border border-[#e2e2e2] rounded-lg divide-y divide-[#eeeeee]">
          {visibleVariants.map((variant) => (
            <div key={variant.id} className="px-3 py-2.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{variant.products?.name || "Product"}</div>
                <div className="text-[10px] text-[#777]">{[variant.sku, variant.color, variant.size].filter(Boolean).join(" · ") || "Default"}</div>
              </div>
              <div className="text-[10px] text-[#888]">Global {variant.stock}</div>
              <input
                type="number"
                min="0"
                value={quantities[variant.id] || 0}
                onChange={(event) =>
                  setQuantities((current) => ({
                    ...current,
                    [variant.id]: Math.max(0, Number(event.target.value || 0)),
                  }))
                }
                className="w-20 h-8 rounded-lg border border-[#d5d5d5] text-center text-xs"
              />
            </div>
          ))}
        </div>

        {locations.length < 2 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            Create a second active inventory location before creating transfers.
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 rounded-lg border border-[#d5d5d5] text-sm">Cancel</button>
          <button
            onClick={create}
            disabled={saving || !toLocationId || fromLocationId === toLocationId}
            className="h-9 px-4 rounded-lg bg-[#222] text-white text-sm font-medium disabled:opacity-40"
          >
            {saving ? "Creating…" : "Create draft transfer"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TransferDrawer({ transfer, onClose, onChanged }) {
  const [saving, setSaving] = useState(false);
  const [received, setReceived] = useState(() =>
    Object.fromEntries(
      (transfer.inventory_transfer_items || []).map((item) => [
        item.id,
        item.received_quantity || item.quantity,
      ])
    )
  );

  const transition = async (status) => {
    setSaving(true);
    try {
      if (status === "received") {
        for (const item of transfer.inventory_transfer_items || []) {
          await adminInventoryOperationsApi.setReceivedQuantity(
            item.id,
            received[item.id] ?? item.quantity
          );
        }
      }

      await adminInventoryOperationsApi.transitionTransfer(transfer.id, status);
      await onChanged(
        status === "in_transit"
          ? "Transfer shipped and source inventory deducted."
          : status === "received"
            ? "Transfer received and destination inventory updated."
            : `Transfer moved to ${prettify(status)}.`
      );
    } catch (err) {
      console.error("Transfer transition failed:", err);
      window.alert(err?.message || "Could not update transfer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <button className="absolute inset-0 bg-black/35" onClick={onClose} aria-label="Close transfer" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[660px] bg-[#f6f6f6] shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 h-16 px-5 border-b border-[#e3e3e3] bg-white flex items-center justify-between">
          <div>
            <div className="font-semibold">{transfer.transfer_number}</div>
            <div className="text-xs text-[#777]">{transfer.from_location?.name} → {transfer.to_location?.name}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <section className="rounded-xl border border-[#dedede] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <TransferStatus value={transfer.status} />
                <div className="text-xs text-[#777] mt-2">
                  Created {formatDate(transfer.created_at)}
                  {transfer.shipped_at ? ` · Shipped ${formatDate(transfer.shipped_at)}` : ""}
                  {transfer.received_at ? ` · Received ${formatDate(transfer.received_at)}` : ""}
                </div>
              </div>
              <Truck size={22} className="text-[#777]" />
            </div>
          </section>

          <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[#eaeaea] text-sm font-semibold">
              Transfer items
            </div>
            <div className="divide-y divide-[#eeeeee]">
              {(transfer.inventory_transfer_items || []).map((item) => (
                <div key={item.id} className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#f2f2f2] grid place-items-center"><PackageCheck size={14} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{item.product_variants?.products?.name || "Product"}</div>
                    <div className="text-[11px] text-[#777]">{[item.product_variants?.sku, item.product_variants?.color, item.product_variants?.size].filter(Boolean).join(" · ") || "Default"}</div>
                  </div>
                  {transfer.status === "in_transit" ? (
                    <div>
                      <div className="text-[9px] uppercase tracking-wide text-[#888]">Received</div>
                      <input
                        type="number"
                        min="0"
                        max={item.quantity}
                        value={received[item.id] ?? item.quantity}
                        onChange={(event) =>
                          setReceived((current) => ({
                            ...current,
                            [item.id]: Math.min(
                              item.quantity,
                              Math.max(0, Number(event.target.value || 0))
                            ),
                          }))
                        }
                        className="mt-1 w-20 h-8 rounded-lg border border-[#d5d5d5] text-center text-xs"
                      />
                    </div>
                  ) : (
                    <div className="text-sm font-semibold">×{item.quantity}</div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[#dedede] bg-white p-4">
            <div className="text-sm font-semibold">Actions</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {transfer.status === "draft" && (
                <>
                  <button onClick={() => transition("ready")} disabled={saving} className="h-9 px-3 rounded-lg border border-[#d5d5d5] text-sm">Mark ready</button>
                  <button onClick={() => transition("in_transit")} disabled={saving} className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium">Ship transfer</button>
                  <button onClick={() => transition("cancelled")} disabled={saving} className="h-9 px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">Cancel</button>
                </>
              )}
              {transfer.status === "ready" && (
                <>
                  <button onClick={() => transition("in_transit")} disabled={saving} className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium">Ship transfer</button>
                  <button onClick={() => transition("cancelled")} disabled={saving} className="h-9 px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">Cancel</button>
                </>
              )}
              {transfer.status === "in_transit" && (
                <button onClick={() => transition("received")} disabled={saving} className="h-9 px-3 rounded-lg bg-emerald-700 text-white text-sm font-medium">
                  Receive transfer
                </button>
              )}
              {["received", "cancelled"].includes(transfer.status) && (
                <div className="text-xs text-[#777]">This transfer is closed.</div>
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function Modal({ title, subtitle, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 p-3 sm:p-8 flex items-start justify-center overflow-y-auto">
      <div className={`w-full ${wide ? "max-w-4xl" : "max-w-xl"} bg-white rounded-2xl shadow-2xl overflow-hidden my-6`}>
        <div className="h-16 px-5 border-b border-[#e3e3e3] flex items-center justify-between">
          <div>
            <div className="font-semibold">{title}</div>
            <div className="text-xs text-[#777]">{subtitle}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#dedede] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-[#777]">{label}</div>
        <Icon size={16} className="text-[#777]" />
      </div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
    </div>
  );
}

function TransferStatus({ value }) {
  const classes = {
    draft: "bg-[#eeeeee] text-[#555]",
    ready: "bg-blue-100 text-blue-800",
    in_transit: "bg-amber-100 text-amber-800",
    received: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${classes[value] || "bg-[#eee] text-[#555]"}`}>
      {prettify(value)}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#555]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Th({ children, right }) {
  return <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right }) {
  return <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"}`}>{children}</td>;
}

const inputClass = "w-full h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-black/10";
