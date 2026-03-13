import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.5";
import { parse } from "https://deno.land/std@0.168.0/encoding/csv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type SyncPayload = {
  dataset_name: string;
  source?: string;
  meta?: Record<string, unknown>;
  records?: Record<string, unknown>[];
  format?: "json" | "csv";
  csv?: string;
};

const FEATURE_VECTOR_BINS = 32;

const buildFeatureVectorFromBytes = (bytes: Uint8Array) => {
  const histogram = new Array<number>(FEATURE_VECTOR_BINS).fill(0);
  if (!bytes.length) return histogram;

  for (const byte of bytes) {
    const bucket = Math.min(FEATURE_VECTOR_BINS - 1, Math.floor((byte / 256) * FEATURE_VECTOR_BINS));
    histogram[bucket] += 1;
  }

  const magnitude = Math.sqrt(histogram.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) return histogram;
  return histogram.map((value) => Number((value / magnitude).toFixed(6)));
};

const readImageUrl = (record: Record<string, unknown>) => {
  for (const key of ["image_url", "imageUrl", "image_path", "imagePath", "image", "url"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const buildFeatureVectorFromRecord = async (record: Record<string, unknown>) => {
  const existing = record.feature_vector ?? record.featureVector ?? record.features;
  if (Array.isArray(existing)) {
    const values = existing.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    if (values.length > 0) return values;
  }

  const imageUrl = readImageUrl(record);
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) return null;
    return buildFeatureVectorFromBytes(bytes);
  } catch (_error) {
    return null;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SyncPayload;

    if (!body?.dataset_name) {
      return new Response(
        JSON.stringify({ error: "dataset_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SUPABASE_URL = Deno.env.get("PROJECT_URL") ?? Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY =
      Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Supabase service credentials are missing");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const normalizedRecords = await (async () => {
      if (Array.isArray(body.records)) return body.records;
      if (body.format === "csv" && typeof body.csv === "string") {
        const rows = await parse(body.csv, { skipFirstRow: false });
        if (!rows.length) return [];
        const [headerRow, ...dataRows] = rows;
        const headers = headerRow.map((h) => String(h).trim());
        return dataRows.map((row) =>
          headers.reduce<Record<string, unknown>>((acc, key, i) => {
            acc[key] = row[i];
            return acc;
          }, {})
        );
      }
      return [];
    })();

    if (!normalizedRecords.length) {
      return new Response(
        JSON.stringify({ error: "records[] or csv is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: dataset, error: datasetError } = await supabase
      .from("datasets")
      .upsert(
        {
          name: body.dataset_name,
          source: body.source ?? null,
          meta: body.meta ?? {},
          records_count: normalizedRecords.length,
        },
        { onConflict: "name" },
      )
      .select("id")
      .single();

    if (datasetError || !dataset) {
      throw datasetError ?? new Error("Failed to upsert dataset");
    }

    const records = await Promise.all(normalizedRecords.map(async (rec) => ({
      dataset_id: dataset.id,
      data: rec,
      feature_vector: await buildFeatureVectorFromRecord(rec),
    })));

    const { error: deleteError } = await supabase
      .from("dataset_records")
      .delete()
      .eq("dataset_id", dataset.id);

    if (deleteError) {
      throw deleteError;
    }

    const { error: insertError } = await supabase
      .from("dataset_records")
      .insert(records);

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, dataset_id: dataset.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("sync-dataset error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
