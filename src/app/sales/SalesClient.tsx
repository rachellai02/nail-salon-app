"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Transaction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReceiptView } from "@/components/ReceiptView";
import { voidTransaction, deleteTransaction } from "@/lib/actions";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Receipt, Trash2 } from "lucide-react";
import SalesSummaryClient from "./SalesSummaryClient";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  transactions: Transaction[];
  year: number;
  month: number; // 1-based
  summaryTransactions: { transacted_at: string; total: number }[];
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-MY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function SalesClient({ transactions, year, month, summaryTransactions }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "details" ? "details" : "summary";
  const initialDate = searchParams.get("date");
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Group totals by date string "yyyy-MM-dd" (exclude voided)
  const totalsByDate = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.is_voided) continue;
      const d = tx.transacted_at.slice(0, 10);
      map[d] = (map[d] ?? 0) + Number(tx.total);
    }
    return map;
  }, [transactions]);

  // Transactions for the selected date
  const dayTransactions = useMemo<Transaction[]>(() => {
    if (!selectedDate) return [];
    return transactions.filter((tx) => tx.transacted_at.slice(0, 10) === selectedDate);
  }, [transactions, selectedDate]);

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  function navigate(dir: -1 | 1) {
    let m = month + dir;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    router.push(`/sales?year=${y}&month=${m}`);
  }

  function dateStr(day: number) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const monthTotal = transactions.filter((t) => !t.is_voided).reduce((s, t) => s + Number(t.total), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={activeTab === "summary" ? "default" : "outline"}
          onClick={() => router.push(`/sales?year=${year}&month=${month}&tab=summary`)}
        >
          Summary
        </Button>
        <Button
          type="button"
          variant={activeTab === "details" ? "default" : "outline"}
          onClick={() => router.push(`/sales?year=${year}&month=${month}&tab=details`)}
        >
          Details
        </Button>
      </div>

      {activeTab === "summary" ? (
        <SalesSummaryClient
          transactions={summaryTransactions}
          onMonthClick={(y, m) => {
            router.push(`/sales?year=${y}&month=${m}&tab=details`);
          }}
          onDayClick={(y, m, d) => {
            router.push(`/sales?year=${y}&month=${m}&tab=details&date=${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
          }}
        />
      ) : (
        <>
          {/* Month navigation */}
          <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold">{MONTH_NAMES[month - 1]} {year}</h1>
          <p className="text-sm text-gray-500">Monthly Total: RM {monthTotal.toFixed(2)}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-xl overflow-hidden bg-white">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b">
          {DAY_LABELS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            const ds = day ? dateStr(day) : null;
            const total = ds ? totalsByDate[ds] : undefined;
            const isToday = ds === new Date().toISOString().slice(0, 10);
            const isSelected = ds !== null && ds === selectedDate;

            return (
              <button
                key={idx}
                type="button"
                disabled={!day}
                onClick={() => day && setSelectedDate(ds)}
                className={`
                  min-h-[72px] p-2 text-left border-r border-b last:border-r-0 transition-colors
                  ${!day ? "bg-gray-50 cursor-default" : "hover:bg-blue-50"}
                  ${isSelected ? "bg-blue-50 ring-2 ring-inset ring-blue-500" : ""}
                `}
              >
                {day && (
                  <>
                    <span className={`text-sm font-medium ${isToday ? "bg-black text-white rounded-full w-6 h-6 flex items-center justify-center text-xs" : ""}`}>
                      {day}
                    </span>
                    {total !== undefined && (
                      <span className="mt-1 block text-xs font-semibold text-green-600">
                        RM {total.toFixed(2)}
                      </span>
                    )}
                    {total === undefined && (
                      <span className="mt-1 block text-xs text-gray-300">—</span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDate && (
        <div className="border rounded-xl bg-white overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-MY", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                })}
              </h2>
              <p className="text-sm text-gray-500">
                {(() => {
                  const active = dayTransactions.filter((t) => !t.is_voided);
                  return `${active.length} transaction${active.length !== 1 ? "s" : ""} · RM ${active.reduce((s, t) => s + Number(t.total), 0).toFixed(2)}`;
                })()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Close
            </button>
          </div>

          {dayTransactions.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No transactions on this day.</p>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-5 py-2 text-left font-medium">Time</th>
                  <th className="px-5 py-2 text-left font-medium">Receipt No</th>
                  <th className="px-5 py-2 text-left font-medium">Customer</th>
                  <th className="px-5 py-2 text-left font-medium">Payment</th>
                  <th className="px-5 py-2 text-right font-medium">Total (RM)</th>
                  <th className="px-5 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {dayTransactions.map((tx) => (
                  <tr key={tx.id} className={`border-b last:border-0 ${tx.is_voided ? "opacity-50" : "hover:bg-gray-50"}`}>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(tx.transacted_at).toLocaleTimeString("en-MY", {
                        hour: "2-digit", minute: "2-digit", hour12: true,
                      })}
                    </td>
                    <td className="px-5 py-3 font-mono">
                      {tx.receipt_no}
                      {tx.is_voided && (
                        <span className="ml-2 text-xs font-semibold text-red-500 uppercase">Void</span>
                      )}
                    </td>
                    <td className="px-5 py-3">{tx.customer_name ?? <span className="text-gray-400">—</span>}</td>
                    <td className="px-5 py-3">{tx.payment_type}</td>
                    <td className={`px-5 py-3 text-right font-semibold ${tx.is_voided ? "line-through text-gray-400" : ""}`}>
                      {Number(tx.total).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-6">
                        <button
                          type="button"
                          onClick={() => setReceiptTx(tx)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <Receipt size={14} /> Receipt
                        </button>
                        <button
                          type="button"
                          onClick={() => setVoidTarget(tx)}
                          className={`text-xs text-red-500 hover:text-red-700 transition-colors ${tx.is_voided ? "invisible" : ""}`}
                        >
                          Void
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(tx)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete transaction"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v && !deleting) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            This will permanently delete receipt{" "}
            <span className="font-mono font-semibold">{deleteTarget?.receipt_no}</span> from history.
            This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!deleteTarget) return;
                setDeleting(true);
                try {
                  await deleteTransaction(deleteTarget.id);
                  toast.success(`Receipt ${deleteTarget.receipt_no} deleted.`);
                } catch {
                  toast.error("Failed to delete transaction.");
                } finally {
                  setDeleting(false);
                  setDeleteTarget(null);
                }
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v && !deleting) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            This will permanently delete receipt{" "}
            <span className="font-mono font-semibold">{deleteTarget?.receipt_no}</span> from history.
            This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!deleteTarget) return;
                setDeleting(true);
                try {
                  await deleteTransaction(deleteTarget.id);
                  toast.success(`Receipt ${deleteTarget.receipt_no} deleted.`);
                } catch {
                  toast.error("Failed to delete transaction.");
                } finally {
                  setDeleting(false);
                  setDeleteTarget(null);
                }
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Void confirmation dialog */}
      <Dialog open={!!voidTarget} onOpenChange={(v) => { if (!v && !voiding) setVoidTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Void Transaction</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            This will mark receipt <span className="font-mono font-semibold">{voidTarget?.receipt_no}</span> as voided
            and exclude it from all sales totals. This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" disabled={voiding} onClick={() => setVoidTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={voiding}
              onClick={async () => {
                if (!voidTarget) return;
                setVoiding(true);
                try {
                  await voidTransaction(voidTarget.id);
                } finally {
                  setVoiding(false);
                  setVoidTarget(null);
                }
              }}
            >
              {voiding ? "Voiding…" : "Confirm Void"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt preview dialog */}
      <Dialog open={!!receiptTx} onOpenChange={(v) => { if (!v) setReceiptTx(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{receiptTx?.is_voided ? "Receipt (Voided)" : "Receipt"}</DialogTitle>
          </DialogHeader>
          {receiptTx && (
            <>
              <ReceiptView
                receiptNo={receiptTx.receipt_no}
                date={new Date(receiptTx.transacted_at).toLocaleString("en-MY", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
                items={(Array.isArray(receiptTx.items) ? receiptTx.items : []).map(
                  (i) => ({ qty: i.qty, name: i.service_name, subtotal: i.subtotal })
                )}
                paymentType={receiptTx.payment_type}
                total={Number(receiptTx.total)}
                cashReceived={receiptTx.cash_received}
                changeGiven={receiptTx.change_given}
                isVoided={receiptTx.is_voided}
              />
              {receiptTx.is_voided && (
                <Button
                  className="w-full"
                  onClick={() => {
                    const name = receiptTx.customer_name ?? "Unknown";
                    const phone = receiptTx.customer_phone ?? "No phone";
                    toast.success(`Voided receipt resent to ${name} (${phone}).`);
                    setReceiptTx(null);
                  }}
                >
                  Resend to Customer
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  );
}


