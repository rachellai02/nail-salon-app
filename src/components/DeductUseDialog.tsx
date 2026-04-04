"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { deductPackageUse } from "@/lib/actions";
import { CustomerPackage, CustomerPackageItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onClose: () => void;
  customerPackage: CustomerPackage | null;
};

export function DeductUseDialog({ open, onClose, customerPackage }: Props) {
  const [notes, setNotes] = useState("");
  const [usedDateTime, setUsedDateTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const items: CustomerPackageItem[] = customerPackage?.items ?? [];
  const hasItems = items.length > 0;

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setUsedDateTime(local);
    setSelectedItemIds(new Set());
    setNotes("");
  }, [open]);

  function toggleItem(id: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedCount = selectedItemIds.size;
  const canConfirm = !loading && !!notes.trim() && (
    hasItems ? selectedCount > 0 : (customerPackage?.remaining_uses ?? 0) > 0
  );

  async function handleConfirm() {
    if (!customerPackage) return;
    setLoading(true);
    try {
      const usedAtIso = usedDateTime ? new Date(usedDateTime).toISOString() : undefined;
      if (hasItems) {
        for (const itemId of selectedItemIds) {
          await deductPackageUse(customerPackage.id, itemId, notes.trim(), usedAtIso);
        }
        const deductedNames = items
          .filter((i) => selectedItemIds.has(i.id))
          .map((i) => i.service_name)
          .join(", ");
        toast.success(`Deducted: ${deductedNames}`);
      } else {
        await deductPackageUse(customerPackage.id, null, notes.trim(), usedAtIso);
        toast.success(`1 use deducted. ${(customerPackage.remaining_uses ?? 1) - 1} remaining.`);
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deduct use");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Deduct Uses</DialogTitle>
          <DialogDescription>
            Customer: <strong>{customerPackage?.customer?.name ?? "—"}</strong>
            <br />
            Package: <strong>{customerPackage?.package?.name ?? "—"}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Item selection */}
        {hasItems ? (
          <div className="space-y-2">
            <Label>Select services to deduct <span className="text-gray-400 font-normal">(tap to toggle)</span></Label>
            <div className="space-y-1.5">
              {items.map((item) => {
                const exhausted = item.remaining_uses <= 0;
                const selected = selectedItemIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={exhausted}
                    onClick={() => toggleItem(item.id)}
                    className={[
                      "w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
                      exhausted ? "opacity-40 cursor-not-allowed bg-gray-50" : "cursor-pointer hover:border-gray-400",
                      selected ? "border-gray-900 bg-gray-50 font-medium" : "border-gray-200",
                    ].join(" ")}
                  >
                    <span>{item.service_name}</span>
                    <div className="flex items-center gap-2">
                      {selected && <span className="text-xs font-semibold text-gray-900">✓</span>}
                      <Badge
                        variant={
                          exhausted ? "destructive" : item.remaining_uses <= 1 ? "secondary" : "default"
                        }
                      >
                        {item.remaining_uses}/{item.total_uses} left
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            Remaining uses: <strong>{customerPackage?.remaining_uses ?? 0}</strong>
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="used_at">Used Date & Time</Label>
          <Input id="used_at" type="datetime-local" value={usedDateTime} readOnly />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes <span className="text-red-500">*</span></Label>
          <textarea
            id="notes"
            placeholder="e.g. Own use / Friend use"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm whitespace-normal break-words"
          />
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {loading
              ? "Processing..."
              : hasItems && selectedCount > 0
              ? `Confirm — Deduct ${selectedCount} Use${selectedCount > 1 ? "s" : ""}`
              : "Confirm — Deduct 1 Use"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

