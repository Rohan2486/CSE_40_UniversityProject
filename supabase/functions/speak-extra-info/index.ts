import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")?.trim();
const OPENAI_TTS_MODEL = Deno.env.get("OPENAI_TTS_MODEL")?.trim() || "gpt-4o-mini-tts";
const OPENAI_TTS_VOICE = Deno.env.get("OPENAI_TTS_VOICE")?.trim() || "alloy";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type SupportedLanguage = "english" | "hindi" | "tamil";

type SpeakPayload = {
  text?: unknown;
  language?: unknown;
};

const languageMeta: Record<SupportedLanguage, { label: string; locale: string }> = {
  english: { label: "English", locale: "en-IN" },
  hindi: { label: "Hindi", locale: "hi-IN" },
  tamil: { label: "Tamil", locale: "ta-IN" },
};

const normalizeLanguage = (value: unknown): SupportedLanguage => {
  if (typeof value !== "string") return "english";
  const v = value.trim().toLowerCase();
  if (v === "hindi") return "hindi";
  if (v === "tamil") return "tamil";
  return "english";
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "No TTS provider configured. Set OPENAI_API_KEY for speak-extra-info.",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json() as SpeakPayload;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return new Response(JSON.stringify({ error: "Invalid text payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const language = normalizeLanguage(body.language);
    const meta = languageMeta[language];
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_TTS_MODEL,
        voice: OPENAI_TTS_VOICE,
        format: "mp3",
        input: text,
        instructions: `Speak naturally in ${meta.label} (${meta.locale}) with clear pronunciation for farm operators.`,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn("speak-extra-info OpenAI failed:", response.status, errText);
      return new Response(
        JSON.stringify({ error: `TTS request failed (${response.status}).` }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const audioBytes = new Uint8Array(await response.arrayBuffer());
    if (!audioBytes.length) {
      return new Response(JSON.stringify({ error: "TTS provider returned empty audio." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        audioBase64: toBase64(audioBytes),
        mimeType: "audio/mpeg",
        language,
        locale: meta.locale,
        provider: "openai",
        model: OPENAI_TTS_MODEL,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("speak-extra-info error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
