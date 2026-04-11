"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getEmployees, getEmployeeSplits, upsertEmployeeSplits } from "@/lib/actions";
import { Employee } from "@/lib/types";
import { toast } from "sonner";

type SplitRow = {
  employee_id: string;
  employee_code: number;
  name: string;
  nickname: string | null;
  amount: string;
};

export type SplitContributor = { employee_id: string; display: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transactionId: string;
  transactionTotal: number;
  receiptNo: string;
  onSaved: (contributors: SplitContributor[]) => void;
};

export default function EmployeeSplitDialog({
  open,
  onOpenChange,
  transactionId,
  transactionTotal,
  receiptNo,
  onSaved,
}: Props) {
  const [rows, setRows] = useState<SplitRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([getEmployees(), getEmployeeSplits(transactionId)])
      .then(([employees, splits]) => {
        const active = (employees as Employee[]).filter((e) => e.is_active);
        const splitMap = new Map(splits.map((s) => [s.employee_id, s.amount]));
        const sorted = [...active].sort((a, b) => a.employee_code - b.employee_code);
        setRows(
          sorted.map((e) => ({
            employee_id: e.id,
            employee_code: e.employee_code,
            name: e.name,
            nickname: e.nickname,
            amount: splitMap.has(e.id) ? String(splitMap.get(e.id)) : "",
          }))
        );
      })
      .catch(() => toast.error("Failed to load employee splits."))
      .finally(() => setLoading(false));
  }, [open, transactionId]);

  function updateAmount(employeeId: string, value: string) {
    if (value !== "" && !/^\d*\.?\d{0,2}$/.test(value)) return;
    setRows((prev) =>
      prev.map((r) => (r.employee_id === employeeId ? { ...r, amount: value } : r))
    );
  }

  const emp001 = rows.find((r) => r.employee_code === 1);
  const others = rows.filter((r) => r.employee_code !== 1);
  const othersTotal = others.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const emp001Amount = Math.max(0, transactionTotal - othersTotal);
  const isOverLimit = othersTotal > transactionTotal;

  async function handleSave() {
    setSaving(true);
    try {
      const splits = [
        ...others.map((r) => ({ employee_id: r.employee_id, amount: parseFloat(r.amount) || 0 })),
        ...(emp001 ? [{ employee_id: emp001.employee_id, amount: emp001Amount }] : []),
      ];
      await upsertEmployeeSplits(transactionId, splits);
      const contributors: SplitContributor[] = others
        .filter((r) => (parseFloat(r.amount) || 0) > 0)
        .map((r) => ({ employee_id: r.employee_id, display: r.nickname ?? r.name }));
      onSaved(contributors);
      toast.success("Employee splits saved.");
      onOpenChange(false);
    } catch {
      toast.error("Failed to save employee splits.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onOpenChange(false); }}>
      <DialogContent className="w-[min(520px,calc(100dvw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>Employee Split — {receiptNo}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-500">
          Transaction total:{" "}
          <span className="font-semibold text-gray-800">RM {transactionTotal.toFixed(2)}</span>
        </p>

        {loading ? (
          <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No active employees found.</p>
        ) : (
          <div className="space-y-3 mt-1">
            {others.map((row) => (
              <div key={row.employee_id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{row.nickname ?? row.name}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-sm text-gray-500">RM</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={row.amount}
                    onChange={(e) => updateAmount(row.employee_id, e.target.value)}
                    placeholder="0.00"
                    className="w-28 text-right"
                  />
                </div>
              </div>
            ))}

            {others.length > 0 && emp001 && (
              <div className="border-t border-gray-100" />
            )}

            {emp001 && (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{emp001.nickname ?? emp001.name}</p>
                  <p className="text-xs text-gray-400">Default owner · auto-calculated</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-sm text-gray-400">RM</span>
                  <div className="w-28 text-right text-sm font-semibold text-gray-600 px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                    {emp001Amount.toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          {isOverLimit && (
            <p className="flex-1 text-xs text-red-500 self-center">
              Total exceeds RM {transactionTotal.toFixed(2)} by RM {(othersTotal - transactionTotal).toFixed(2)}
            </p>
          )}
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving || loading || isOverLimit} onClick={() => void handleSave()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
