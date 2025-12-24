"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";

type Status = "pending" | "confirmed" | "in_progress" | "cancelled" | "finished";

type ServiceLite = {
  id: string;
  name: string;
  price_cents: number | null;
  duration_mins: number | null;
};

type Row = {
  id: string;
  date: string;
  time: string;
  status: Status;
  full_name: string;
  phone: string;
  email: string | null;
  address: string | null;

  appointment_services?: Array<{ service: ServiceLite | null }> | null;

  // present only if you created the view `appointment_totals`
  appointment_totals?: { total_price_cents: number | null; total_duration_mins: number | null } | null;
};

const STATUSES: Status[] = ["pending", "confirmed", "in_progress", "finished", "cancelled"];

// ✅ Set true ONLY after you create the SQL view `appointment_totals`.
// Leaving it false keeps everything working (totals computed on client).
const USE_TOTALS_VIEW = false;

function labelStatus(s: Status) {
  switch (s) {
    case "pending":
      return "Pending";
    case "confirmed":
      return "Confirmed";
    case "in_progress":
      return "In progress";
    case "finished":
      return "Finished";
    case "cancelled":
      return "Cancelled";
  }
}

function coerceStatus(s?: string | null): Status | null {
  if (!s) return null;
  return (STATUSES as string[]).includes(s) ? (s as Status) : null;
}

function formatXAF(priceCents: number) {
  const amount = Math.round(priceCents / 100);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(amount);
}

function normalizeTime(t: string) {
  const parts = t.split(":");
  if (parts.length >= 2) return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  return t;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function AppointmentsManager({ initialStatus }: { initialStatus?: string }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const sp = useSearchParams();

  const fromUrl = coerceStatus(sp.get("status"));
  const fromProp = coerceStatus(initialStatus);

  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<Status>(fromUrl ?? fromProp ?? "pending");
  const [busy, setBusy] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // pagination
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (fromUrl && fromUrl !== tab) {
      setTab(fromUrl);
      setRows([]);
      setPage(0);
      setHasMore(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  async function loadPage(opts?: { reset?: boolean }) {
    const reset = Boolean(opts?.reset);

    setBusy(true);

    const from = reset ? 0 : page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // For active workflows, default to “upcoming” to avoid scanning the entire table.
    // For finished/cancelled, we do not apply the date filter because you likely want history too.
    const isTerminal = tab === "finished" || tab === "cancelled";
    const minDate = isTerminal ? null : todayISO();

    const selectStr = `
      id,
      date,
      time,
      status,
      full_name,
      phone,
      email,
      address,
      appointment_services(
        service:services!appointment_services_service_id_fkey(
          id,name,price_cents,duration_mins
        )
      )
      ${USE_TOTALS_VIEW ? ", appointment_totals(total_price_cents,total_duration_mins)" : ""}
    `;

    let q = supabase
      .from("appointments")
      .select(selectStr)
      .eq("status", tab)
      .order("date", { ascending: true })
      .order("time", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);

    if (minDate) q = q.gte("date", minDate);

    const { data, error } = await q;

    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    const cleaned = (data ?? []).map((r: any) => ({
      ...r,
      time: normalizeTime(String(r.time)),
    })) as Row[];

    if (reset) {
      setRows(cleaned);
      setPage(1);
      setHasMore(cleaned.length === PAGE_SIZE);
    } else {
      setRows((prev) => [...prev, ...cleaned]);
      setPage((p) => p + 1);
      setHasMore(cleaned.length === PAGE_SIZE);
    }
  }

  useEffect(() => {
    loadPage({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function changeTab(next: Status) {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("status", next);
    router.replace(url.pathname + url.search);
  }

  async function setStatus(id: string, status: Status) {
    if (actionBusyId) return;
    setActionBusyId(id);

    try {
      const res = await fetch("/api/admin/appointments/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to update status");

      await loadPage({ reset: true });
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to update status");
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Appointments</div>
            <div className="mt-1 text-sm text-slate-600">
              Showing: <span className="font-semibold text-slate-900">{labelStatus(tab)}</span>
              {busy ? <span className="ml-2 text-xs text-slate-500">Loading...</span> : null}
              <span className="ml-2 text-xs text-slate-500">({rows.length})</span>
            </div>
          </div>

          <button className="btn-ghost" type="button" onClick={() => loadPage({ reset: true })}>
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={"btn-ghost " + (tab === s ? "ring-2 ring-ink-300 bg-ink-50" : "")}
              onClick={() => changeTab(s)}
            >
              {labelStatus(s)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {rows.map((a) => {
          const rowBusy = actionBusyId === a.id;

          const services =
            (a.appointment_services?.map((x) => x?.service).filter(Boolean) as ServiceLite[] | undefined) ?? [];

          const serviceNames = services.map((s) => s.name);

          const dbTotalDuration = USE_TOTALS_VIEW ? a.appointment_totals?.total_duration_mins ?? null : null;
          const dbTotalPrice = USE_TOTALS_VIEW ? a.appointment_totals?.total_price_cents ?? null : null;

          const totalDuration = dbTotalDuration ?? services.reduce((sum, s) => sum + (s.duration_mins ?? 0), 0);
          const totalPriceCents = dbTotalPrice ?? services.reduce((sum, s) => sum + (s.price_cents ?? 0), 0);

          return (
            <div key={a.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-600">
                    {a.date} | {a.time}
                  </div>

                  <div className="mt-1 text-base font-semibold">
                    {serviceNames.length ? serviceNames.join(", ") : "Service"}
                  </div>

                  {serviceNames.length ? (
                    <div className="mt-1 text-xs text-slate-600">
                      {totalDuration ? `${totalDuration} mins` : null}
                      {totalDuration && totalPriceCents ? " • " : null}
                      {totalPriceCents ? `${formatXAF(totalPriceCents)}` : null}
                    </div>
                  ) : null}

                  <div className="mt-2 text-sm text-slate-700">
                    <div>
                      <span className="text-slate-600">Client:</span> {a.full_name}
                    </div>
                    <div>
                      <span className="text-slate-600">Phone:</span> {a.phone}
                    </div>
                    {a.email ? (
                      <div>
                        <span className="text-slate-600">Email:</span> {a.email}
                      </div>
                    ) : null}
                    {a.address ? (
                      <div>
                        <span className="text-slate-600">Address:</span> {a.address}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {tab !== "confirmed" ? (
                    <button
                      className="btn-primary"
                      type="button"
                      disabled={rowBusy}
                      onClick={() => setStatus(a.id, "confirmed")}
                    >
                      {rowBusy ? "Updating..." : "Confirm"}
                    </button>
                  ) : null}

                  {tab !== "in_progress" ? (
                    <button className="btn-ghost" type="button" disabled={rowBusy} onClick={() => setStatus(a.id, "in_progress")}>
                      {rowBusy ? "Updating..." : "Start"}
                    </button>
                  ) : null}

                  {tab !== "finished" ? (
                    <button className="btn-ghost" type="button" disabled={rowBusy} onClick={() => setStatus(a.id, "finished")}>
                      {rowBusy ? "Updating..." : "Finish"}
                    </button>
                  ) : null}

                  {tab !== "cancelled" ? (
                    <button className="btn-ghost" type="button" disabled={rowBusy} onClick={() => setStatus(a.id, "cancelled")}>
                      {rowBusy ? "Updating..." : "Cancel"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}

        {!rows.length && !busy ? (
          <div className="card p-10 text-center text-sm text-slate-600">No appointments in this status.</div>
        ) : null}

        {hasMore ? (
          <div className="flex justify-center">
            <button className="btn-ghost" type="button" disabled={busy} onClick={() => loadPage()}>
              {busy ? "Loading..." : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
