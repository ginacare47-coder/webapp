import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { AdminNav } from "@/components/AdminNav";
import { headers } from "next/headers";

const STATUSES = ["pending", "confirmed", "in_progress", "finished", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_META: Record<
  Status,
  { label: string; icon: string; color: string }
> = {
  pending: { label: "Pending", icon: "⏳", color: "ring-amber-300 bg-amber-50" },
  confirmed: { label: "Confirmed", icon: "✅", color: "ring-blue-300 bg-blue-50" },
  in_progress: { label: "In progress", icon: "🩺", color: "ring-indigo-300 bg-indigo-50" },
  finished: { label: "Finished", icon: "🏁", color: "ring-emerald-300 bg-emerald-50" },
  cancelled: { label: "Cancelled", icon: "❌", color: "ring-rose-300 bg-rose-50" },
};

function normalizeStatus(input: string): Status | null {
  const s = String(input ?? "").toLowerCase().trim();
  if (s === "pending") return "pending";
  if (s === "confirmed") return "confirmed";
  if (s === "in_progress" || s === "in progress") return "in_progress";
  if (s === "finished") return "finished";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  return null;
}

export default async function AdminDashboard() {
  await requireAdmin();
  const supabase = await supabaseServer();

 const hdrs = await headers();
const url = new URL(hdrs.get("x-url") ?? "http://localhost/admin");
  const activeStatus = url.searchParams.get("status") as Status | null;

  const { data } = await supabase.rpc("appointment_status_counts");

  const tally: Record<Status, number> = {
    pending: 0,
    confirmed: 0,
    in_progress: 0,
    finished: 0,
    cancelled: 0,
  };

  for (const row of (data ?? []) as Array<{ status: string; total: number }>) {
    const s = normalizeStatus(row.status);
    if (s) tally[s] = Number(row.total ?? 0);
  }

  const totalAll = Object.values(tally).reduce((a, b) => a + b, 0);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <AdminNav />

      <div className="mt-6 card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Dashboard</div>
            <div className="mt-1 text-sm text-slate-600">
              Total appointments{" "}
              <span className="font-semibold text-slate-900">{totalAll}</span>
            </div>
          </div>

          <Link href="/admin/appointments" className="text-sm text-ink-700 hover:underline">
            View all
          </Link>
        </div>

        {/* Status grid */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STATUSES.map((status) => {
            const meta = STATUS_META[status];
            const isActive = activeStatus === status;

            return (
              <Link
                key={status}
                href={`/admin/appointments?status=${encodeURIComponent(status)}`}
                className={[
                  "rounded-2xl p-4 transition ring-1",
                  "focus:outline-none focus:ring-2 focus:ring-ink-400",
                  isActive
                    ? "bg-ink-700 text-white ring-ink-700"
                    : "bg-white hover:ring-ink-300",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  {/* Icon */}
                  <div
                    className={[
                      "grid h-9 w-9 place-items-center rounded-xl text-lg",
                      isActive ? "bg-white/20" : meta.color,
                    ].join(" ")}
                  >
                    {meta.icon}
                  </div>

                  {/* Count */}
                  <div className="text-2xl font-semibold">
                    {tally[status]}
                  </div>
                </div>

                {/* Label: hidden on small phones */}
                <div
                  className={[
                    "mt-2 text-xs font-medium",
                    isActive ? "text-white/90" : "text-slate-600",
                    "hidden sm:block",
                  ].join(" ")}
                >
                  {meta.label}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Tap a tile to filter appointments by status.
        </div>
      </div>
    </main>
  );
}
