"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { deductPackageUse } from "@/lib/actions";
import { CustomerPackage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  useEffect(() => {
    if (!open) return;

    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setUsedDateTime(local);
  }, [open]);

  async function handleConfirm() {
    if (!customerPackage) return;
    if (!notes.trim()) {
      toast.error("Notes is required");
      return;
    }
    setLoading(true);
    try {
      const usedAtIso = usedDateTime ? new Date(usedDateTime).toISOString() : undefined;
      await deductPackageUse(customerPackage.id, notes.trim(), usedAtIso);
      toast.success(
        `1 use deducted. ${customerPackage.remaining_uses - 1} remaining.`
      );
      setNotes("");
      setUsedDateTime("");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deduct use");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Use 1 Session</DialogTitle>
          <DialogDescription>
            This will deduct 1 use from{" "}
            <strong>{customerPackage?.customer?.name ?? "this customer"}</strong>&apos;s package.
            They currently have{" "}
            <strong>{customerPackage?.remaining_uses} uses</strong> remaining.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          <Label htmlFor="used_at">Used Date & Time</Label>
          <Input
            id="used_at"
            type="datetime-local"
            value={usedDateTime}
            readOnly
          />
        </div>
        <div className="space-y-2 mt-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            placeholder="e.g. Friend of customer used this session"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm whitespace-normal break-words"
          />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !customerPackage || customerPackage.remaining_uses <= 0 || !notes.trim()}
          >
            {loading ? "Processing..." : "Confirm — Deduct 1 Use"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
