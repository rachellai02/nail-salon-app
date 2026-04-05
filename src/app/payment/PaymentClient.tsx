"use client";

import { useState, useEffect, useId, useRef } from "react";
import { ServiceCategory, Service, Customer, CustomerPackage, Package } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CustomerFormDialog } from "@/components/CustomerFormDialog";
import { ReceiptView } from "@/components/ReceiptView";
import { SellPackageDialog } from "@/components/SellPackageDialog";
import { DeductUseDialog } from "@/components/DeductUseDialog";
import { createTransaction, getPackagesByCustomerId } from "@/lib/actions";
import { X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type CartItem = {
  key: string; // unique per addition (allows duplicate services)
  service: Service;
  qty: string;
  price: string; // unit price — string so user can edit freely
};

type PaymentType = "Cash" | "Card" | "Bank Transfer / QR" | "E-Wallet" | "Package";

const PAYMENT_TYPES: PaymentType[] = [
  "Cash",
  "Card",
  "Bank Transfer / QR",
  "E-Wallet",
  "Package",
];

type DialogStep = "confirm" | "cash-entry" | "success" | "receipt-preview" | "package-deduct" | "extra-payment";

type Props = {
  categories: ServiceCategory[];
  customers: Customer[];
  packages: Package[];
};

const CART_STORAGE_KEY = "payment_cart";
const CUSTOMER_STORAGE_KEY = "payment_customer";

export default function PaymentClient({ categories, customers, packages }: Props) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = sessionStorage.getItem(CART_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch { /* ignore */ }
  }, [cart]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<DialogStep>("confirm");
  const [paymentType, setPaymentType] = useState<PaymentType | null>(null);
  // Customer — selected in the main panel before payment
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = sessionStorage.getItem(CUSTOMER_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as Customer) : null;
    } catch {
      return null;
    }
  });
  const [customerPackages, setCustomerPackages] = useState<CustomerPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  // Restore customer packages when a customer is already selected on mount
  useEffect(() => {
    if (selectedCustomer) {
      setLoadingPackages(true);
      getPackagesByCustomerId(selectedCustomer.id)
        .then((pkgs) => {
          const active = pkgs.filter(
            (p) => !p.completed_at && (
              p.package?.package_type === "credit"
                ? (p.remaining_credits ?? 0) > 0
                : p.remaining_uses > 0
            )
          );
          setCustomerPackages(active);
        })
        .catch(() => setCustomerPackages([]))
        .finally(() => setLoadingPackages(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist selected customer to sessionStorage
  useEffect(() => {
    try {
      if (selectedCustomer) {
        sessionStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(selectedCustomer));
      } else {
        sessionStorage.removeItem(CUSTOMER_STORAGE_KEY);
      }
    } catch { /* ignore */ }
  }, [selectedCustomer]);
  const [pendingSellPackages, setPendingSellPackages] = useState<Package[]>([]);
  const [pendingShowReceipt, setPendingShowReceipt] = useState(false);
  const [deductingPackage, setDeductingPackage] = useState<CustomerPackage | null>(null);
  const [deductedServiceNames, setDeductedServiceNames] = useState<string[]>([]);
  const [extraCartItems, setExtraCartItems] = useState<CartItem[]>([]);
  const [extraPaymentType, setExtraPaymentType] = useState<PaymentType | null>(null);
  const [extraCashReceived, setExtraCashReceived] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [receiptNo, setReceiptNo] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const uid = useId();
  const counterRef = useRef(0);
  const lastDeductedNamesRef = useRef<string[] | null>(null);
  const packageSoldInFlowRef = useRef(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  function addToCart(svc: Service) {
    const key = `${uid}-${counterRef.current++}-${svc.id}`;
    setCart((prev) => [
      ...prev,
      {
        key,
        service: svc,
        qty: "1",
        price: svc.price != null ? String(svc.price) : "",
      },
    ]);
  }

  function removeFromCart(key: string) {
    setCart((prev) => prev.filter((item) => item.key !== key));
  }

  function updatePrice(key: string, value: string) {
    setCart((prev) =>
      prev.map((item) => (item.key === key ? { ...item, price: value } : item))
    );
  }

  function updateQty(key: string, value: string) {
    setCart((prev) =>
      prev.map((item) => (item.key === key ? { ...item, qty: value } : item))
    );
  }

  function clearCart() {
    setCart([]);
    try { sessionStorage.removeItem(CART_STORAGE_KEY); } catch { /* ignore */ }
  }

  function openPaymentDialog() {
    setPaymentType(null);
    setDialogStep("confirm");
    setCashReceived("");
    setDeductedServiceNames([]);
    setExtraCartItems([]);
    setExtraPaymentType(null);
    setExtraCashReceived("");
    packageSoldInFlowRef.current = false;
    setDialogOpen(true);
  }

  function generateReceiptNo(): string {
    try {
      const stored = localStorage.getItem("receipt_counter");
      const current = stored ? parseInt(stored, 10) : 11111110;
      const next = current + 1;
      localStorage.setItem("receipt_counter", String(next));
      return String(next);
    } catch {
      return "11111111";
    }
  }

  function handlePay() {
    if (paymentType === "Cash") {
      setCashReceived("");
      setDialogStep("cash-entry");
    } else if (paymentType === "Package") {
      setDialogStep("package-deduct");
    } else {
      setReceiptNo(generateReceiptNo());
      setReceiptDate(
        new Date().toLocaleString("en-MY", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
      setDialogStep("success");
    }
  }

  async function handleDeductClose() {
    const names = lastDeductedNamesRef.current;
    lastDeductedNamesRef.current = null;
    setDeductingPackage(null);
    // Re-fetch so the panel and receipt reflect updated uses
    if (selectedCustomer) {
      try {
        const pkgs = await getPackagesByCustomerId(selectedCustomer.id);
        const active = pkgs.filter(
          (p) => !p.completed_at && (
            p.package?.package_type === "credit"
              ? (p.remaining_credits ?? 0) > 0
              : p.remaining_uses > 0
          )
        );
        setCustomerPackages(active);
      } catch { /* keep existing */ }
    }
    if (names !== null) {
      // Deduction was confirmed — skip back to package list and go straight to extra payment check
      const allDeducted = new Set([...deductedServiceNames, ...names]);
      const extras = cart.filter((item) => !allDeducted.has(item.service.name));
      if (extras.length > 0) {
        setExtraCartItems(extras);
        setExtraPaymentType(null);
        setExtraCashReceived("");
        setDialogStep("extra-payment");
      } else {
        setReceiptNo(generateReceiptNo());
        setReceiptDate(
          new Date().toLocaleString("en-MY", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        );
        setDialogStep("success");
      }
    }
  }

  function handlePackageDeductDone() {
    // Detect cart items whose service name was not deducted from any package
    const deductedSet = new Set(deductedServiceNames);
    const extras = cart.filter((item) => !deductedSet.has(item.service.name));
    if (extras.length > 0) {
      setExtraCartItems(extras);
      setExtraPaymentType(null);
      setExtraCashReceived("");
      setDialogStep("extra-payment");
    } else {
      setReceiptNo(generateReceiptNo());
      setReceiptDate(
        new Date().toLocaleString("en-MY", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
      setDialogStep("success");
    }
  }

  function handleExtraPaymentConfirm() {
    setReceiptNo(generateReceiptNo());
    setReceiptDate(
      new Date().toLocaleString("en-MY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    );
    setDialogStep("success");
  }

  function handleCashConfirm() {
    setReceiptNo(generateReceiptNo());
    setReceiptDate(
      new Date().toLocaleString("en-MY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    );
    setDialogStep("success");
  }

  async function handleCustomerSelect(c: Customer) {
    setSelectedCustomer(c);
    setCustomerQuery("");
    setLoadingPackages(true);
    try {
      const pkgs = await getPackagesByCustomerId(c.id);
      const active = pkgs.filter(
        (p) => !p.completed_at && (
          p.package?.package_type === "credit"
            ? (p.remaining_credits ?? 0) > 0
            : p.remaining_uses > 0
        )
      );
      setCustomerPackages(active);
    } catch {
      setCustomerPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  }

  function handleCustomerClear() {
    setSelectedCustomer(null);
    setCustomerPackages([]);
    setCustomerQuery("");
  }

  function handleSendReceipt() {
    // If cart contains packages and a customer is selected, sell packages first
    if (selectedCustomer) {
      const seen = new Set<string>();
      const matched: Package[] = [];
      for (const item of cart) {
        const pkg = packages.find((p) => p.name === item.service.name && p.is_active);
        if (pkg && !seen.has(pkg.id)) {
          seen.add(pkg.id);
          matched.push(pkg);
        }
      }
      if (matched.length > 0) {
        packageSoldInFlowRef.current = true;
        setPendingSellPackages(matched);
        setPendingShowReceipt(true);
        return; // receipt shown after all package dialogs close
      }
    }
    setDialogStep("receipt-preview");
  }

  async function handleSellPackageDialogClose() {
    const newQueue = pendingSellPackages.slice(1);
    setPendingSellPackages(newQueue);
    if (newQueue.length === 0 && pendingShowReceipt) {
      setPendingShowReceipt(false);
      // Re-fetch so receipt reflects newly assigned packages
      if (selectedCustomer) {
        try {
          const pkgs = await getPackagesByCustomerId(selectedCustomer.id);
          const active = pkgs.filter(
            (p) => !p.completed_at && (
              p.package?.package_type === "credit"
                ? (p.remaining_credits ?? 0) > 0
                : p.remaining_uses > 0
            )
          );
          setCustomerPackages(active);
        } catch { /* keep existing */ }
      }
      setDialogStep("receipt-preview");
    }
  }

  async function handleDoSend() {
    const isPackagePayment = packageSoldInFlowRef.current;
    try {
      await createTransaction({
        receipt_no: receiptNo,
        payment_type: isPackagePayment
          ? `Package Sale - ${extraPaymentType ?? paymentType ?? ""}`
          : extraPaymentType ? `Package + ${extraPaymentType}` : (paymentType ?? ""),
        total,
        cash_received: extraPaymentType === "Cash" && extraCashReceived
          ? parseFloat(extraCashReceived)
          : paymentType === "Cash" && cashReceived ? parseFloat(cashReceived) : null,
        change_given: extraPaymentType === "Cash" && extraCashReceived
          ? Math.max(0, parseFloat(extraCashReceived) - extraTotal)
          : paymentType === "Cash" && cashReceived ? Math.max(0, parseFloat(cashReceived) - total) : null,
        customer_id: selectedCustomer?.id ?? null,
        customer_name: selectedCustomer?.name || null,
        customer_phone: selectedCustomer?.contact_number || null,
        items: cart.map((item) => ({
          service_name: item.service.name,
          qty: parseFloat(item.qty) || 1,
          unit_price: parseFloat(item.price) || 0,
          subtotal: (parseFloat(item.qty) || 1) * (parseFloat(item.price) || 0),
        })),
        receipt_snapshot: {
          customerPackages: customerPackages.length > 0 ? customerPackages : undefined,
          extraPaymentType: extraPaymentType ?? undefined,
          extraTotal: extraCartItems.length > 0 ? extraTotal : undefined,
          extraCashReceived: extraPaymentType === "Cash" && extraCashReceived ? parseFloat(extraCashReceived) : undefined,
          extraChangeGiven: extraPaymentType === "Cash" && extraCashReceived ? Math.max(0, parseFloat(extraCashReceived) - extraTotal) : undefined,
        },
      });
    } catch {
      // non-blocking — receipt still saves even if DB write fails
    }
    const msg = selectedCustomer
      ? `Receipt saved for ${selectedCustomer.name}.`
      : "Receipt saved.";
    toast.success(msg);
    setDialogOpen(false);
    setSelectedCustomer(null);
    clearCart();
  }

  function handleDialogClose(open: boolean) {
    if (!open) {
      if (dialogStep === "success" || dialogStep === "receipt-preview") {
        // X is hidden on these steps; also block outside-click close
        return;
      }
      setCloseConfirmOpen(true);
    }
  }

  const filteredCustomers = customerQuery.trim() === "" ? [] : customers
    .filter((c) => {
      const q = customerQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.contact_number.includes(q);
    })
    .slice(0, 8);

  const total = cart.reduce((sum, item) => {
    const p = parseFloat(item.price);
    const q = parseFloat(item.qty);
    return sum + (isNaN(p) || isNaN(q) ? 0 : p * q);
  }, 0);

  const extraTotal = extraCartItems.reduce((sum, item) => {
    const p = parseFloat(item.price);
    const q = parseFloat(item.qty);
    return sum + (isNaN(p) || isNaN(q) ? 0 : p * q);
  }, 0);

  const totalQty = cart.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);

  const hasEmptyPrice = cart.some((item) => item.price.trim() === "" || isNaN(parseFloat(item.price)));

  return (
    <div className="flex h-[calc(100vh-65px)] overflow-hidden -mx-6 -my-8">
      {/* Left 60% — service catalogue */}
      <div className="w-[60%] border-r overflow-y-auto p-6 space-y-6">
        <h2 className="text-xl font-bold">Services</h2>
        {categories.length === 0 && (
          <p className="text-gray-400 text-sm">No services configured yet.</p>
        )}
        {categories.map((cat) => (
          <div key={cat.id}>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {cat.name}
            </h3>
            <div className="flex flex-wrap gap-2">
              {(cat.services ?? []).length === 0 ? (
                <p className="text-gray-400 text-xs">No services.</p>
              ) : (
                (cat.services ?? []).map((svc) => (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => addToCart(svc)}
                    className="flex items-center justify-between gap-4 border rounded-lg px-4 py-2 text-sm hover:border-gray-400 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                  >
                    <span className="font-medium">{svc.name}</span>
                    <span className="text-gray-500 whitespace-nowrap">
                      {svc.price != null ? svc.price.toFixed(2) : "Set at payment"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Right 40% — payment panel */}
      <div className="w-[40%] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold">Payment</h2>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Customer selector + active packages */}
        <div className="px-6 py-3 border-b space-y-2">
          <p className="text-sm font-semibold text-gray-700">Customer</p>
          {!selectedCustomer ? (
            <>
              <Input
                placeholder="Search by name or phone…"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
              />
              {filteredCustomers.length > 0 && (
                <div className="border rounded-lg divide-y max-h-36 overflow-y-auto">
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => void handleCustomerSelect(c)}
                      className="w-full text-left px-3 py-2 text-sm flex justify-between hover:bg-gray-50 transition-colors"
                    >
                      <span>{c.name}</span>
                      <span className="text-gray-400">{c.contact_number}</span>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setRegisterOpen(true)}
                className="text-xs text-blue-600 hover:underline"
              >
                + New customer
              </button>
            </>
          ) : (
            <>
              <div className="border rounded-lg px-3 py-2 text-sm bg-gray-50 flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedCustomer.name}</p>
                  <p className="text-gray-500">{selectedCustomer.contact_number}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCustomerClear}
                  className="text-xs text-gray-400 hover:text-gray-600 ml-3 flex-shrink-0"
                >
                  Change
                </button>
              </div>

              {loadingPackages && (
                <p className="text-xs text-gray-400">Loading packages…</p>
              )}
              {!loadingPackages && customerPackages.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active Packages</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {customerPackages.map((cp) => (
                      <div key={cp.id} className="border rounded-lg px-3 py-2 bg-white">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">{cp.package?.name ?? "Package"}</span>
                          <span className="text-xs text-gray-400 capitalize">{cp.package?.package_type ?? "services"}</span>
                        </div>
                        {cp.package?.package_type === "credit" ? (
                          <p className="text-xs text-gray-600">
                            Credits: <span className="font-semibold">{(cp.remaining_credits ?? 0).toFixed(2)}</span> remaining
                          </p>
                        ) : (
                          <ul className="space-y-0.5">
                            {(cp.items ?? []).map((item) => (
                              <li key={item.id} className="flex justify-between text-xs text-gray-600">
                                <span>{item.service_name}</span>
                                <span className={item.remaining_uses === 0 ? "text-gray-300" : "font-semibold"}>
                                  {item.remaining_uses}/{item.total_uses} left
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!loadingPackages && customerPackages.length === 0 && (
                <p className="text-xs text-gray-400">No active packages.</p>
              )}
            </>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {cart.length === 0 ? (
            <p className="text-gray-400 text-sm text-center mt-12">
              Select services from the left to add them here.
            </p>
          ) : (
            <>
              {/* Column headers */}
              <div className="flex items-center gap-3 text-xs text-gray-400 font-medium pb-1 border-b">
                <span className="flex-1">Service</span>
                <span className="w-13 text-center">Qty</span>
                <span className="w-15 text-center">Unit Price</span>
                <span className="w-4"></span>
              </div>
              {cart.map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  {/* Service name */}
                  <span className="flex-1 text-sm truncate">{item.service.name}</span>
                  {/* Qty input */}
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    value={item.qty}
                    onChange={(e) => updateQty(item.key, e.target.value)}
                    className="w-13 text-center px-1"
                  />
                  {/* Price input */}
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Price"
                    value={item.price}
                    onChange={(e) => updatePrice(item.key, e.target.value)}
                    className={`w-15 ${item.price.trim() === "" || isNaN(parseFloat(item.price)) ? "border-amber-400 focus-visible:border-amber-400" : ""}`}
                  />
                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.key)}
                    className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Total footer */}
        {cart.length > 0 && (
          <div className="border-t px-6 py-4 space-y-3">
            {hasEmptyPrice && (
              <p className="text-xs text-amber-600">Some prices are not filled in.</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold">Total</span>
              <span className="text-xl font-bold">{total.toFixed(2)}</span>
            </div>
            <Button className="w-full" disabled={hasEmptyPrice} onClick={openPaymentDialog}>
              Create Payment
            </Button>
          </div>
        )}
      </div>

      {/* Payment dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent
          className="w-[min(50dvw,calc(100dvw-2rem))] max-w-none"
          showCloseButton={dialogStep !== "success" && dialogStep !== "receipt-preview"}
        >

          {dialogStep === "cash-entry" && (
            <>
              <DialogHeader>
                <DialogTitle>Cash Payment</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total</span>
                  <span className="font-bold text-base">RM {total.toFixed(2)}</span>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-600">Cash Received (RM)</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    autoFocus
                  />
                </div>

                {cashReceived !== "" && !isNaN(parseFloat(cashReceived)) && (
                  <div className="flex justify-between rounded-lg bg-gray-50 px-4 py-3">
                    <span className="font-medium">Change</span>
                    <span className="font-bold text-lg">
                      RM {Math.max(0, parseFloat(cashReceived) - total).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                disabled={!cashReceived || isNaN(parseFloat(cashReceived)) || parseFloat(cashReceived) < total}
                onClick={handleCashConfirm}
              >
                Confirm
              </Button>
            </>
          )}
          {dialogStep === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle>Confirm Payment</DialogTitle>
              </DialogHeader>

              {/* Order summary */}
              <div className="text-sm max-h-48 overflow-y-auto">
                <div className="flex gap-2 text-xs text-gray-400 font-medium pb-1 border-b mb-1">
                  <span className="flex-1">Service</span>
                  <span className="w-10 text-center">Qty</span>
                  <span className="w-16 text-right">Price</span>
                </div>
                {cart.map((item) => {
                  const p = parseFloat(item.price);
                  const q = parseFloat(item.qty);
                  const subtotal = isNaN(p) || isNaN(q) ? 0 : p * q;
                  return (
                    <div key={item.key} className="flex gap-2 py-0.5">
                      <span className="flex-1 truncate text-gray-700">{item.service.name}</span>
                      <span className="w-10 text-center text-gray-500">{item.qty}</span>
                      <span className="w-16 text-right font-medium">{subtotal.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center border-t pt-3 font-bold">
                <span>Total</span>
                <span className="text-lg">{total.toFixed(2)}</span>
              </div>

              {/* Payment type */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Payment type</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPaymentType(type)}
                      className={`border rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                        paymentType === type
                          ? "border-black bg-black text-white"
                          : "hover:border-gray-400"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <Button className="w-full mt-1" disabled={!paymentType} onClick={handlePay}>
                Pay
              </Button>
            </>
          )}

          {dialogStep === "package-deduct" && (
            <>
              <DialogHeader>
                <DialogTitle>Deduct Package Uses</DialogTitle>
              </DialogHeader>

              {customerPackages.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">
                  No active packages found for this customer.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Tap a package to deduct uses for it.</p>
                  {customerPackages.map((cp) => (
                    <button
                      key={cp.id}
                      type="button"
                      onClick={() => setDeductingPackage(cp)}
                      className="w-full text-left border rounded-lg px-3 py-2 text-sm hover:border-gray-400 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">{cp.package?.name ?? "Package"}</span>
                        <span className="text-xs text-gray-400 capitalize">{cp.package?.package_type ?? "services"}</span>
                      </div>
                      {cp.package?.package_type === "credit" ? (
                        <p className="text-xs text-gray-600">
                          Credits: <span className="font-semibold">{(cp.remaining_credits ?? 0).toFixed(2)}</span> remaining
                        </p>
                      ) : (
                        <ul className="space-y-0.5">
                          {(cp.items ?? []).map((item) => (
                            <li key={item.id} className="flex justify-between text-xs text-gray-600">
                              <span>{item.service_name}</span>
                              <span className={item.remaining_uses === 0 ? "text-gray-300" : "font-semibold"}>
                                {item.remaining_uses}/{item.total_uses} left
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <Button className="w-full mt-2" onClick={handlePackageDeductDone}>
                Done — Proceed to Receipt
              </Button>
            </>
          )}

          {dialogStep === "extra-payment" && (
            <>
              <DialogHeader>
                <DialogTitle>Additional Payment Required</DialogTitle>
              </DialogHeader>

              <p className="text-sm text-gray-500">
                These services are not covered by the package and require an extra payment:
              </p>

              <div className="text-sm max-h-40 overflow-y-auto">
                <div className="flex gap-2 text-xs text-gray-400 font-medium pb-1 border-b mb-1">
                  <span className="flex-1">Service</span>
                  <span className="w-10 text-center">Qty</span>
                  <span className="w-16 text-right">Price</span>
                </div>
                {extraCartItems.map((item) => {
                  const p = parseFloat(item.price);
                  const q = parseFloat(item.qty);
                  const sub = isNaN(p) || isNaN(q) ? 0 : p * q;
                  return (
                    <div key={item.key} className="flex gap-2 py-0.5">
                      <span className="flex-1 truncate text-gray-700">{item.service.name}</span>
                      <span className="w-10 text-center text-gray-500">{item.qty}</span>
                      <span className="w-16 text-right font-medium">{sub.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center border-t pt-2 font-bold">
                <span>Extra Total</span>
                <span>RM {extraTotal.toFixed(2)}</span>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Payment type</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_TYPES.filter((t) => t !== "Package").map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setExtraPaymentType(type)}
                      className={`border rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                        extraPaymentType === type
                          ? "border-black bg-black text-white"
                          : "hover:border-gray-400"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {extraPaymentType === "Cash" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Cash Received (RM)</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={extraCashReceived}
                    onChange={(e) => setExtraCashReceived(e.target.value)}
                    autoFocus
                  />
                  {extraCashReceived !== "" && !isNaN(parseFloat(extraCashReceived)) && (
                    <div className="flex justify-between rounded-lg bg-gray-50 px-4 py-3">
                      <span className="font-medium">Change</span>
                      <span className="font-bold text-lg">
                        RM {Math.max(0, parseFloat(extraCashReceived) - extraTotal).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDialogStep("package-deduct")}
                >
                  ← Back to Package
                </Button>
                <Button
                  className="flex-1"
                  disabled={
                    !extraPaymentType ||
                    (extraPaymentType === "Cash" &&
                      (!extraCashReceived ||
                        isNaN(parseFloat(extraCashReceived)) ||
                        parseFloat(extraCashReceived) < extraTotal))
                  }
                  onClick={handleExtraPaymentConfirm}
                >
                  Confirm Extra Payment
                </Button>
              </div>
            </>
          )}

          {dialogStep === "success" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 size={56} className="text-green-500" />
              <div>
                <p className="text-xl font-bold">Payment Successful</p>
                <p className="text-sm text-gray-400 mt-1">
                  {paymentType} · {total.toFixed(2)}
                </p>
              </div>
              <Button className="w-full" onClick={handleSendReceipt}>
                Next
              </Button>
            </div>
          )}

          {dialogStep === "receipt-preview" && (
            <>
              <DialogHeader>
                <DialogTitle>Receipt Preview</DialogTitle>
              </DialogHeader>

              {selectedCustomer && (
                <div className="border rounded-lg px-3 py-2 text-sm bg-gray-50 flex items-center gap-3">
                  <div>
                    <p className="font-medium">{selectedCustomer.name}</p>
                    <p className="text-gray-500">{selectedCustomer.contact_number}</p>
                  </div>
                </div>
              )}

              <ReceiptView
                receiptNo={receiptNo}
                date={receiptDate}
                items={cart.map((item) => {
                  const p = parseFloat(item.price);
                  const q = parseFloat(item.qty);
                  return {
                    qty: isNaN(q) ? 0 : q,
                    name: item.service.name,
                    subtotal: isNaN(p) || isNaN(q) ? 0 : p * q,
                  };
                })}
                paymentType={paymentType ?? ""}
                total={total}
                cashReceived={paymentType === "Cash" ? parseFloat(cashReceived) : null}
                changeGiven={
                  paymentType === "Cash"
                    ? Math.max(0, parseFloat(cashReceived) - total)
                    : null
                }
                extraPaymentType={extraPaymentType ?? undefined}
                extraTotal={extraCartItems.length > 0 ? extraTotal : undefined}
                extraCashReceived={
                  extraPaymentType === "Cash" && extraCashReceived
                    ? parseFloat(extraCashReceived)
                    : undefined
                }
                extraChangeGiven={
                  extraPaymentType === "Cash" && extraCashReceived
                    ? Math.max(0, parseFloat(extraCashReceived) - extraTotal)
                    : undefined
                }
                customerPackages={customerPackages.length > 0 ? customerPackages : undefined}
              />

              <Button className="w-full" onClick={handleDoSend}>
                {selectedCustomer ? `Save & Send to ${selectedCustomer.name}` : "Save Receipt"}
              </Button>
            </>
          )}

        </DialogContent>
      </Dialog>

      {/* Register new customer (opens on top of payment dialog) */}
      <CustomerFormDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onCreated={(newCustomer) => {
          void handleCustomerSelect(newCustomer);
          setRegisterOpen(false);
        }}
      />

      {/* Post-payment: sell matched package(s) to the customer */}
      <SellPackageDialog
        open={pendingSellPackages.length > 0}
        onClose={() => void handleSellPackageDialogClose()}
        packages={packages}
        customers={customers}
        defaultCustomerId={selectedCustomer?.id}
        defaultPackageId={pendingSellPackages[0]?.id}
        defaultPaymentType={paymentType ?? undefined}
        skipTransaction
      />

      {/* Deduct use from a package during Package payment */}
      <DeductUseDialog
        open={deductingPackage !== null}
        onClose={() => void handleDeductClose()}
        onDeducted={(names) => {
        lastDeductedNamesRef.current = names;
        setDeductedServiceNames((prev) => [...prev, ...names]);
      }}
        customerPackage={deductingPackage}
        cartServiceNames={cart.map((item) => item.service.name)}
        cartItems={cart.map((item) => ({ service_name: item.service.name, price: item.price, qty: item.qty }))}
      />

      {/* Cancel payment confirmation */}
      <Dialog open={closeConfirmOpen} onOpenChange={(v) => { if (!v) setCloseConfirmOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel payment?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">The current payment will be discarded. Are you sure?</p>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setCloseConfirmOpen(false)}>Keep editing</Button>
            <Button variant="destructive" onClick={() => { setCloseConfirmOpen(false); setDialogOpen(false); }}>Discard payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
