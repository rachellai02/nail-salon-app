"use client";

import { useState, useEffect, useId } from "react";
import { ServiceCategory, Service, Customer } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CustomerFormDialog } from "@/components/CustomerFormDialog";
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

type DialogStep = "confirm" | "success" | "receipt";

type Props = {
  categories: ServiceCategory[];
  customers: Customer[];
};

const CART_STORAGE_KEY = "payment_cart";

export default function PaymentClient({ categories, customers }: Props) {
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
  // receipt step state
  const [customerQuery, setCustomerQuery] = useState("");
  const [receiptCustomer, setReceiptCustomer] = useState<Customer | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const uid = useId();
  let counter = 0;

  function addToCart(svc: Service) {
    const key = `${uid}-${counter++}-${svc.id}`;
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
    setCustomerQuery("");
    setReceiptCustomer(null);
    setRegisterOpen(false);
    setDialogOpen(true);
  }

  function handlePay() {
    setDialogStep("success");
  }

  function handleSendReceipt() {
    setCustomerQuery("");
    setReceiptCustomer(null);
    setRegisterOpen(false);
    setDialogStep("receipt");
  }

  function handleDoSend() {
    const phone = receiptCustomer?.contact_number ?? "";
    const name = receiptCustomer?.name ?? "";
    toast.success(`Receipt sent to ${name} (${phone})`);
    setDialogOpen(false);
    clearCart();
  }

  function handleDialogClose(open: boolean) {
    if (!open) {
      setDialogOpen(false);
      if (dialogStep === "receipt") {
        clearCart();
      }
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
        <DialogContent className="max-w-sm">
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
                Send Receipt
              </Button>
            </div>
          )}

          {dialogStep === "receipt" && (
            <>
              <DialogHeader>
                <DialogTitle>Send Receipt</DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                {/* Show search input only when no customer selected yet */}
                {!receiptCustomer && (
                  <>
                    <Input
                      placeholder="Search customer by name or phone..."
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      autoFocus
                    />
                    {filteredCustomers.length > 0 && (
                      <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                        {filteredCustomers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setReceiptCustomer(c); setCustomerQuery(""); }}
                            className="w-full text-left px-3 py-2 text-sm flex justify-between hover:bg-gray-50 transition-colors"
                          >
                            <span>{c.name}</span>
                            <span className="text-gray-400">{c.contact_number}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Selected customer card with change link */}
                {receiptCustomer && (
                  <div className="border rounded-lg px-3 py-2 text-sm bg-gray-50 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{receiptCustomer.name}</p>
                      <p className="text-gray-500">{receiptCustomer.contact_number}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReceiptCustomer(null)}
                      className="text-xs text-gray-400 hover:text-gray-600 ml-3 flex-shrink-0"
                    >
                      Change
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setRegisterOpen(true)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  + New customer
                </button>
              </div>

              <Button
                className="w-full"
                disabled={receiptCustomer === null}
                onClick={handleDoSend}
              >
                Send
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
          setReceiptCustomer(newCustomer);
          setRegisterOpen(false);
        }}
      />
    </div>
  );
}
