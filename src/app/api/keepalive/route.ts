import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const keepaliveToken = process.env.KEEPALIVE_TOKEN;

  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  const queryToken = request.nextUrl.searchParams.get("token");

  if (cronSecret && bearerToken === cronSecret) {
    return true;
  }

  if (keepaliveToken && queryToken === keepaliveToken) {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = process.env.SUPABASE_KEEPALIVE_TABLE ?? "customers";

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.",
      },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Keepalive should touch the database with minimal load.
  const { error } = await supabase
    .from(table)
    .select("*", { head: true, count: "exact" })
    .limit(1);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, table },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    table,
    timestamp: new Date().toISOString(),
  });
}
