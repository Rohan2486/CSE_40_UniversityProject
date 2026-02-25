import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")?.trim();
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")?.trim();
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL")?.trim() || "gpt-4o-mini";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-2.5-flash";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ExtraInfo = {
  summary: string;
  primaryUse: string;
  globalDistribution: string;
  climateAdaptation: string;
  notableTraits: string[];
  careTips: string[];
};

type TranslatePayload = {
  extraInfo?: unknown;
  language?: unknown;
};

type SupportedLanguage = "english" | "hindi" | "tamil";

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

const parseExtraInfo = (value: unknown): ExtraInfo | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  const primaryUse = typeof raw.primaryUse === "string" ? raw.primaryUse.trim() : "";
  const globalDistribution = typeof raw.globalDistribution === "string" ? raw.globalDistribution.trim() : "";
  const climateAdaptation = typeof raw.climateAdaptation === "string" ? raw.climateAdaptation.trim() : "";
  const notableTraits = Array.isArray(raw.notableTraits)
    ? raw.notableTraits.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 8)
    : [];
  const careTips = Array.isArray(raw.careTips)
    ? raw.careTips.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 8)
    : [];

  if (!summary || !primaryUse || !globalDistribution || !climateAdaptation || !notableTraits.length || !careTips.length) {
    return null;
  }

  return { summary, primaryUse, globalDistribution, climateAdaptation, notableTraits, careTips };
};

const mergeExtraInfo = (base: ExtraInfo, partial: Partial<ExtraInfo>): ExtraInfo => {
  const notableTraits = Array.isArray(partial.notableTraits) && partial.notableTraits.length > 0
    ? partial.notableTraits
    : base.notableTraits;
  const careTips = Array.isArray(partial.careTips) && partial.careTips.length > 0
    ? partial.careTips
    : base.careTips;

  return {
    summary: typeof partial.summary === "string" && partial.summary.trim().length > 0 ? partial.summary : base.summary,
    primaryUse: typeof partial.primaryUse === "string" && partial.primaryUse.trim().length > 0
      ? partial.primaryUse
      : base.primaryUse,
    globalDistribution: typeof partial.globalDistribution === "string" && partial.globalDistribution.trim().length > 0
      ? partial.globalDistribution
      : base.globalDistribution,
    climateAdaptation: typeof partial.climateAdaptation === "string" && partial.climateAdaptation.trim().length > 0
      ? partial.climateAdaptation
      : base.climateAdaptation,
    notableTraits,
    careTips,
  };
};

const hasMeaningfulChange = (source: ExtraInfo, translated: ExtraInfo) =>
  source.summary !== translated.summary ||
  source.primaryUse !== translated.primaryUse ||
  source.globalDistribution !== translated.globalDistribution ||
  source.climateAdaptation !== translated.climateAdaptation ||
  JSON.stringify(source.notableTraits) !== JSON.stringify(translated.notableTraits) ||
  JSON.stringify(source.careTips) !== JSON.stringify(translated.careTips);

const extractJsonObject = (text: string): Record<string, unknown> | null => {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    // continue
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
};

const buildPrompt = (extraInfo: ExtraInfo, language: SupportedLanguage) => {
  const target = languageMeta[language].label;
  return [
    `Translate the livestock profile JSON to ${target}.`,
    "Keep meaning accurate and domain-correct for cattle and buffalo farming.",
    "Return strict JSON with same keys only:",
    "summary, primaryUse, globalDistribution, climateAdaptation, notableTraits, careTips.",
    "Do not omit any item. Do not add extra keys.",
    `Input JSON: ${JSON.stringify(extraInfo)}`,
  ].join(" ");
};

const callOpenAi = async (prompt: string): Promise<Record<string, unknown> | null> => {
  if (!OPENAI_API_KEY) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a precise technical translator. Return only valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });
    if (!response.ok) {
      console.warn("translate-extra-info OpenAI failed:", response.status, await response.text());
      return null;
    }
    const data = await response.json() as Record<string, unknown>;
    const text = ((data.choices as Array<Record<string, unknown>> | undefined)?.[0]?.message as Record<string, unknown> | undefined)?.content;
    if (typeof text !== "string") return null;
    return extractJsonObject(text);
  } catch (error) {
    console.warn("translate-extra-info OpenAI error:", error);
    return null;
  }
};

const callGemini = async (prompt: string): Promise<Record<string, unknown> | null> => {
  if (!GEMINI_API_KEY) return null;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    if (!response.ok) {
      console.warn("translate-extra-info Gemini failed:", response.status, await response.text());
      return null;
    }
    const data = await response.json() as Record<string, unknown>;
    const candidate = (data.candidates as Array<Record<string, unknown>> | undefined)?.[0];
    const content = candidate?.content as Record<string, unknown> | undefined;
    const parts = content?.parts as Array<Record<string, unknown>> | undefined;
    const text = parts?.map((p) => (typeof p.text === "string" ? p.text : "")).join("\n").trim();
    if (!text) return null;
    return extractJsonObject(text);
  } catch (error) {
    console.warn("translate-extra-info Gemini error:", error);
    return null;
  }
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
    const body = await req.json() as TranslatePayload;
    const extraInfo = parseExtraInfo(body.extraInfo);
    if (!extraInfo) {
      return new Response(JSON.stringify({ error: "Invalid extraInfo payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const language = normalizeLanguage(body.language);
    if (language === "english") {
      return new Response(
        JSON.stringify({ extraInfo, language, locale: languageMeta[language].locale, provider: "passthrough" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!OPENAI_API_KEY && !GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "No LLM provider configured for translation. Set OPENAI_API_KEY or GEMINI_API_KEY.",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const prompt = buildPrompt(extraInfo, language);

    let translated: ExtraInfo | null = null;

    const openAiRaw = await callOpenAi(prompt);
    if (openAiRaw) {
      const openAiParsed = parseExtraInfo(openAiRaw) ??
        mergeExtraInfo(extraInfo, openAiRaw as Partial<ExtraInfo>);
      if (hasMeaningfulChange(extraInfo, openAiParsed)) {
        translated = openAiParsed;
      } else {
        console.warn("translate-extra-info OpenAI returned unchanged/invalid translation, trying Gemini.");
      }
    }

    if (!translated) {
      const geminiRaw = await callGemini(prompt);
      if (geminiRaw) {
        const geminiParsed = parseExtraInfo(geminiRaw) ??
          mergeExtraInfo(extraInfo, geminiRaw as Partial<ExtraInfo>);
        if (hasMeaningfulChange(extraInfo, geminiParsed)) {
          translated = geminiParsed;
        } else {
          console.warn("translate-extra-info Gemini returned unchanged/invalid translation.");
        }
      }
    }

    if (!translated) {
      return new Response(
        JSON.stringify({
          error: "LLM translation failed. Check function logs for provider response details.",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        extraInfo: translated,
        language,
        locale: languageMeta[language].locale,
        provider: "llm",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("translate-extra-info error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
