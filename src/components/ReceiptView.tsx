"use client";

import { useRef } from "react";
import { CustomerPackage } from "@/lib/types";

const PRINT_CSS = `
* { box-sizing: border-box; }
body { margin: 0; padding: 0; background: white; }
.font-mono { font-family: ui-monospace, 'Courier New', monospace; font-size: 15px; line-height: 1.5; }
.text-xs { font-size: 15px; line-height: 1.4; }
.text-sm { font-size: 17px; line-height: 1.4; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.font-bold { font-weight: 700; }
.font-semibold { font-weight: 600; }
.font-black { font-weight: 900; }
.tracking-wide { letter-spacing: 0.05em; }
.tracking-widest { letter-spacing: 0.25em; }
.flex { display: flex; align-items: baseline; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.justify-center { justify-content: center; }
.flex-1 { flex: 1 1 0%; min-width: 0; }
.gap-1 { gap: 4px; }
.w-6 { width: 24px; min-width: 24px; flex-shrink: 0; }
.w-16 { width: 64px; min-width: 64px; flex-shrink: 0; }
.border { border: 1px solid #d1d5db; }
.border-t { border-top-width: 1px; border-top-style: solid; border-top-color: #d1d5db; }
.border-dashed { border-style: dashed; }
.border-gray-300 { border-color: #d1d5db; }
.rounded-lg { border-radius: 8px; }
.p-2 { padding: 8px; }
.my-2 { margin-top: 8px; margin-bottom: 8px; }
.p-10 { padding: 40px; }
.pb-2 { padding-bottom: 8px; }
.pl-2 { padding-left: 8px; }
.mt-1 { margin-top: 4px; }
.space-y-0\\.5 > * + * { margin-top: 2px; }
.space-y-2 > * + * { margin-top: 8px; }
.p-5 { padding: 20px; }
.bg-white { background-color: white; }
.relative { position: relative; }
.absolute { position: absolute; top: 0; right: 0; bottom: 0; left: 0; }
.overflow-hidden { overflow: hidden; }
.pointer-events-none { pointer-events: none; }
.select-none { user-select: none; }
.whitespace-nowrap { white-space: nowrap; }
.text-red-500 { color: #ef4444; }
.opacity-25 { opacity: 0.25; }
@media print { @page { margin: 1cm; size: A5 portrait; } .border { border: none !important; } .rounded-lg { border-radius: 0 !important; } }
`;

const SHOP_NAME = "PRESTIGE BY CHUSEN";
const SHOP_REG = "Chusen Beauty 202603063451 (003831067-D)";
const SHOP_TEL = "04-6588998 / 012-6988477";
const SHOP_ADDR = "5M, Jalan Delima, Island Glades, 11700 Gelugor, Penang.";

type ReceiptItem = {
  qty: number;
  name: string;
  subtotal: number;
};

type ReceiptViewProps = {
  receiptNo: string;
  date: string; // pre-formatted display string
  items: ReceiptItem[];
  paymentType: string;
  total: number;
  cashReceived?: number | null;
  changeGiven?: number | null;
  isVoided?: boolean;
  customerPackages?: CustomerPackage[];
  extraPaymentType?: string;
  extraTotal?: number;
  extraCashReceived?: number | null;
  extraChangeGiven?: number | null;
  packageDeductions?: { packageName: string; amount: number }[];
  transactionBy?: string;
  hideDownloadButton?: boolean;
  pdfTriggerRef?: { current: ((targetWin?: Window) => void) | null };
  customerName?: string;
  customerPhone?: string;
  customerCode?: string | number | null;
  onSend?: () => void;
  sendLabel?: string;
  sendDisabled?: boolean;
};

export function ReceiptView({
  receiptNo,
  date,
  items,
  paymentType,
  total,
  cashReceived,
  changeGiven,
  isVoided = false,
  customerPackages,
  extraPaymentType,
  extraTotal,
  extraCashReceived,
  extraChangeGiven,
  packageDeductions,
  transactionBy,
  hideDownloadButton,
  pdfTriggerRef,
  customerName,
  customerPhone,
  customerCode,
  onSend,
  sendLabel,
  sendDisabled,
}: ReceiptViewProps) {
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const addrParts = SHOP_ADDR.split(",");
  const printRef = useRef<HTMLDivElement>(null);

  function triggerPdf(targetWin?: Window) {
    if (!printRef.current) return;
    const html = printRef.current.outerHTML;
    const win = targetWin ?? window.open("", "_blank", "width=600,height=800");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Receipt ${receiptNo}</title>
      <style>${PRINT_CSS}</style>
    </head><body>${html}<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script></body></html>`);
    win.document.close();
  }

  // Expose trigger function to parent via ref
  if (pdfTriggerRef) pdfTriggerRef.current = triggerPdf;

  return (
    <div className="space-y-3">
    <div className="relative" ref={printRef}>
      <div className="font-mono border rounded-lg bg-white max-h-[60vh] overflow-y-auto" style={{ fontSize: 15, display: "grid" }}>
      <div className="p-5 space-y-2" style={{ gridArea: "1 / 1 / 2 / 2" }}>
      {/* Shop header */}
      <div className="text-center space-y-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/chusen-logo.jpeg" alt="Chusen Logo" style={{ width: 150, height: 150, objectFit: "contain", margin: "-20px auto -15px" }} />
        <p className="font-bold tracking-wide" style={{ fontSize: 17 }}>{SHOP_NAME}</p>
        <p>{SHOP_REG}</p>
        <p>{SHOP_TEL}</p>
        <p>{addrParts.slice(0, 2).join(",")},</p>
        <p>{addrParts.slice(2).join(",").trim()}</p>
      </div>

      <div className="border-t border-dashed border-gray-300 my-2" />

      <div className="space-y-0.5 pb-2">
        <p>Receipt No: {receiptNo}</p>
        <p>Date: {date}</p>
        <p>Transaction By: {transactionBy ?? "—"}</p>
      </div>

      <div className="border-t border-dashed border-gray-300" />

      {/* Items table */}
      <div className="flex gap-1 font-bold">
        <span className="w-6">Qty</span>
        <span className="flex-1">Description</span>
        <span className="w-16 text-right">Amt (RM)</span>
      </div>
      <div className="border-t border-dashed border-gray-300" />

      {items.map((item, i) => (
        <div key={i} className="flex gap-1">
          <span className="w-6">{item.qty}</span>
          <span className="flex-1">{item.name}</span>
          <span className="w-16 text-right">{item.subtotal.toFixed(2)}</span>
        </div>
      ))}

      <div className="border-t border-dashed border-gray-300" />

      <div className="flex justify-between">
        <span>
          Subtotal ({totalQty} item{totalQty !== 1 ? "s" : ""})
        </span>
        <span>{total.toFixed(2)}</span>
      </div>

      <div className="border-t border-dashed border-gray-300" />

      <div className="flex justify-between font-bold" style={{ fontSize: 17 }}>
        <span>TOTAL</span>
        <span>RM {total.toFixed(2)}</span>
      </div>

      {(paymentType === "Package" || paymentType.startsWith("Package +")) ? (
        (() => {
          // Use saved packageDeductions array if available; otherwise fall back to derived values
          const deductions: { label: string; amount: number }[] =
            packageDeductions && packageDeductions.length > 0
              ? packageDeductions.map((d, i) => ({
                  label: packageDeductions.length === 1
                    ? `Package Deduction (${d.packageName})`
                    : `Package Deduction ${i + 1} (${d.packageName})`,
                  amount: d.amount,
                }))
              : extraPaymentType === "Package"
              ? [
                  { label: "Package Deduction 1", amount: total - (extraTotal ?? 0) },
                  { label: "Package Deduction 2", amount: extraTotal ?? 0 },
                ]
              : [{ label: "Package Deduction", amount: total - (extraTotal ?? 0) }];

          const totalDeducted = deductions.reduce((s, d) => s + d.amount, 0);
          const finalAmount = Math.max(0, total - totalDeducted);
          const isFullyCovered = finalAmount === 0;

          return (
            <>
              {deductions.map((d, i) => (
                <div key={i} className="flex justify-between">
                  <span>{d.label}</span>
                  <span>- RM {d.amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-dashed border-gray-300" />
              <div className="flex justify-between font-bold">
                <span>Final Payment Amount</span>
                <span>RM {finalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment</span>
                <span>
                  {isFullyCovered
                    ? "Package (Fully Covered)"
                    : (extraPaymentType ?? "Package (Fully Covered)")}
                </span>
              </div>
              {extraPaymentType === "Cash" && extraCashReceived != null && (
                <>
                  <div className="flex justify-between">
                    <span>Cash Received</span>
                    <span>RM {Number(extraCashReceived).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Change</span>
                    <span>RM {Number(extraChangeGiven ?? 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </>
          );
        })()
      ) : (
        <>
          <div className="flex justify-between">
            <span>Payment</span>
            <span>{paymentType}</span>
          </div>

          {paymentType === "Cash" && cashReceived != null && (
            <>
              <div className="flex justify-between">
                <span>Cash Received</span>
                <span>RM {Number(cashReceived).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Change</span>
                <span>RM {Number(changeGiven ?? 0).toFixed(2)}</span>
              </div>
            </>
          )}

          {extraPaymentType && extraTotal != null && (
            <>
              <div className="flex justify-between">
                <span>Extra Payment</span>
                <span>{extraPaymentType}</span>
              </div>
              <div className="flex justify-between">
                <span>Extra Amount</span>
                <span>RM {extraTotal.toFixed(2)}</span>
              </div>
              {extraPaymentType === "Cash" && extraCashReceived != null && (
                <>
                  <div className="flex justify-between">
                    <span>Cash Received</span>
                    <span>RM {Number(extraCashReceived).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Change</span>
                    <span>RM {Number(extraChangeGiven ?? 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {(customerPackages && customerPackages.length > 0) ? (
        <>
          <br></br>
          <div className="border-t border-dashed border-gray-300" />
          <br></br>
          <p className="font-bold">Customer ID: {customerPackages[0]?.customer?.customer_code ?? "N/A"}</p>
          <p className="font-bold">Customer Name: {customerPackages[0]?.customer?.name ?? "N/A"}</p>
          <p className="font-bold">Phone Number: {customerPackages[0]?.customer?.contact_number ?? "N/A"}</p>
          <br></br>
          <p className="font-bold">Active Packages:</p>
          {customerPackages.map((cp) => (
            <div key={cp.id} className="space-y-0.5 mt-1">
              <p className="font-semibold">{cp.package?.name ?? "Package"}</p>
              {cp.package?.package_type === "credit" ? (
                <p className="pl-2">Credits: {(cp.remaining_credits ?? 0)} remaining</p>
              ) : (
                <div className="pl-2 space-y-0.5">
                  {(cp.items ?? []).map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span>{item.service_name}</span>
                      <span>{item.remaining_uses}/{item.total_uses} left</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      ) : (customerName || customerPhone) ? (
        <>
          <br></br>
          <div className="border-t border-dashed border-gray-300" />
          <br></br>
          {customerCode != null && <p className="font-bold">Customer ID: {customerCode}</p>}
          {customerName && <p className="font-bold">Customer Name: {customerName}</p>}
          {customerPhone && <p className="font-bold">Phone Number: {customerPhone}</p>}
        </>
      ) : null}

      <br></br>
      <div className="border-t border-dashed border-gray-300" />
      <br></br>
      <p className="text-center">Thank you and have a nice day.</p>
      <p className="text-center">Hope to see you again soon.</p>
      </div>

      {isVoided && (
        <div style={{ gridArea: "1 / 1 / 2 / 2", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
          <span
            className="font-black tracking-widest select-none whitespace-nowrap"
            style={{ fontSize: "6rem", color: "#dc2626", opacity: 0.38, transform: "rotate(-30deg)", letterSpacing: "0.2em" }}
          >
            VOIDED
          </span>
        </div>
      )}
    </div>
    </div>

    {!hideDownloadButton && (
    <div className={onSend ? "flex gap-2" : undefined}>
      <button
        type="button"
        onClick={() => triggerPdf()}
        className={`${onSend ? "flex-1" : "w-full"} border rounded-lg px-4 py-2 text-sm font-medium bg-blue-500 text-white hover:bg-gray-800 transition-colors`}
      >
        Download PDF
      </button>
      {onSend && (
        <button
          type="button"
          onClick={onSend}
          disabled={sendDisabled}
          className="flex-1 border rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: "#25D366", borderColor: "#25D366" }}
        >
          {sendLabel ?? "Send via WhatsApp"}
        </button>
      )}
    </div>
    )}
    </div>
  );
}
