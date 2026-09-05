import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function formatDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeICal(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Missing token", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the room by its export token
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, ical_export_token")
      .eq("ical_export_token", token)
      .maybeSingle();

    if (roomError || !room) {
      return new Response("Room not found", { status: 404, headers: corsHeaders });
    }

    // Get all confirmed reservations for this room
    const { data: reservations, error: resError } = await supabase
      .from("reservations")
      .select("*")
      .eq("room_id", room.id)
      .in("status", ["confirmed", "blocked"]);

    if (resError) {
      return new Response("Error fetching reservations", { status: 500, headers: corsHeaders });
    }

    const now = formatDate(new Date());
    let events = "";

    for (const r of reservations || []) {
      const checkIn = new Date(r.check_in + "T00:00:00");
      const checkOut = new Date(r.check_out + "T00:00:00");
      const uid = r.ical_uid || `reservation-${r.id}@pousada`;
      const summary = r.status === "blocked" ? "Blocked" : `Reserved - ${r.guest_name}`;
      const description = r.status === "blocked"
        ? `Imported from ${r.source}`
        : `Guest: ${r.guest_name}`;

      events += [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${checkIn.toISOString().split("T")[0].replace(/-/g, "")}`,
        `DTEND;VALUE=DATE:${checkOut.toISOString().split("T")[0].replace(/-/g, "")}`,
        `SUMMARY:${escapeICal(summary)}`,
        `DESCRIPTION:${escapeICal(description)}`,
        "END:VEVENT",
      ].join("\r\n") + "\r\n";
    }

    const ical = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Pousada//Reservation System//PT",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      events,
      "END:VCALENDAR",
    ].join("\r\n");

    return new Response(ical, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="${room.name}.ics"`,
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
