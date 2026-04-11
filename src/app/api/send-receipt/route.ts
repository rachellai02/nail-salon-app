import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ReceiptItem = { qty: number; name: string; subtotal: number };
type PackageDeduction = { packageName: string; amount: number };
type PackageItem = { service_name: string; remaining_uses: number; total_uses: number };

type CustomerPackageInfo = {
  name: string;
  packageType: string;
  remainingCredits?: number;
  items?: PackageItem[];
  customerCode?: number | string;
  customerName?: string;
  customerPhone?: string;
};

export type SendReceiptPayload = {
  phone: string;
  customerName: string;
  receiptNo: string;
  date: string;
  transactionBy?: string;
  items: ReceiptItem[];
  paymentType: string;
  total: number;
  cashReceived?: number | null;
  changeGiven?: number | null;
  extraPaymentType?: string;
  extraTotal?: number;
  extraCashReceived?: number | null;
  extraChangeGiven?: number | null;
  packageDeductions?: PackageDeduction[];
  customerPackages?: CustomerPackageInfo[];
};

// ---------------------------------------------------------------------------
// Shop constants (mirror ReceiptView)
// ---------------------------------------------------------------------------
const SHOP_NAME = "PRESTIGE BY CHUSEN";
const SHOP_REG = "Chusen Beauty 202603063451 (003831067-D)";
const SHOP_TEL = "04-6588998 / 012-6988477";
const SHOP_ADDR = "5M, Jalan Delima, Island Glades, 11700 Gelugor, Penang.";

const RECEIPT_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Courier Prime', 'Courier New', monospace; font-size: 11px; line-height: 1.6; padding: 20px; background: white; color: #000; }
.center { text-align: center; }
.right { text-align: right; }
.bold { font-weight: 700; }
.semibold { font-weight: 600; }
.row { display: flex; gap: 4px; align-items: baseline; }
.description { flex: 1; min-width: 0; }
.qty { width: 24px; flex-shrink: 0; }
.amount { width: 64px; flex-shrink: 0; text-align: right; }
.space-between { display: flex; justify-content: space-between; }
.divider { border-top: 1px dashed #9ca3af; margin: 8px 0; }
.mb-1 { margin-bottom: 4px; }
.mt-1 { margin-top: 4px; }
.mb-2 { margin-bottom: 8px; }
.mt-2 { margin-top: 8px; }
.pl-2 { padding-left: 8px; }
.large { font-size: 13px; }
@page { size: A5 portrait; margin: 1cm; }
`;

// ---------------------------------------------------------------------------
// HTML receipt builder
// ---------------------------------------------------------------------------
function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getLogoDataUrl(): string {
  try {
    const logoPath = path.join(process.cwd(), "public", "chusen-logo.jpeg");
    const logoBuffer = fs.readFileSync(logoPath);
    return `data:image/jpeg;base64,${logoBuffer.toString("base64")}`;
  } catch {
    return "";
  }
}

function buildReceiptHtml(data: SendReceiptPayload): string {
  const {
    receiptNo, date, items, paymentType, total, cashReceived, changeGiven,
    extraPaymentType, extraTotal, extraCashReceived, extraChangeGiven,
    packageDeductions, transactionBy, customerPackages,
  } = data;

  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const addrParts = SHOP_ADDR.split(",");
  const logoDataUrl = getLogoDataUrl();

  const itemsHtml = items.map(item => `
    <div class="row">
      <span class="qty">${item.qty}</span>
      <span class="description">${escHtml(item.name)}</span>
      <span class="amount">${item.subtotal.toFixed(2)}</span>
    </div>`).join("");

  let paymentHtml = "";
  if (paymentType === "Package" || paymentType.startsWith("Package +")) {
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

    paymentHtml = deductions.map(d => `
      <div class="space-between">
        <span>${escHtml(d.label)}</span>
        <span>- RM ${d.amount.toFixed(2)}</span>
      </div>`).join("");
    paymentHtml += `<div class="divider"></div>
      <div class="space-between bold">
        <span>Final Payment Amount</span>
        <span>RM ${finalAmount.toFixed(2)}</span>
      </div>
      <div class="space-between">
        <span>Payment</span>
        <span>${escHtml(isFullyCovered ? "Package (Fully Covered)" : (extraPaymentType ?? "Package (Fully Covered)"))}</span>
      </div>`;
    if (extraPaymentType === "Cash" && extraCashReceived != null) {
      paymentHtml += `
        <div class="space-between"><span>Cash Received</span><span>RM ${Number(extraCashReceived).toFixed(2)}</span></div>
        <div class="space-between"><span>Change</span><span>RM ${Number(extraChangeGiven ?? 0).toFixed(2)}</span></div>`;
    }
  } else {
    paymentHtml = `<div class="space-between"><span>Payment</span><span>${escHtml(paymentType)}</span></div>`;
    if (paymentType === "Cash" && cashReceived != null) {
      paymentHtml += `
        <div class="space-between"><span>Cash Received</span><span>RM ${Number(cashReceived).toFixed(2)}</span></div>
        <div class="space-between"><span>Change</span><span>RM ${Number(changeGiven ?? 0).toFixed(2)}</span></div>`;
    }
    if (extraPaymentType && extraTotal != null) {
      paymentHtml += `
        <div class="space-between"><span>Extra Payment</span><span>${escHtml(extraPaymentType)}</span></div>
        <div class="space-between"><span>Extra Amount</span><span>RM ${extraTotal.toFixed(2)}</span></div>`;
      if (extraPaymentType === "Cash" && extraCashReceived != null) {
        paymentHtml += `
          <div class="space-between"><span>Cash Received</span><span>RM ${Number(extraCashReceived).toFixed(2)}</span></div>
          <div class="space-between"><span>Change</span><span>RM ${Number(extraChangeGiven ?? 0).toFixed(2)}</span></div>`;
      }
    }
  }

  let packagesHtml = "";
  if (customerPackages && customerPackages.length > 0) {
    const first = customerPackages[0];
    packagesHtml = `
      <br/>
      <div class="divider"></div>
      <br/>
      <p class="bold">Customer ID: ${escHtml(String(first?.customerCode ?? "N/A"))}</p>
      <p class="bold">Customer Name: ${escHtml(first?.customerName ?? "N/A")}</p>
      <p class="bold">Phone Number: ${escHtml(first?.customerPhone ?? "N/A")}</p>
      <br/>
      <p class="bold">Active Packages:</p>
      ${customerPackages.map(cp => `
        <div class="mt-1">
          <p class="semibold">${escHtml(cp.name)}</p>
          ${cp.packageType === "credit"
            ? `<p class="pl-2">Credits: ${cp.remainingCredits ?? 0} remaining</p>`
            : (cp.items ?? []).map(it => `
              <div class="space-between pl-2">
                <span>${escHtml(it.service_name)}</span>
                <span>${it.remaining_uses}/${it.total_uses} left</span>
              </div>`).join("")
          }
        </div>`).join("")}`;
  }

  return `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"/>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap" rel="stylesheet">
  <title>Receipt ${escHtml(receiptNo)}</title>
  <style>${RECEIPT_CSS}</style>
</head>
<body>
  <div class="center mb-2">
    ${logoDataUrl ? `<img src="${logoDataUrl}" style="width:150px;height:150px;object-fit:contain;margin:-20px auto -15px;display:block;" />` : ""}
    <p class="bold large">${escHtml(SHOP_NAME)}</p>
    <p>${escHtml(SHOP_REG)}</p>
    <p>${escHtml(SHOP_TEL)}</p>
    <p>${escHtml(addrParts.slice(0, 2).join(","))},</p>
    <p>${escHtml(addrParts.slice(2).join(",").trim())}</p>
  </div>

  <div class="divider mt-2 mb-2"></div>

  <div class="mb-2">
    <p>Receipt No: ${escHtml(receiptNo)}</p>
    <p>Date: ${escHtml(date)}</p>
    <p>Transaction By: ${escHtml(transactionBy ?? "—")}</p>
  </div>

  <div class="divider"></div>

  <div class="row bold mt-1 mb-1">
    <span class="qty">Qty</span>
    <span class="description">Description</span>
    <span class="amount">Amt (RM)</span>
  </div>
  <div class="divider"></div>

  ${itemsHtml}

  <div class="divider"></div>
  <div class="space-between mt-1">
    <span>Subtotal (${totalQty} item${totalQty !== 1 ? "s" : ""})</span>
    <span>${total.toFixed(2)}</span>
  </div>
  <div class="divider"></div>
  <div class="space-between bold large mb-1">
    <span>TOTAL</span>
    <span>RM ${total.toFixed(2)}</span>
  </div>

  ${paymentHtml}

  ${packagesHtml}

  <br/>
  <div class="divider"></div>
  <br/>
  <p class="center">Thank you and have a nice day.</p>
  <p class="center">Hope to see you again soon.</p>
</body></html>`;
}

// ---------------------------------------------------------------------------
// PDF generation via Puppeteer
// ---------------------------------------------------------------------------
async function generatePdf(html: string): Promise<Buffer> {
  const localChrome = process.env.CHROME_EXECUTABLE_PATH;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any;

  if (localChrome) {
    // Local dev: point to installed Chrome
    const { launch } = await import("puppeteer-core");
    browser = await launch({
      executablePath: localChrome,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  } else {
    // Production (Vercel): download Chromium on demand
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const { launch } = await import("puppeteer-core");
    const executablePath = await chromium.executablePath(
      process.env.CHROMIUM_DOWNLOAD_URL ??
        "https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar"
    );
    browser = await launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
  }

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdf = await page.pdf({ format: "A5", printBackground: true });
  await browser.close();
  return Buffer.from(pdf);
}

// ---------------------------------------------------------------------------
// WhatsApp Cloud API helpers
// ---------------------------------------------------------------------------
async function uploadToWhatsApp(pdfBuffer: Buffer, receiptNo: string): Promise<string> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN!;
  const version = process.env.WHATSAPP_API_VERSION ?? "v19.0";

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  const pdfArrayBuffer = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength) as ArrayBuffer;
  form.append(
    "file",
    new Blob([pdfArrayBuffer], { type: "application/pdf" }),
    `receipt_${receiptNo}.pdf`
  );

  const res = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/media`,
    { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: form }
  );
  const uploadBody = await res.json();
  console.log("[WA upload]", res.status, JSON.stringify(uploadBody));
  if (!res.ok) {
    throw new Error((uploadBody as { error?: { message?: string } })?.error?.message ?? "WhatsApp media upload failed");
  }
  const { id } = uploadBody as { id: string };
  return id;
}

async function sendTemplate(phone: string, mediaId: string, customerName: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN!;
  const version = process.env.WHATSAPP_API_VERSION ?? "v19.0";

  const digits = phone.replace(/\D/g, "");
  const to = digits.startsWith("60")
    ? digits
    : digits.startsWith("0")
    ? "60" + digits.slice(1)
    : "60" + digits;

  const res = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE_NAME ?? "receipt_pdf",
          language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en_US" },
          components: [
            {
              type: "header",
              parameters: [
                {
                  type: "document",
                  document: { id: mediaId, filename: "receipt.pdf" },
                },
              ],
            },
            {
              type: "body",
              parameters: [{ type: "text", text: customerName }],
            },
          ],
        },
      }),
    }
  );
  const sendBody = await res.json();
  console.log("[WA send]", res.status, JSON.stringify(sendBody));
  if (!res.ok) {
    throw new Error((sendBody as { error?: { message?: string } })?.error?.message ?? "WhatsApp send failed");
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    if (!process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN) {
      return NextResponse.json({ error: "WhatsApp API not configured" }, { status: 503 });
    }

    const payload = await req.json() as SendReceiptPayload;
    if (!payload.phone || !payload.customerName || !payload.receiptNo) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const html = buildReceiptHtml(payload);
    const pdfBuffer = await generatePdf(html);
    const mediaId = await uploadToWhatsApp(pdfBuffer, payload.receiptNo);
    await sendTemplate(payload.phone, mediaId, payload.customerName);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[send-receipt]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
