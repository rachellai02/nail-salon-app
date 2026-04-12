import { NextRequest, NextResponse } from "next/server";

export type SendReminderPayload = {
  phone: string;
  customerName: string;
  date: string;   // formatted display string e.g. "Sunday, 13 April 2026"
  time: string;   // formatted display string e.g. "10:00 AM"
  pax: number;
  appointmentId?: string; // embedded in button payload so webhook can identify exact appointment
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN) {
      return NextResponse.json({ error: "WhatsApp API not configured" }, { status: 503 });
    }

    const payload = await req.json() as SendReminderPayload;
    if (!payload.phone || !payload.customerName || !payload.date || !payload.time) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN;
    const version       = process.env.WHATSAPP_API_VERSION ?? "v25.0";

    const digits = payload.phone.replace(/\D/g, "");
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
            name: "appointment_reminder",
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", parameter_name: "name", text: payload.customerName },
                  { type: "text", parameter_name: "date", text: payload.date },
                  { type: "text", parameter_name: "time", text: payload.time },
                  { type: "text", parameter_name: "pax", text: String(payload.pax) },
                ],
              },
              // Embed appointment ID as the "Confirm Booking" button payload (index 0)
              ...(payload.appointmentId ? [{
                type: "button",
                sub_type: "quick_reply",
                index: "0",
                parameters: [{ type: "payload", payload: payload.appointmentId }],
              }] : []),
            ],
          },
        }),
      }
    );

    const body = await res.json();
    console.log("[WA reminder]", res.status, JSON.stringify(body));

    if (!res.ok) {
      throw new Error(
        (body as { error?: { message?: string } })?.error?.message ??
          "WhatsApp send failed"
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[send-reminder]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
