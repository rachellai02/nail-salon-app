import { NextRequest, NextResponse } from "next/server";

// GET — webhook verification by Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    console.log("[wa-webhook] Verified");
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST — incoming messages
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const entry   = body?.entry?.[0];
    const change  = entry?.changes?.[0];
    const value   = change?.value;
    const message = value?.messages?.[0];

    if (!message) return NextResponse.json({ status: "no_message" });

    const from    = message.from as string;
    const type    = message.type as string;

    // Quick-reply button click from a template
    if (type === "button") {
      const payload = (message.button?.payload as string | undefined) ?? "";

      if (payload.toLowerCase().includes("confirm")) {
        await sendText(from, "Thanks and see you! 💅");
      }
      // Edit Booking / Cancel Booking — no auto-reply, handle manually
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[wa-webhook] Error", err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

async function sendText(to: string, text: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN!;
  const version       = process.env.WHATSAPP_API_VERSION ?? "v25.0";

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
        type: "text",
        text: { body: text },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    console.error("[wa-webhook] sendText failed", err);
  }
}
