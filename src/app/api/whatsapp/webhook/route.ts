import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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
      console.log(`[wa-webhook] button payload="${payload}" from="${from}"`);

      if (payload.toLowerCase().includes("confirm") || isUUID(payload)) {
        await sendText(from, "Thanks and see you! 💅");
        await markCustomerConfirmed(from, isUUID(payload) ? payload : undefined);
      } else if (payload.toLowerCase().includes("edit") || payload.toLowerCase().includes("cancel")) {
        await sendDefaultReply(from);
        console.log(`[wa-webhook] default_reply sent for Edit/Cancel button from ${from}`);
      }
    }

    // Auto-reply with default_reply template for any regular incoming message
    if (type !== "button") {
      await sendDefaultReply(from);
      console.log(`[wa-webhook] default_reply template sent to ${from}`);
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[wa-webhook] Error", err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

async function markCustomerConfirmed(from: string, appointmentId?: string) {
  try {
    const supabase = supabaseAdmin();

    // If we have the exact appointment ID, update directly
    if (appointmentId) {
      const { error } = await supabase
        .from("appointments")
        .update({ customer_confirmed: true })
        .eq("id", appointmentId);
      if (error) console.error("[wa-webhook] update error", error);
      else console.log(`[wa-webhook] customer_confirmed=true for appt ${appointmentId} (direct)`);
      return;
    }

    // Use MYT (UTC+8) for date/time — same as the rest of the app
    const nowMYT   = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
    const pad      = (n: number) => String(n).padStart(2, "0");
    const today    = `${nowMYT.getFullYear()}-${pad(nowMYT.getMonth() + 1)}-${pad(nowMYT.getDate())}`;
    const nowTime  = `${pad(nowMYT.getHours())}:${pad(nowMYT.getMinutes())}:${pad(nowMYT.getSeconds())}`;

    // Normalise incoming phone digits
    const digits   = from.replace(/\D/g, "");
    const noPrefix = digits.startsWith("60") ? digits.slice(2) : digits.replace(/^0/, "");
    console.log(`[wa-webhook] markCustomerConfirmed from="${from}" digits="${digits}" noPrefix="${noPrefix}" today="${today}" nowTime="${nowTime}"`);

    // Fetch today's + future appointments ordered by date then time
    const { data, error } = await supabase
      .from("appointments")
      .select("id, contact_number, appointment_date, start_time")
      .gte("appointment_date", today)
      .neq("status", "cancelled")
      .order("appointment_date", { ascending: true })
      .order("start_time",       { ascending: true })
      .limit(50);

    if (error) { console.error("[wa-webhook] query error", error); return; }
    console.log(`[wa-webhook] found ${data?.length ?? 0} upcoming appointments`);
    data?.slice(0, 5).forEach((a) => console.log(`  appt id=${a.id} contact="${a.contact_number}" date=${a.appointment_date} time=${a.start_time}`));

    if (!data?.length) return;

    // Filter to appointments belonging to this phone number
    const matches = data.filter((a) => {
      const stored = (a.contact_number ?? "").replace(/\D/g, "");
      const hit = stored === digits || stored === `60${noPrefix}` || stored === noPrefix;
      if (!hit) console.log(`  no match: stored="${stored}" vs digits="${digits}" / "60${noPrefix}" / "${noPrefix}"`);
      return hit;
    });

    console.log(`[wa-webhook] phone matches: ${matches.length}`);
    if (!matches.length) return;

    // Pick the nearest upcoming appointment:
    // if same day, pick the one whose start_time >= now; else pick earliest future date
    const upcoming = matches.find(
      (a) => a.appointment_date > today ||
             (a.appointment_date === today && a.start_time >= nowTime)
    ) ?? matches[0];

    console.log(`[wa-webhook] updating appt id=${upcoming.id}`);
    const { error: updateError } = await supabase
      .from("appointments")
      .update({ customer_confirmed: true })
      .eq("id", upcoming.id);

    if (updateError) console.error("[wa-webhook] update error", updateError);
    else console.log(`[wa-webhook] customer_confirmed=true for appt ${upcoming.id} (${upcoming.appointment_date} ${upcoming.start_time})`);
  } catch (err) {
    console.error("[wa-webhook] markCustomerConfirmed error", err);
  }
}

async function sendDefaultReply(to: string) {
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
        type: "template",
        template: {
          name: "default_reply",
          language: { code: "en_US" },
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    console.error("[wa-webhook] sendDefaultReply failed", err);
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
