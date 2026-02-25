import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("PROJECT_URL") ?? Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY =
      Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Supabase service credentials are missing");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const [{ count: breedCount }, { count: datasetCount }, { count: recordCount }, { count: classificationCount }] =
      await Promise.all([
        supabase.from("breeds").select("*", { count: "exact", head: true }),
        supabase.from("datasets").select("*", { count: "exact", head: true }),
        supabase.from("dataset_records").select("*", { count: "exact", head: true }),
        supabase.from("classifications").select("*", { count: "exact", head: true }),
      ]);

    return new Response(
      JSON.stringify({
        breeds: breedCount ?? 0,
        datasets: datasetCount ?? 0,
        records: recordCount ?? 0,
        classifications: classificationCount ?? 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("get-stats error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
