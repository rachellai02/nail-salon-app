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
  onDeducted?: (serviceNames: string[], creditTopup?: number) => void;
  cartServiceNames?: string[];
  cartItems?: { service_name: string; price: string; qty: string }[];
};

export function DeductUseDialog({ open, onClose, customerPackage, onDeducted, cartServiceNames, cartItems }: Props) {
  const [notes, setNotes] = useState("Own Use");
  const [noteType, setNoteType] = useState<"Own Use" | "Friend Use">("Own Use");
  const [friendDetails, setFriendDetails] = useState("");
  const [usedDateTime, setUsedDateTime] = useState("");
  const [loading, setLoading] = useState(false);
  // Map of customerPackageItem.id → number of uses to deduct
  const [itemCounts, setItemCounts] = useState<Map<string, number>>(new Map());
  const [legacyCount, setLegacyCount] = useState(1);
  const [creditServices, setCreditServices] = useState<{ service_name: string; price: string }[]>([{ service_name: "", price: "" }]);

  const items: CustomerPackageItem[] = customerPackage?.items ?? [];
  const isCredit = (customerPackage?.package?.package_type ?? 'services') === 'credit';
  const hasItems = !isCredit && items.length > 0;

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setUsedDateTime(local);
    setNoteType("Own Use");
    setNotes("Own Use");
    setFriendDetails("");
    setLegacyCount(1);

    const pkg = customerPackage;
    const isCredit_ = (pkg?.package?.package_type ?? "services") === "credit";
    if (isCredit_ && cartItems && cartItems.length > 0) {
      const expanded = cartItems.flatMap((item) => {
        const qty = Math.max(1, Math.round(parseFloat(item.qty) || 1));
        return Array.from({ length: qty }, () => ({
          service_name: item.service_name,
          price: item.price,
        }));
      });
      setCreditServices(expanded);
    } else {
      setCreditServices([{ service_name: "", price: "" }]);
    }

    // Auto-populate item counts from cart quantities
    const pkgItems: CustomerPackageItem[] = pkg?.items ?? [];
    if (!isCredit_ && pkgItems.length > 0 && cartItems && cartItems.length > 0) {
      const cartCountMap = new Map<string, number>();
      for (const ci of cartItems) {
        const k = ci.service_name.trim().toLowerCase();
        cartCountMap.set(k, (cartCountMap.get(k) ?? 0) + Math.max(1, Math.round(parseFloat(ci.qty) || 1)));
      }
      const initial = new Map<string, number>();
      for (const it of pkgItems) {
        const k = it.service_name.trim().toLowerCase();
        const wanted = cartCountMap.get(k) ?? 0;
        if (wanted > 0 && it.remaining_uses > 0) {
          initial.set(it.id, Math.min(wanted, it.remaining_uses));
        }
      }
      setItemCounts(initial);
    } else {
      setItemCounts(new Map());
    }
  }, [open]);

  function adjustCount(id: string, delta: number, max: number) {
    setItemCounts((prev) => {
      const next = new Map(prev);
      const cur = next.get(id) ?? 0;
      const n = Math.min(Math.max(cur + delta, 0), max);
      if (n === 0) next.delete(id); else next.set(id, n);
      return next;
    });
  }

  function updateCreditService(idx: number, field: "service_name" | "price", value: string) {
    setCreditServices((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }
  function addCreditService() {
    setCreditServices((prev) => [...prev, { service_name: "", price: "" }]);
  }
  function removeCreditService(idx: number) {
    setCreditServices((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalUsesToDeduct = [...itemCounts.values()].reduce((s, v) => s + v, 0);
  const remaining = customerPackage?.remaining_credits ?? 0;
  const totalCredits = creditServices.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
  const cashTopup = Math.max(0, totalCredits - remaining);

  // Validate selected items against cart
  const invalidSelectedItems = hasItems && cartServiceNames
    ? items.filter((item) =>
        (itemCounts.get(item.id) ?? 0) > 0 &&
        !cartServiceNames.some((n) => n.trim().toLowerCase() === item.service_name.trim().toLowerCase())
      )
    : [];
  const hasInvalidSelection = invalidSelectedItems.length > 0;

  const composedNotes = noteType === "Friend Use"
    ? `Friend Use${friendDetails.trim() ? ` - ${friendDetails.trim()}` : ""}`
    : "Own Use";

  const canConfirm = !loading && !(noteType === "Friend Use" && !friendDetails.trim()) && !hasInvalidSelection && (
    isCredit
      ? creditServices.length > 0 &&
        creditServices.every((s) => s.service_name.trim() !== "" && parseFloat(s.price) > 0) &&
        totalCredits > 0
      : hasItems
      ? totalUsesToDeduct > 0
      : legacyCount >= 1 && legacyCount <= (customerPackage?.remaining_uses ?? 0)
  );

  async function handleConfirm() {
    if (!customerPackage) return;
    setLoading(true);
    try {
      const usedAtIso = usedDateTime ? new Date(usedDateTime).toISOString() : undefined;
      let deductedNames: string[] = [];
      if (isCredit) {
        const services = creditServices.map((s) => ({ service_name: s.service_name.trim(), price: parseFloat(s.price) }));
        await deductPackageUse(customerPackage.id, null, composedNotes, usedAtIso, undefined, services);
        const newRemaining = Math.max(0, (customerPackage.remaining_credits ?? 0) - totalCredits);
        const topupMsg = cashTopup > 0 ? ` + ${cashTopup} cash top-up` : "";
        toast.success(`${totalCredits} deducted ${topupMsg}. ${newRemaining} credits remaining.`);
        deductedNames = creditServices.map((s) => s.service_name.trim()).filter(Boolean);
      } else if (hasItems) {
        for (const [itemId, cnt] of itemCounts) {
          if (cnt <= 0) continue;
          await deductPackageUse(customerPackage.id, itemId, composedNotes, usedAtIso, undefined, undefined, cnt);
          const svcName = items.find((i) => i.id === itemId)?.service_name ?? "";
          for (let x = 0; x < cnt; x++) deductedNames.push(svcName);
        }
        toast.success(`Deducted ${totalUsesToDeduct} use${totalUsesToDeduct !== 1 ? "s" : ""}: ${[...new Set(deductedNames)].join(", ")}`);
      } else {
        await deductPackageUse(customerPackage.id, null, composedNotes, usedAtIso, undefined, undefined, legacyCount);
        toast.success(`${legacyCount} use${legacyCount !== 1 ? "s" : ""} deducted. ${(customerPackage.remaining_uses ?? legacyCount) - legacyCount} remaining.`);
        for (let x = 0; x < legacyCount; x++) deductedNames.push("");
      }
      onDeducted?.(deductedNames, isCredit && cashTopup > 0 ? cashTopup : undefined);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deduct use");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[min(50dvw,calc(100dvw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>Deduct Uses</DialogTitle>
          <DialogDescription>
            Customer: <strong>{customerPackage?.customer?.name ?? "—"}</strong>
            <br />
            Package: <strong>{customerPackage?.package?.name ?? "—"}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Credit type: service + price list */}
        {isCredit ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Credits Remaining</Label>
              <span className="text-sm font-semibold">{remaining}</span>
            </div>
            <div className="space-y-1">
              <Label>Services Performed <span className="text-red-500">*</span></Label>
              <div className="space-y-2">
                {creditServices.map((svc, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      placeholder="Service name"
                      value={svc.service_name}
                      onChange={(e) => updateCreditService(idx, "service_name", e.target.value)}
                      className="flex-1"
                      readOnly={!!cartItems && cartItems.length > 0}
                    />
                    <Input
                      type="number"
                      placeholder="Price"
                      min={0.01}
                      step="0.01"
                      value={svc.price}
                      onChange={(e) => updateCreditService(idx, "price", e.target.value)}
                      className="w-28"
                      readOnly={!!cartItems && cartItems.length > 0}
                    />
                    {creditServices.length > 1 && !(cartItems && cartItems.length > 0) && (
                      <button
                        type="button"
                        onClick={() => removeCreditService(idx)}
                        className="text-gray-400 hover:text-red-500 text-lg leading-none"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!(cartItems && cartItems.length > 0) && (
                <button
                  type="button"
                  onClick={addCreditService}
                  className="text-sm text-blue-600 hover:underline mt-1"
                >
                  + Add another service
                </button>
              )}
            </div>
            {totalCredits > 0 && (
              <div className="space-y-1 pt-2 border-t text-sm">
                {cashTopup > 0 ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Credits from package</span>
                      <span>{remaining}</span>
                    </div>
                    <div className="flex justify-between text-amber-700 font-medium">
                      <span>Cash top-up required</span>
                      <span>{cashTopup}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total</span>
                      <span>{totalCredits}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between font-semibold">
                    <span>Total Credits to Deduct</span>
                    <span>{totalCredits}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : hasItems ? (
          <div className="space-y-2">
            <Label>Select services and quantity to deduct</Label>
            <div className="space-y-1.5">
              {items.map((item) => {
                const exhausted = item.remaining_uses <= 0;
                const count = itemCounts.get(item.id) ?? 0;
                const selected = count > 0;
                const notInCart = cartServiceNames != null &&
                  !cartServiceNames.some((n) => n.trim().toLowerCase() === item.service_name.trim().toLowerCase());
                return (
                  <div
                    key={item.id}
                    className={[
                      "w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
                      exhausted ? "opacity-40 cursor-not-allowed bg-gray-50" : "",
                      selected && hasInvalidSelection && notInCart
                        ? "border-red-500 bg-red-50"
                        : selected
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200",
                    ].join(" ")}
                  >
                    <span className={selected ? "font-medium" : ""}>{item.service_name}</span>
                    <div className="flex items-center gap-2">
                      {notInCart && selected && <span className="text-xs text-amber-600 font-medium">not in cart</span>}
                      <Badge
                        variant={
                          exhausted ? "destructive" : item.remaining_uses <= 1 ? "secondary" : "default"
                        }
                      >
                        {item.remaining_uses}/{item.total_uses} left
                      </Badge>
                      {/* Stepper */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={exhausted || count === 0}
                          onClick={() => adjustCount(item.id, -1, item.remaining_uses)}
                          className="w-6 h-6 rounded border text-sm font-bold flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >−</button>
                        <span className="w-5 text-center text-sm font-semibold">{count}</span>
                        <button
                          type="button"
                          disabled={exhausted || count >= item.remaining_uses}
                          onClick={() => adjustCount(item.id, +1, item.remaining_uses)}
                          className="w-6 h-6 rounded border text-sm font-bold flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >+</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {hasInvalidSelection && (
              <p className="text-sm text-red-600">
                The following services are not in the current cart: <strong>{invalidSelectedItems.map((i) => i.service_name).join(", ")}</strong>. Please set their count to 0 before confirming.
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Uses to deduct (max {customerPackage?.remaining_uses ?? 0}):</span>
            <Input
              type="number"
              min={1}
              max={customerPackage?.remaining_uses ?? 1}
              value={legacyCount}
              onChange={(e) => setLegacyCount(Math.min(Math.max(1, parseInt(e.target.value) || 1), customerPackage?.remaining_uses ?? 1))}
              className="w-20"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="used_at">Used Date & Time</Label>
          <Input id="used_at" type="datetime-local" value={usedDateTime} readOnly />
        </div>

        <div className="space-y-2">
          <Label>Notes <span className="text-red-500">*</span></Label>
          <div className="grid grid-cols-2 gap-2">
            {(["Own Use", "Friend Use"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setNoteType(opt)}
                className={`border rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                  noteType === opt ? "border-black bg-black text-white" : "hover:border-gray-400"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          {noteType === "Friend Use" && (
            <Input
              placeholder="Friend's name / details"
              value={friendDetails}
              onChange={(e) => setFriendDetails(e.target.value)}
              autoFocus
            />
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {loading
              ? "Processing..."
              : isCredit
              ? `Confirm — Deduct ${totalCredits > 0 ? Math.min(totalCredits, remaining) : "?"} Credits`
              : hasItems && totalUsesToDeduct > 0
              ? `Confirm — Deduct ${totalUsesToDeduct} Use${totalUsesToDeduct > 1 ? "s" : ""}`
              : hasItems
              ? "Confirm — Deduct Uses"
              : `Confirm — Deduct ${legacyCount} Use${legacyCount > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

