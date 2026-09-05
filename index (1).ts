import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ICalEvent {
  uid: string;
  dtstart: string;
  dtend: string;
  summary: string;
  description: string;
}

function parseICal(text: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let inEvent = false;
  let current: Partial<ICalEvent> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
    } else if (trimmed === "END:VEVENT") {
      if (current.uid && current.dtstart && current.dtend) {
        events.push(current as ICalEvent);
      }
      inEvent = false;
    } else if (inEvent) {
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;
      const key = trimmed.substring(0, colonIdx).toUpperCase();
      const value = trimmed.substring(colonIdx + 1);

      if (key.startsWith("UID")) {
        current.uid = value;
      } else if (key.startsWith("DTSTART")) {
        current.dtstart = parseICalDate(value);
      } else if (key.startsWith("DTEND")) {
        current.dtend = parseICalDate(value);
      } else if (key.startsWith("SUMMARY")) {
        current.summary = value;
      } else if (key.startsWith("DESCRIPTION")) {
        current.description = value;
      }
    }
  }

  return events;
}

function parseICalDate(value: string): string {
  // Handle DATE format: 20260101
  if (/^\d{8}$/.test(value)) {
    return `${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`;
  }
  // Handle DATETIME format: 20260101T120000Z
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?Z?$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return value;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const feedId = body.feed_id;

    if (!feedId) {
      return new Response(
        JSON.stringify({ error: "Missing feed_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the feed
    const { data: feed, error: feedError } = await supabase
      .from("ical_feeds")
      .select("*")
      .eq("id", feedId)
      .maybeSingle();

    if (feedError || !feed) {
      return new Response(
        JSON.stringify({ error: "Feed not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the external iCal
    const res = await fetch(feed.feed_url, {
      headers: { "User-Agent": "Pousada-iCal-Sync/1.0" },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch feed: ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const icalText = await res.text();
    const events = parseICal(icalText);

    // Get existing imported blocks for this room to avoid duplicates
    const { data: existing } = await supabase
      .from("reservations")
      .select("ical_uid")
      .eq("room_id", feed.room_id)
      .eq("source", "ical_import")
      .not("ical_uid", "is", null);

    const existingUids = new Set((existing || []).map((r: any) => r.ical_uid));

    let inserted = 0;
    let skipped = 0;

    for (const event of events) {
      if (existingUids.has(event.uid)) {
        skipped++;
        continue;
      }

      const { error: insertError } = await supabase.from("reservations").insert({
        room_id: feed.room_id,
        guest_name: event.summary || "Blocked (OTA)",
        guest_document: "",
        guest_email: "",
        guest_phone: "",
        check_in: event.dtstart,
        check_out: event.dtend,
        num_adults: 0,
        num_children: 0,
        status: "blocked",
        source: "ical_import",
        ical_uid: event.uid,
      });

      if (insertError) {
        console.error("Insert error:", insertError.message);
      } else {
        inserted++;
      }
    }

    // Update last synced timestamp
    await supabase
      .from("ical_feeds")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", feedId);

    return new Response(
      JSON.stringify({ success: true, imported: inserted, skipped, total: events.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
