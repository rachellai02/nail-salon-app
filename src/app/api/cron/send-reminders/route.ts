import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { format, parse, addDays } from "date-fns";
import { Appointment } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// ─── Auth ─────────────────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN) {
    return NextResponse.json({ error: "WhatsApp API not configured" }, { status: 503 });
  }

  // Compute tomorrow's date in Malaysia time (UTC+8)
  const nowMYT = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" })
  );
  const tomorrowMYT = addDays(nowMYT, 1);
  const targetDate = format(tomorrowMYT, "yyyy-MM-dd");

  console.log(`[send-reminders] Running for date: ${targetDate}`);

  // Fetch confirmed appointments tomorrow with a contact number
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("*")
    .eq("appointment_date", targetDate)
    .eq("status", "confirmed")
    .not("contact_number", "is", null);

  if (error) {
    console.error("[send-reminders] DB error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const appointments = (data ?? []) as Appointment[];
  console.log(`[send-reminders] Found ${appointments.length} appointment(s)`);

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN!;
  const version       = process.env.WHATSAPP_API_VERSION ?? "v19.0";

  const results: { id: string; status: "sent" | "failed"; error?: string }[] = [];

  for (const appt of appointments) {
    try {
      const digits = appt.contact_number!.replace(/\D/g, "");
      const to = digits.startsWith("60")
        ? digits
        : digits.startsWith("0")
        ? "60" + digits.slice(1)
        : "60" + digits;

      const apptDate = format(
        new Date(appt.appointment_date + "T00:00:00"),
        "EEEE, d MMMM yyyy"
      );
      const apptTime = format(
        parse(appt.start_time.slice(0, 5), "HH:mm", new Date()),
        "h:mm a"
      );

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
                    { type: "text", text: appt.customer_name },
                    { type: "text", text: apptDate },
                    { type: "text", text: apptTime },
                    { type: "text", text: String(appt.num_persons) },
                  ],
                },
              ],
            },
          }),
        }
      );

      const body = await res.json();
      console.log(`[send-reminders] appt=${appt.id} to=${to} status=${res.status}`, JSON.stringify(body));
      results.push({ id: appt.id, status: res.ok ? "sent" : "failed", error: res.ok ? undefined : (body as { error?: { message?: string } })?.error?.message });
    } catch (err) {
      console.error(`[send-reminders] appt=${appt.id} error:`, err);
      results.push({ id: appt.id, status: "failed", error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  const sent   = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;
  console.log(`[send-reminders] Done: ${sent} sent, ${failed} failed`);

  return NextResponse.json({ targetDate, sent, failed, results });
}
