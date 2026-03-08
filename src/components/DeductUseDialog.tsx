"use client";

import { useState } from "react";
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
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!customerPackage) return;
    setLoading(true);
    try {
      await deductPackageUse(customerPackage.id, notes || undefined);
      toast.success(
        `1 use deducted. ${customerPackage.remaining_uses - 1} remaining.`
      );
      setNotes("");
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
            <strong>{customerPackage?.customer_name}</strong>&apos;s package.
            They currently have{" "}
            <strong>{customerPackage?.remaining_uses} uses</strong> remaining.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input
            id="notes"
            placeholder="e.g. Friend of customer used this session"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !customerPackage || customerPackage.remaining_uses <= 0}
          >
            {loading ? "Processing..." : "Confirm — Deduct 1 Use"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
