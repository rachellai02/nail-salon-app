"use client";

import { useState, useEffect, useId, useRef } from "react";
import { ServiceCategory, Service, Customer, CustomerPackage, Package, Employee } from "@/lib/types";
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
import { createTransaction, getPackagesByCustomerId, getNextReceiptNo } from "@/lib/actions";
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
  employees: Employee[];
};

const CART_STORAGE_KEY = "payment_cart";
const CUSTOMER_STORAGE_KEY = "payment_customer";

export default function PaymentClient({ categories, customers, packages, employees }: Props) {
  const [cart, setCart] = useState<CartItem[]>([]);

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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
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
  const [pendingSellPackages, setPendingSellPackages] = useState<{ pkg: Package; qty: number }[]>([]);
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
  const lastCreditTopupRef = useRef<number>(0);
  const packageSoldInFlowRef = useRef(false);
  const isTopupDeductRef = useRef(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [extraCreditTopup, setExtraCreditTopup] = useState<number | null>(null);
  const [extraTopupPackage, setExtraTopupPackage] = useState<CustomerPackage | null>(null);
  const [packageDeductions, setPackageDeductions] = useState<{ packageName: string; amount: number }[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    try {
      const savedCart = sessionStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) setCart(JSON.parse(savedCart) as CartItem[]);
      const savedCustomer = sessionStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (savedCustomer) setSelectedCustomer(JSON.parse(savedCustomer) as Customer);
    } catch { /* ignore */ }
  }, []);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [sending, setSending] = useState(false);

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

  function updateServiceName(key: string, name: string) {
    setCart((prev) =>
      prev.map((item) => (item.key === key ? { ...item, service: { ...item.service, name } } : item))
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
    setExtraCreditTopup(null);
    setExtraTopupPackage(null);
    setExtraPaymentType(null);
    setExtraCashReceived("");
    setPackageDeductions([]);
    packageSoldInFlowRef.current = false;
    setDialogOpen(true);
  }

  async function fetchReceiptNo(): Promise<string> {
    try {
      return await getNextReceiptNo();
    } catch {
      return String(Date.now());
    }
  }

  function currentReceiptDate(): string {
    return new Date().toLocaleString("en-MY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  async function handlePay() {
    if (paymentType === "Cash") {
      setCashReceived("");
      setDialogStep("cash-entry");
    } else if (paymentType === "Package") {
      setDialogStep("package-deduct");
    } else {
      setReceiptNo(await fetchReceiptNo());
      setReceiptDate(currentReceiptDate());
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
      // If this was a topup/extra-package deduction
      if (isTopupDeductRef.current) {
        isTopupDeductRef.current = false;
        const topup = lastCreditTopupRef.current;
        lastCreditTopupRef.current = 0;

        // Credit topup case (paying shortfall with another package)
        if (extraCreditTopup !== null) {
          // The topup package also ran short — loop back with the new remaining shortfall
          if (topup > 0) {
            setExtraCreditTopup(topup);
            setExtraPaymentType(null);
            setExtraTopupPackage(null);
            setExtraCashReceived("");
            setDialogStep("extra-payment");
            return;
          }
          // Shortfall fully covered → success
          setExtraCreditTopup(null);
          setReceiptNo(await fetchReceiptNo());
          setReceiptDate(currentReceiptDate());
          setDialogStep("success");
          return;
        }

        // Extra-items credit package ran short → trigger credit topup flow for the shortfall
        if (topup > 0) {
          setExtraCreditTopup(topup);
          setExtraPaymentType(null);
          setExtraTopupPackage(null);
          setExtraCashReceived("");
          setDialogStep("extra-payment");
          return;
        }

        // Extra-items package deduction completed → check if any extra items still uncovered (quantity-aware)
        const deductCounts1 = new Map<string, number>();
        for (const n of [...deductedServiceNames, ...names]) {
          const k = n.trim().toLowerCase();
          deductCounts1.set(k, (deductCounts1.get(k) ?? 0) + 1);
        }
        const remaining = [] as typeof cart;
        for (const item of extraCartItems) {
          const k = item.service.name.trim().toLowerCase();
          const avail = deductCounts1.get(k) ?? 0;
          const needed = Math.max(1, Math.round(parseFloat(item.qty) || 1));
          if (avail <= 0) {
            remaining.push(item);
          } else if (avail >= needed) {
            deductCounts1.set(k, avail - needed);
          } else {
            deductCounts1.set(k, 0);
            remaining.push({ ...item, qty: String(needed - avail) });
          }
        }
        if (remaining.length > 0) {
          setExtraCartItems(remaining);
          setExtraPaymentType(null);
          setExtraTopupPackage(null);
          setExtraCashReceived("");
          setDialogStep("extra-payment");
        } else {
          setReceiptNo(await fetchReceiptNo());
          setReceiptDate(currentReceiptDate());
          setDialogStep("success");
        }
        return;
      }
      // If credit top-up is required, go straight to extra-payment for the shortfall
      const topup = lastCreditTopupRef.current;
      lastCreditTopupRef.current = 0;
      if (topup > 0) {
        setExtraCreditTopup(topup);
        setExtraCartItems([]);
        setExtraPaymentType(null);
        setExtraCashReceived("");
        setDialogStep("extra-payment");
        return;
      }
      // Deduction confirmed — check if fully covered; if not, return to package list so the
      // user can deduct from another package before clicking "Done".
      const deductCounts2 = new Map<string, number>();
      for (const n of [...deductedServiceNames, ...names]) {
        const k = n.trim().toLowerCase();
        deductCounts2.set(k, (deductCounts2.get(k) ?? 0) + 1);
      }
      let allCovered = true;
      for (const item of cart) {
        const k = item.service.name.trim().toLowerCase();
        const avail = deductCounts2.get(k) ?? 0;
        const needed = Math.max(1, Math.round(parseFloat(item.qty) || 1));
        if (avail < needed) { allCovered = false; break; }
        deductCounts2.set(k, avail - needed);
      }
      if (allCovered) {
        setReceiptNo(await fetchReceiptNo());
        setReceiptDate(currentReceiptDate());
        setDialogStep("success");
      } else {
        // Return to package list — user may deduct from another package
        setDialogStep("package-deduct");
      }
    }
  }

  async function handlePackageDeductDone() {
    // Detect cart items whose service name was not deducted from any package (quantity-aware)
    const deductCounts = new Map<string, number>();
    for (const n of deductedServiceNames) {
      const k = n.trim().toLowerCase();
      deductCounts.set(k, (deductCounts.get(k) ?? 0) + 1);
    }
    const extras = [] as typeof cart;
    for (const item of cart) {
      const k = item.service.name.trim().toLowerCase();
      const avail = deductCounts.get(k) ?? 0;
      const needed = Math.max(1, Math.round(parseFloat(item.qty) || 1));
      if (avail <= 0) {
        extras.push(item);
      } else if (avail >= needed) {
        deductCounts.set(k, avail - needed);
      } else {
        deductCounts.set(k, 0);
        extras.push({ ...item, qty: String(needed - avail) });
      }
    }
    if (extras.length > 0) {
      setExtraCartItems(extras);
      setExtraPaymentType(null);
      setExtraCashReceived("");
      setDialogStep("extra-payment");
    } else {
      setReceiptNo(await fetchReceiptNo());
      setReceiptDate(currentReceiptDate());
      setDialogStep("success");
    }
  }

  async function handleExtraPaymentConfirm() {
    setReceiptNo(await fetchReceiptNo());
    setReceiptDate(currentReceiptDate());
    setDialogStep("success");
  }

  async function handleCashConfirm() {
    setReceiptNo(await fetchReceiptNo());
    setReceiptDate(currentReceiptDate());
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
      const seen = new Map<string, { pkg: Package; qty: number }>();
      for (const item of cart) {
        const pkg = packages.find((p) => p.name === item.service.name && p.is_active);
        if (pkg) {
          const qty = Math.max(1, Math.round(parseFloat(item.qty) || 1));
          const existing = seen.get(pkg.id);
          seen.set(pkg.id, { pkg, qty: (existing?.qty ?? 0) + qty });
        }
      }
      const matched = [...seen.values()];
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
    setSending(true);
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
          extraTotal: (extraCartItems.length > 0 || extraCreditTopup !== null) ? extraTotal : undefined,
          extraCashReceived: extraPaymentType === "Cash" && extraCashReceived ? parseFloat(extraCashReceived) : undefined,
          extraChangeGiven: extraPaymentType === "Cash" && extraCashReceived ? Math.max(0, parseFloat(extraCashReceived) - extraTotal) : undefined,
          packageDeductions: packageDeductions.length > 0 ? packageDeductions : undefined,
          transactionBy: selectedEmployee?.nickname ?? selectedEmployee?.name ?? undefined,
        },
      });
    } catch {
      // non-blocking — receipt still saves even if DB write fails
    }
    // Send receipt PDF via WhatsApp if customer has a phone number
    if (selectedCustomer?.contact_number) {
      try {
        const payload = {
          phone: selectedCustomer.contact_number,
          customerName: selectedCustomer.name,
          receiptNo,
          date: receiptDate,
          transactionBy: selectedEmployee?.nickname ?? selectedEmployee?.name ?? undefined,
          items: cart.map((item) => ({
            qty: parseFloat(item.qty) || 1,
            name: item.service.name,
            subtotal: (parseFloat(item.qty) || 1) * (parseFloat(item.price) || 0),
          })),
          paymentType: isPackagePayment
            ? `Package Sale - ${extraPaymentType ?? paymentType ?? ""}`
            : extraPaymentType ? `Package + ${extraPaymentType}` : (paymentType ?? ""),
          total,
          cashReceived: paymentType === "Cash" && cashReceived ? parseFloat(cashReceived) : null,
          changeGiven: paymentType === "Cash" && cashReceived ? Math.max(0, parseFloat(cashReceived) - total) : null,
          extraPaymentType: extraPaymentType ?? undefined,
          extraTotal: (extraCartItems.length > 0 || extraCreditTopup !== null) ? extraTotal : undefined,
          extraCashReceived: extraPaymentType === "Cash" && extraCashReceived ? parseFloat(extraCashReceived) : undefined,
          extraChangeGiven: extraPaymentType === "Cash" && extraCashReceived ? Math.max(0, parseFloat(extraCashReceived) - extraTotal) : undefined,
          packageDeductions: packageDeductions.length > 0 ? packageDeductions : undefined,
          customerPackages: customerPackages.length > 0 ? customerPackages.map((cp) => ({
            name: cp.package?.name ?? "Package",
            packageType: cp.package?.package_type ?? "services",
            remainingCredits: cp.remaining_credits ?? undefined,
            items: cp.items?.map((i) => ({
              service_name: i.service_name,
              remaining_uses: i.remaining_uses,
              total_uses: i.total_uses,
            })),
            customerCode: cp.customer?.customer_code,
            customerName: cp.customer?.name,
            customerPhone: cp.customer?.contact_number,
          })) : undefined,
        };
        const res = await fetch("/api/send-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const { error } = await res.json() as { error: string };
          toast.error(`Receipt saved, but WhatsApp send failed: ${error}`);
        } else {
          toast.success(`Receipt sent to ${selectedCustomer.name} via WhatsApp.`);
        }
      } catch {
        toast.error("Receipt saved, but WhatsApp send failed.");
      }
    } else {
      toast.success("Receipt saved.");
    }
    setSending(false);
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

  const extraTotal = extraCreditTopup !== null
    ? extraCreditTopup
    : extraCartItems.reduce((sum, item) => {
    const p = parseFloat(item.price);
    const q = parseFloat(item.qty);
    return sum + (isNaN(p) || isNaN(q) ? 0 : p * q);
  }, 0);

  const totalQty = cart.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);

  const hasEmptyPrice = cart.some((item) => item.price.trim() === "" || isNaN(parseFloat(item.price)));
  const hasEmptyName = cart.some((item) => item.service.name.trim() === "");

  // Determine if cart currently contains package-sale items or regular service items
  const cartHasPackageSale = cart.some((item) => packages.some((p) => p.name === item.service.name && p.is_active));
  const cartHasService     = cart.some((item) => !packages.some((p) => p.name === item.service.name && p.is_active));

  return (
    <div className="flex h-[calc(100vh-65px)] overflow-hidden -mx-6 -my-8">
      {/* Left 60% — service catalogue */}
      <div className="w-[60%] border-r overflow-y-auto p-6 space-y-6">
        <h2 className="text-xl font-bold">Services</h2>
        {categories.length === 0 && (
          <p className="text-gray-400 text-sm">No services configured yet.</p>
        )}
        {mounted && (!selectedEmployee || !selectedCustomer) && (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Select a collected-by employee and a customer before adding services.
          </p>
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
                    disabled={
                      (mounted && (!selectedEmployee || !selectedCustomer)) ||
                      (packages.some((p) => p.name === svc.name && p.is_active)
                        ? cartHasService
                        : cartHasPackageSale)
                    }
                    onClick={() => addToCart(svc)}
                    className="flex items-center justify-between gap-4 border rounded-lg px-4 py-2 text-sm transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:border-gray-400 hover:enabled:bg-gray-50 active:enabled:bg-gray-100"
                  >
                    <span className="font-medium">{svc.name || "To be filled"}</span>
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
          {mounted && cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Employee selector */}
        <div className="px-6 py-3 border-b space-y-2">
          <p className="text-sm font-semibold text-gray-700">Collected By</p>
          <select
            value={selectedEmployee?.id ?? ""}
            onChange={(e) => {
              const emp = employees.find((emp) => emp.id === e.target.value) ?? null;
              setSelectedEmployee(emp);
            }}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
          >
            <option value="">— Select employee —</option>
            {employees
              .filter((emp) => emp.is_active)
              .map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nickname ?? emp.name}
                </option>
              ))}
          </select>
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
                <span className="w-17 text-center">Unit Price</span>
                <span className="w-4"></span>
              </div>
              {cart.map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  {/* Service name */}
                  {item.service.name === "" ? (
                    <Input
                      placeholder="To be filled"
                      value={item.service.name}
                      onChange={(e) => updateServiceName(item.key, e.target.value)}
                      className="flex-1 text-sm border-amber-400 focus-visible:border-amber-400"
                    />
                  ) : (
                    <span className="flex-1 text-sm truncate">{item.service.name}</span>
                  )}
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
                    className={`w-17 ${item.price.trim() === "" || isNaN(parseFloat(item.price)) ? "border-amber-400 focus-visible:border-amber-400" : ""}`}
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
            {hasEmptyName && (
              <p className="text-xs text-amber-600">Some service names are not filled in.</p>
            )}
            {hasEmptyPrice && !hasEmptyName && (
              <p className="text-xs text-amber-600">Some prices are not filled in.</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold">Total</span>
              <span className="text-xl font-bold">{total.toFixed(2)}</span>
            </div>
            <Button className="w-full" disabled={hasEmptyPrice || hasEmptyName} onClick={openPaymentDialog}>
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
                  {PAYMENT_TYPES.map((type) => {
                    const hasActivePackage = customerPackages.some(
                      (cp) => (cp.remaining_uses > 0 || (cp.remaining_credits ?? 0) > 0) && !cp.completed_at
                    );
                    const disabled = type === "Package" && (!selectedCustomer || !hasActivePackage || cartHasPackageSale);
                    return (
                      <button
                        key={type}
                        type="button"
                        disabled={disabled}
                        onClick={() => !disabled && setPaymentType(type)}
                        className={`border rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                          disabled
                            ? "opacity-40 cursor-not-allowed bg-gray-50 text-gray-400"
                            : paymentType === type
                            ? "border-black bg-black text-white"
                            : "hover:border-gray-400"
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
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

              {/* Cart remaining tracker */}
              {(() => {
                const deductCounts = new Map<string, number>();
                for (const n of deductedServiceNames) {
                  const k = n.trim().toLowerCase();
                  deductCounts.set(k, (deductCounts.get(k) ?? 0) + 1);
                }
                const remaining: { name: string; qty: number; subtotal: number }[] = [];
                for (const item of cart) {
                  const k = item.service.name.trim().toLowerCase();
                  const avail = deductCounts.get(k) ?? 0;
                  const needed = Math.max(1, Math.round(parseFloat(item.qty) || 1));
                  const leftover = Math.max(0, needed - avail);
                  deductCounts.set(k, Math.max(0, avail - needed));
                  if (leftover > 0) {
                    const unitPrice = parseFloat(item.price) || 0;
                    remaining.push({ name: item.service.name, qty: leftover, subtotal: unitPrice * leftover });
                  }
                }
                // Build set of uncovered service name keys for use in package list
                const uncoveredKeys = new Set(remaining.map((r) => r.name.trim().toLowerCase()));
                const remainingTotal = remaining.reduce((s, r) => s + r.subtotal, 0);
                const allCovered = remaining.length === 0;
                return (
                  <>
                  <div className={`rounded-lg border px-3 py-2 text-sm ${allCovered ? "border-green-300 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
                    <p className={`font-semibold mb-1 ${allCovered ? "text-green-700" : "text-amber-800"}`}>
                      {allCovered ? "All cart items covered ✓" : "Cart items still to cover"}
                    </p>
                    {!allCovered && (
                      <>
                        <div className="space-y-0.5">
                          {remaining.map((r, i) => (
                            <div key={i} className="flex justify-between text-amber-900">
                              <span>{r.qty > 1 ? `${r.name} ×${r.qty}` : r.name}</span>
                              <span className="font-medium">RM {r.subtotal.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between border-t border-amber-200 mt-1 pt-1 font-bold text-amber-900">
                          <span>Uncovered total</span>
                          <span>RM {remainingTotal.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Store uncoveredKeys on a ref-like hidden element so package list can use it */}
                  <div data-uncovered-keys={[...uncoveredKeys].join(",")} className="hidden" />
                  </>
                );
              })()}

              {customerPackages.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">
                  No active packages found for this customer.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Tap a package to deduct uses for it.</p>
                  {customerPackages.map((cp) => {
                    // Compute uncovered keys inline for highlighting
                    const dcPkg = new Map<string, number>();
                    for (const n of deductedServiceNames) {
                      const k = n.trim().toLowerCase();
                      dcPkg.set(k, (dcPkg.get(k) ?? 0) + 1);
                    }
                    const uncoveredKeysPkg = new Set<string>();
                    for (const item of cart) {
                      const k = item.service.name.trim().toLowerCase();
                      const avail = dcPkg.get(k) ?? 0;
                      const needed = Math.max(1, Math.round(parseFloat(item.qty) || 1));
                      dcPkg.set(k, Math.max(0, avail - needed));
                      if (avail < needed) uncoveredKeysPkg.add(k);
                    }
                    return (
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
                          {(cp.items ?? []).map((item) => {
                            const k = item.service_name.trim().toLowerCase();
                            const isUncovered = item.remaining_uses > 0 && uncoveredKeysPkg.has(k);
                            return (
                            <li key={item.id} className="flex justify-between text-xs text-gray-600">
                              <span>{item.service_name}</span>
                              <span className={
                                item.remaining_uses === 0
                                  ? "text-gray-300"
                                  : isUncovered
                                  ? "font-bold text-green-600"
                                  : "font-semibold"
                              }>
                                {item.remaining_uses}/{item.total_uses} left
                              </span>
                            </li>
                            );
                          })}
                        </ul>
                      )}
                    </button>
                    );
                  })}
                </div>
              )}

              <Button className="w-full mt-2" onClick={handlePackageDeductDone}>
                {(() => {
                  const dc = new Map<string, number>();
                  for (const n of deductedServiceNames) {
                    const k = n.trim().toLowerCase();
                    dc.set(k, (dc.get(k) ?? 0) + 1);
                  }
                  const hasRemaining = cart.some((item) => {
                    const k = item.service.name.trim().toLowerCase();
                    const avail = dc.get(k) ?? 0;
                    const needed = Math.max(1, Math.round(parseFloat(item.qty) || 1));
                    dc.set(k, Math.max(0, avail - needed));
                    return avail < needed;
                  });
                  return hasRemaining ? "Proceed to Payment for Extra Items" : "Done — Proceed to Receipt";
                })()}
              </Button>
            </>
          )}

          {dialogStep === "extra-payment" && (
            <>
              <DialogHeader>
                <DialogTitle>Additional Payment Required</DialogTitle>
              </DialogHeader>

              {extraCreditTopup !== null ? (
                <p className="text-sm text-gray-500">
                  The package credits are insufficient. A cash top-up is required for the shortfall:
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  These services are not covered by the package and require an extra payment:
                </p>
              )}

              {extraCreditTopup !== null ? (
                <div className="rounded-lg border bg-amber-50 px-4 py-3 flex justify-between text-sm">
                  <span className="text-amber-800 font-medium">Credit shortfall</span>
                  <span className="font-bold text-amber-900">RM {extraCreditTopup.toFixed(2)}</span>
                </div>
              ) : (
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
              )}

              <div className="flex justify-between items-center border-t pt-2 font-bold">
                <span>Extra Total</span>
                <span>RM {extraTotal.toFixed(2)}</span>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Payment type</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_TYPES.filter((t) =>
                    t !== "Package" ||
                    (extraCreditTopup !== null &&
                      customerPackages.some(
                        (p) => p.package?.package_type === "credit" && (p.remaining_credits ?? 0) > 0
                      )) ||
                    (extraCartItems.length > 0 && customerPackages.length > 0)
                  ).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { setExtraPaymentType(type); setExtraTopupPackage(null); }}
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

              {extraPaymentType === "Package" && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select package</p>
                  {(extraCreditTopup !== null
                    ? customerPackages.filter((p) => p.package?.package_type === "credit" && (p.remaining_credits ?? 0) > 0)
                    : customerPackages
                  ).map((cp) => (
                    <button
                      key={cp.id}
                      type="button"
                      onClick={() => setExtraTopupPackage(cp)}
                      className={`w-full text-left border rounded-lg px-3 py-2 text-sm transition-colors ${
                        extraTopupPackage?.id === cp.id
                          ? "border-black bg-black text-white"
                          : "hover:border-gray-400"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">{cp.package?.name}</span>
                        <span className={`text-xs capitalize ${extraTopupPackage?.id === cp.id ? "text-gray-300" : "text-gray-400"}`}>
                          {cp.package?.package_type ?? "services"}
                        </span>
                      </div>
                      {cp.package?.package_type === "credit" ? (
                        <p className={`text-xs ${extraTopupPackage?.id === cp.id ? "text-gray-300" : "text-gray-600"}`}>
                          Credits: <span className="font-semibold">{(cp.remaining_credits ?? 0).toFixed(2)}</span> remaining
                        </p>
                      ) : (
                        <ul className="space-y-0.5">
                          {(cp.items ?? []).map((item) => (
                            <li key={item.id} className={`flex justify-between text-xs ${extraTopupPackage?.id === cp.id ? "text-gray-300" : "text-gray-600"}`}>
                              <span>{item.service_name}</span>
                              <span className={item.remaining_uses === 0 ? "opacity-50" : "font-semibold"}>
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
                    (extraPaymentType === "Package" && !extraTopupPackage) ||
                    (extraPaymentType === "Cash" &&
                      (!extraCashReceived ||
                        isNaN(parseFloat(extraCashReceived)) ||
                        parseFloat(extraCashReceived) < extraTotal))
                  }
                  onClick={() => {
                    if (extraPaymentType === "Package" && extraTopupPackage) {
                      isTopupDeductRef.current = true;
                      setDeductingPackage(extraTopupPackage);
                    } else {
                      handleExtraPaymentConfirm();
                    }
                  }}
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
                extraTotal={(extraCartItems.length > 0 || extraCreditTopup !== null) ? extraTotal : undefined}
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
                packageDeductions={packageDeductions.length > 0 ? packageDeductions : undefined}
                transactionBy={selectedEmployee?.nickname ?? selectedEmployee?.name ?? undefined}
                hideDownloadButton={true}
              />

              <Button className="w-full" disabled={sending} onClick={handleDoSend}>
                {sending
                  ? "Sending…"
                  : selectedCustomer?.contact_number
                  ? "Save & Send via WhatsApp"
                  : "Save Receipt"}
              </Button>
            </>
          )}

        </DialogContent>
      </Dialog>

      {/* Register new customer (opens on top of payment dialog) */}
      <CustomerFormDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        initialPhone={customerQuery.trim()}
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
        defaultPackageId={pendingSellPackages[0]?.pkg.id}
        defaultQuantity={pendingSellPackages[0]?.qty}
        defaultPaymentType={paymentType ?? undefined}
        skipTransaction
      />

      {/* Deduct use from a package during Package payment */}
      <DeductUseDialog
        open={deductingPackage !== null}
        onClose={() => void handleDeductClose()}
        onDeducted={(names, topup) => {
        lastDeductedNamesRef.current = names;
        lastCreditTopupRef.current = topup ?? 0;
        setDeductedServiceNames((prev) => [...prev, ...names]);
        // Compute amount deducted from this package
        const pkgName = deductingPackage?.package?.name ?? "Package";
        const isCredit = deductingPackage?.package?.package_type === "credit";
        let deductedAmount: number;
        if (isCredit) {
          if (isTopupDeductRef.current && extraCreditTopup !== null) {
            // Paying a credit shortfall with another package — deduct only what this package actually covered
            deductedAmount = extraCreditTopup - (topup ?? 0);
          } else if (isTopupDeductRef.current) {
            // Credit package used for extra cart items
            deductedAmount = extraCartItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1), 0) - (topup ?? 0);
          } else {
            // Credit package used for main cart — sum prices of the services actually deducted
            const creditNameMap = new Map<string, number>();
            for (const n of names) {
              const k = n.trim().toLowerCase();
              creditNameMap.set(k, (creditNameMap.get(k) ?? 0) + 1);
            }
            let coveredTotal = 0;
            for (const [k, cnt] of creditNameMap) {
              const cartItem = cart.find((item) => item.service.name.trim().toLowerCase() === k);
              const unitPrice = cartItem ? (parseFloat(cartItem.price) || 0) : 0;
              coveredTotal += unitPrice * cnt;
            }
            deductedAmount = coveredTotal - (topup ?? 0);
          }
        } else {
          // Count how many of each service name were actually deducted by this dialog
          const nameCountMap = new Map<string, number>();
          for (const n of names) {
            const k = n.trim().toLowerCase();
            nameCountMap.set(k, (nameCountMap.get(k) ?? 0) + 1);
          }
          // Look up unit price from cart (or extraCartItems for topup flows) per deducted count
          const sourceItems = isTopupDeductRef.current ? extraCartItems : cart;
          deductedAmount = 0;
          for (const [k, cnt] of nameCountMap) {
            const cartItem = sourceItems.find((item) => item.service.name.trim().toLowerCase() === k);
            const unitPrice = cartItem ? (parseFloat(cartItem.price) || 0) : 0;
            deductedAmount += unitPrice * cnt;
          }
        }
        setPackageDeductions((prev) => [...prev, { packageName: pkgName, amount: deductedAmount }]);
      }}
        customerPackage={deductingPackage}
        cartServiceNames={
          isTopupDeductRef.current
            ? (extraCreditTopup !== null
                ? ["Package Top-Up"]
                : extraCartItems.map((item) => item.service.name))
            : (() => {
                const dm = new Map<string, number>();
                for (const n of deductedServiceNames) {
                  const k = n.trim().toLowerCase();
                  dm.set(k, (dm.get(k) ?? 0) + 1);
                }
                return cart.flatMap((item) => {
                  const k = item.service.name.trim().toLowerCase();
                  const rem = Math.max(0, Math.max(1, Math.round(parseFloat(item.qty) || 1)) - (dm.get(k) ?? 0));
                  return Array.from({ length: rem }, () => item.service.name);
                });
              })()
        }
        cartItems={
          isTopupDeductRef.current
            ? (extraCreditTopup !== null
                ? [{ service_name: "Package Top-Up", price: (extraCreditTopup ?? 0).toFixed(2), qty: "1" }]
                : extraCartItems.map((item) => ({ service_name: item.service.name, price: item.price, qty: item.qty })))
            : (() => {
                const dm = new Map<string, number>();
                for (const n of deductedServiceNames) {
                  const k = n.trim().toLowerCase();
                  dm.set(k, (dm.get(k) ?? 0) + 1);
                }
                return cart.flatMap((item) => {
                  const k = item.service.name.trim().toLowerCase();
                  const rem = Math.max(0, Math.max(1, Math.round(parseFloat(item.qty) || 1)) - (dm.get(k) ?? 0));
                  if (rem === 0) return [];
                  return [{ service_name: item.service.name, price: item.price, qty: rem.toString() }];
                });
              })()
        }
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
