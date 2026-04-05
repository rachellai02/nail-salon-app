"use client";

import { CustomerPackage } from "@/lib/types";

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
}: ReceiptViewProps) {
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const addrParts = SHOP_ADDR.split(",");

  return (
    <div className="relative">
      <div className="font-mono text-xs border rounded-lg p-10 bg-white space-y-2 max-h-[60vh] overflow-y-auto">
      {/* Shop header */}
      <div className="text-center space-y-0.5">
        <p className="font-bold text-sm tracking-wide">{SHOP_NAME}</p>
        <p>{SHOP_REG}</p>
        <p>{SHOP_TEL}</p>
        <p>{addrParts.slice(0, 2).join(",")},</p>
        <p>{addrParts.slice(2).join(",").trim()}</p>
      </div>

      <div className="border-t border-dashed border-gray-300 p-2" />

      <div className="space-y-0.5 pb-2">
        <p>Receipt No: {receiptNo}</p>
        <p>Date: {date}</p>
        <p>Transaction By: xxx</p>
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

      <div className="flex justify-between font-bold text-sm">
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

      {customerPackages && customerPackages.length > 0 && (
        <>
          <br></br>
          <div className="border-t border-dashed border-gray-300" />
          <br></br>
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
      )}

      <br></br>
      <div className="border-t border-dashed border-gray-300" />
      <br></br>
      <p className="text-center">Thank you and have a nice day.</p>
      <p className="text-center">Hope to see you again soon.</p>
    </div>

    {isVoided && (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden rounded-lg">
        <span
          className="text-red-500 font-black opacity-25 tracking-widest select-none whitespace-nowrap"
          style={{ fontSize: "3.5rem", transform: "rotate(-30deg)" }}
        >
          VOIDED
        </span>
      </div>
    )}
  </div>
  );
}
