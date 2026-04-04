"use client";

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
}: ReceiptViewProps) {
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const addrParts = SHOP_ADDR.split(",");

  return (
    <div className="relative">
      <div className="font-mono text-xs border rounded-lg p-4 bg-white space-y-2 max-h-[60vh] overflow-y-auto">
      {/* Shop header */}
      <div className="text-center space-y-0.5">
        <p className="font-bold text-sm tracking-wide">{SHOP_NAME}</p>
        <p>{SHOP_REG}</p>
        <p>{SHOP_TEL}</p>
        <p>{addrParts.slice(0, 2).join(",")},</p>
        <p>{addrParts.slice(2).join(",").trim()}</p>
      </div>

      <p className="text-center text-gray-300">- - - - - - - - - - - - - - - - -</p>

      <div className="space-y-0.5">
        <p>Receipt No: {receiptNo}</p>
        <p>Date: {date}</p>
        <p>Transaction By: xxx</p>
      </div>

      <p className="text-center text-gray-300">- - - - - - - - - - - - - - - - -</p>

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

      <p className="text-center text-gray-300">- - - - - - - - - - - - - - - - -</p>
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
