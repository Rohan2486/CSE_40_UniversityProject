import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.5";

const CNN_INFERENCE_URL = Deno.env.get("CNN_INFERENCE_URL")?.trim();
const CNN_INFERENCE_API_KEY = Deno.env.get("CNN_INFERENCE_API_KEY")?.trim();
const CNN_MIN_CONFIDENCE = Math.max(0, Number(Deno.env.get("CNN_MIN_CONFIDENCE") ?? 45));
const CNN_TIMEOUT_MS = Math.max(1000, Number(Deno.env.get("CNN_TIMEOUT_MS") ?? 7000));
const DATASET_CACHE_TTL_MS = Math.max(30_000, Number(Deno.env.get("DATASET_CACHE_TTL_MS") ?? 300_000));
const SUPABASE_PROJECT_URL = (Deno.env.get("PROJECT_URL") ?? Deno.env.get("SUPABASE_URL") ?? "").trim();
const DATASET_IMAGE_BUCKET = (Deno.env.get("DATASET_IMAGE_BUCKET") ?? "classification-images").trim();
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")?.trim();
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")?.trim();
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL")?.trim() || "gpt-4o-mini";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-2.5-flash";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CATTLE_BREEDS = [
  "Gir",
  "Sahiwal",
  "Red Sindhi",
  "Tharparkar",
  "Rathi",
  "Kankrej",
  "Ongole",
  "Hariana",
  "Kangayam",
  "Bargur",
  "Dangi",
  "Deoni",
  "Khillari",
  "Krishna Valley",
  "Amritmahal",
  "Hallikar",
  "Malnad Gidda",
  "Vechur",
  "Punganur",
  "Kasaragod Dwarf",
];

const BUFFALO_BREEDS = [
  "Murrah",
  "Jaffarabadi",
  "Surti",
  "Mehsana",
  "Nili-Ravi",
  "Nagpuri",
  "Pandharpuri",
  "Toda",
  "Bhadawari",
  "Marathwadi",
  "Chilika",
  "Kalahandi",
];

const BODY_TRAITS = [
  "Body Length",
  "Height at Withers",
  "Chest Girth",
  "Rump Angle",
  "Udder Attachment",
  "Body Condition",
];

type InferenceMode = "auto" | "llm_only";
type AnimalType = "cattle" | "buffalo";

type ClassifyPayload = {
  imageData?: unknown;
  cvMetrics?: unknown;
  cvWarnings?: unknown;
  inferenceMode?: unknown;
};

type CvMetrics = {
  brightness: number;
  contrast: number;
  sharpness: number;
  width: number;
  height: number;
};

type Trait = {
  name: string;
  value: string;
  score: number;
};

type ClassificationResponse = {
  type: AnimalType;
  breed: string;
  confidence: number;
  modelConfidence?: number;
  traits: Trait[];
  recommendations: string;
  provider?: "cnn" | "llm" | "fallback";
  extraInfo?: {
    summary: string;
    primaryUse: string;
    globalDistribution: string;
    climateAdaptation: string;
    notableTraits: string[];
    careTips: string[];
  };
  accuracyReports?: {
    model: {
      name: string;
      confidence: number;
      calibratedConfidence: number;
    };
    dataset: {
      name: string;
      matchedBreed: string;
      similarity: number;
      imageUrl?: string;
      matchMode: "exact" | "fuzzy" | "none";
    };
  };
};

type KnownBreeds = {
  cattle: string[];
  buffalo: string[];
};

type DatasetLabel = {
  breed: string;
  normalizedBreed: string;
  type: AnimalType;
  datasetName: string;
  imageUrl?: string;
};

let datasetLabelCache: { labels: DatasetLabel[]; hasCustomLabels: boolean; expiresAt: number } | null = null;

type ExtraInfo = NonNullable<ClassificationResponse["extraInfo"]>;

const modelNameForProvider = (provider: ClassificationResponse["provider"]) =>
  provider === "llm" ? "LLM Vision Fallback" : "CNN Inference";

const buildExtraInfo = ({
  type,
  breed,
  warnings,
}: {
  type: AnimalType;
  breed: string;
  warnings: string[];
}): ExtraInfo => {
  const isUnknown = !breed || breed === "Unknown";
  const summary = isUnknown
    ? `This appears to be a ${type}. Breed-level confidence is limited for this image.`
    : `${breed} identified as ${type}. This profile includes practical field guidance.`;

  const primaryUse = type === "buffalo"
    ? "High-fat milk production, draft utility in some regions, and breeding value."
    : "Milk and/or dual-purpose utility depending on local breeding line.";

  const globalDistribution = type === "buffalo"
    ? "Mainly found in South Asia (India, Pakistan), with notable populations in parts of Southeast Asia, the Middle East, the Mediterranean, and South America."
    : "Found worldwide, with major populations in South Asia, Europe, North and South America, Africa, and Oceania through dairy and beef production systems.";

  const climateAdaptation = type === "buffalo"
    ? "Performs best with heat-stress management, shade, and regular water access."
    : "Generally adaptable; productivity improves with breed-suited climate and housing.";

  const notableTraits = type === "buffalo"
    ? [
      "Typically higher milk fat compared to many cattle breeds.",
      "Strong body frame and good endurance in humid-warm environments.",
      isUnknown ? "Capture side and head images for stronger breed discrimination." : `${breed}-specific morphology should be verified across multiple angles.`,
    ]
    : [
      "Body conformation and head profile are key for breed discrimination.",
      "Milk/draft orientation can vary significantly by regional line.",
      isUnknown ? "Capture full-body daylight images to improve breed confidence." : `${breed} traits should be validated with head, horn, and coat markers.`,
    ];

  const careTipsBase = type === "buffalo"
    ? [
      "Provide shade, cooling, and continuous access to clean water.",
      "Prioritize parasite control and hoof hygiene in wet conditions.",
      "Use balanced mineral supplementation for production stages.",
    ]
    : [
      "Maintain balanced feed with adequate protein, fiber, and minerals.",
      "Follow routine vaccination and deworming schedules.",
      "Track body condition score to adjust nutrition early.",
    ];

  const careTips = warnings.length > 0
    ? [...careTipsBase, "For better AI assessment, upload sharp full-body images with stable lighting."]
    : careTipsBase;

  return {
    summary,
    primaryUse,
    globalDistribution,
    climateAdaptation,
    notableTraits,
    careTips,
  };
};

const normalizeExtraInfo = (raw: Record<string, unknown>, fallback: ExtraInfo): ExtraInfo => {
  const summary = typeof raw.summary === "string" && raw.summary.trim() ? raw.summary.trim() : fallback.summary;
  const primaryUse = typeof raw.primaryUse === "string" && raw.primaryUse.trim()
    ? raw.primaryUse.trim()
    : fallback.primaryUse;
  const globalDistribution = typeof raw.globalDistribution === "string" && raw.globalDistribution.trim()
    ? raw.globalDistribution.trim()
    : fallback.globalDistribution;
  const climateAdaptation = typeof raw.climateAdaptation === "string" && raw.climateAdaptation.trim()
    ? raw.climateAdaptation.trim()
    : fallback.climateAdaptation;
  const notableTraits = Array.isArray(raw.notableTraits)
    ? raw.notableTraits.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 6)
    : fallback.notableTraits;
  const careTips = Array.isArray(raw.careTips)
    ? raw.careTips.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 6)
    : fallback.careTips;

  return {
    summary,
    primaryUse,
    globalDistribution,
    climateAdaptation,
    notableTraits: notableTraits.length ? notableTraits : fallback.notableTraits,
    careTips: careTips.length ? careTips : fallback.careTips,
  };
};

const normalizeInferenceMode = (value: unknown): InferenceMode =>
  value === "llm_only" ? "llm_only" : "auto";

const normalizeType = (value: unknown): AnimalType =>
  value === "buffalo" ? "buffalo" : "cattle";

const normalizeConfidence = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, Math.round(parsed)));
};

const normalizeText = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const parseDataUrl = (dataUrl: string): { mimeType: string; base64: string } | null => {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
};

const extractJsonObject = (text: string): Record<string, unknown> | null => {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    // continue with substring parse
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  const slice = trimmed.slice(firstBrace, lastBrace + 1);
  try {
    const parsed = JSON.parse(slice) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
};

const toPublicStorageUrl = (input: string | null) => {
  if (!input) return undefined;
  if (/^https?:\/\//i.test(input)) return input;
  if (!SUPABASE_PROJECT_URL || !DATASET_IMAGE_BUCKET) return undefined;
  const cleaned = input.replace(/^\/+/, "");
  const objectPath = cleaned.startsWith(`${DATASET_IMAGE_BUCKET}/`)
    ? cleaned.slice(DATASET_IMAGE_BUCKET.length + 1)
    : cleaned;
  const encodedPath = objectPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${SUPABASE_PROJECT_URL}/storage/v1/object/public/${encodeURIComponent(DATASET_IMAGE_BUCKET)}/${encodedPath}`;
};

const normalizeTypeFromRecord = (value: unknown): AnimalType | null => {
  if (typeof value !== "string") return null;
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (normalized.includes("buffalo")) return "buffalo";
  if (normalized.includes("cattle") || normalized.includes("cow")) return "cattle";
  return null;
};

const readStringFromKeys = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const extractDatasetLabel = (data: unknown): DatasetLabel | null => {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const breed = readStringFromKeys(record, ["breed", "breed_name", "name", "label", "class"]);
  const typeRaw =
    readStringFromKeys(record, ["type", "animal_type", "animalType", "species", "category"]) ?? "";

  if (!breed) return null;
  const type = normalizeTypeFromRecord(typeRaw) ?? "cattle";
  const normalizedBreed = normalizeText(breed);
  const imageRef = readStringFromKeys(record, [
    "image_url",
    "imageUrl",
    "image_path",
    "imagePath",
    "image",
    "url",
  ]);
  if (!normalizedBreed) return null;
  return { breed, normalizedBreed, type, datasetName: "Default", imageUrl: toPublicStorageUrl(imageRef) };
};

const defaultDatasetLabels = (): DatasetLabel[] => [
  ...CATTLE_BREEDS.map((breed) => ({
    breed,
    normalizedBreed: normalizeText(breed),
    type: "cattle" as const,
    datasetName: "Built-in Breeds",
  })),
  ...BUFFALO_BREEDS.map((breed) => ({
    breed,
    normalizedBreed: normalizeText(breed),
    type: "buffalo" as const,
    datasetName: "Built-in Breeds",
  })),
];

const dedupeDatasetLabels = (labels: DatasetLabel[]) => {
  const byKey = new Map<string, DatasetLabel>();
  for (const label of labels) {
    byKey.set(`${label.type}|${label.normalizedBreed}`, label);
  }
  return [...byKey.values()];
};

const loadDatasetLabels = async (): Promise<{ labels: DatasetLabel[]; hasCustomLabels: boolean }> => {
  const now = Date.now();
  if (datasetLabelCache && datasetLabelCache.expiresAt > now) {
    return { labels: datasetLabelCache.labels, hasCustomLabels: datasetLabelCache.hasCustomLabels };
  }

  const supabaseUrl = Deno.env.get("PROJECT_URL") ?? Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    const fallback = defaultDatasetLabels();
    datasetLabelCache = { labels: fallback, hasCustomLabels: false, expiresAt: now + DATASET_CACHE_TTL_MS };
    return { labels: fallback, hasCustomLabels: false };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const labels: DatasetLabel[] = [];
  let hasCustomLabels = false;

  const pageSize = 1000;
  for (let offset = 0; offset < 50000; offset += pageSize) {
    const { data: records, error: recordsError } = await supabase
      .from("dataset_records")
      .select("data,datasets(name)")
      .range(offset, offset + pageSize - 1);
    if (recordsError || !Array.isArray(records) || records.length === 0) break;

    hasCustomLabels = true;
    for (const row of records as Array<{ data?: unknown; datasets?: unknown }>) {
      const parsed = extractDatasetLabel(row.data);
      if (!parsed) continue;
      const relation = row.datasets;
      const relationName =
        relation && typeof relation === "object" && !Array.isArray(relation) &&
          typeof (relation as { name?: unknown }).name === "string"
          ? (relation as { name: string }).name.trim()
          : "";
      labels.push({
        ...parsed,
        datasetName: relationName || parsed.datasetName,
      });
    }
    if (records.length < pageSize) break;
  }

  for (let offset = 0; offset < 50000; offset += pageSize) {
    const { data: breeds, error: breedsError } = await supabase
      .from("breeds")
      .select("name,type")
      .range(offset, offset + pageSize - 1);
    if (breedsError || !Array.isArray(breeds) || breeds.length === 0) break;

    hasCustomLabels = true;
    for (const row of breeds as Array<{ name?: unknown; type?: unknown }>) {
      if (typeof row.name !== "string" || row.name.trim().length === 0) continue;
      const normalizedBreed = normalizeText(row.name);
      if (!normalizedBreed) continue;
      const type = normalizeTypeFromRecord(row.type) ?? "cattle";
      labels.push({
        breed: row.name.trim(),
        normalizedBreed,
        type,
        datasetName: "Breeds Table",
      });
    }
    if (breeds.length < pageSize) break;
  }

  const deduped = dedupeDatasetLabels(labels);
  const resolved = deduped.length > 0 ? deduped : defaultDatasetLabels();
  datasetLabelCache = { labels: resolved, hasCustomLabels, expiresAt: now + DATASET_CACHE_TTL_MS };
  return { labels: resolved, hasCustomLabels };
};

const buildKnownBreeds = (labels: DatasetLabel[]): KnownBreeds => {
  const cattle = new Set<string>();
  const buffalo = new Set<string>();

  for (const label of labels) {
    if (label.type === "buffalo") {
      buffalo.add(label.breed);
    } else {
      cattle.add(label.breed);
    }
  }

  const fallbackCattle = CATTLE_BREEDS.filter((breed) => !cattle.has(breed));
  const fallbackBuffalo = BUFFALO_BREEDS.filter((breed) => !buffalo.has(breed));

  return {
    cattle: [...cattle, ...fallbackCattle],
    buffalo: [...buffalo, ...fallbackBuffalo],
  };
};

const levenshteinDistance = (a: string, b: string) => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[a.length][b.length];
};

const similarityScore = (a: string, b: string) => {
  const maxLen = Math.max(a.length, b.length, 1);
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
};

const matchLabel = (breed: string, type: AnimalType, labels: DatasetLabel[]) => {
  const normalized = normalizeText(breed);
  if (!normalized) return null;

  const exact = labels.find((label) => label.type === type && label.normalizedBreed === normalized)
    ?? labels.find((label) => label.normalizedBreed === normalized);
  if (exact) {
    return { label: exact, score: 1, mode: "exact" as const };
  }

  let best: { label: DatasetLabel; score: number } | null = null;
  const pool = labels.filter((label) => label.type === type);
  const searchPool = pool.length > 0 ? pool : labels;

  for (const label of searchPool) {
    const score = similarityScore(normalized, label.normalizedBreed);
    if (!best || score > best.score) {
      best = { label, score };
    }
  }

  if (best && best.score >= 0.82) {
    return { label: best.label, score: best.score, mode: "fuzzy" as const };
  }

  return null;
};

const enforceDatasetMatch = (
  result: ClassificationResponse,
  labels: DatasetLabel[],
  strictDatasetMatching: boolean,
): ClassificationResponse => {
  const modelName = modelNameForProvider(result.provider);
  if (!strictDatasetMatching) {
    const similarity = result.breed !== "Unknown" ? 100 : 0;
    return {
      ...result,
      accuracyReports: {
        model: {
          name: modelName,
          confidence: result.modelConfidence ?? result.confidence,
          calibratedConfidence: result.confidence,
        },
        dataset: {
          name: "Global (No Synced Dataset)",
          matchedBreed: result.breed,
          similarity,
          matchMode: similarity > 0 ? "exact" : "none",
        },
      },
    };
  }

  if (!labels.length || result.breed === "Unknown") {
    return {
      ...result,
      accuracyReports: {
        model: {
          name: modelName,
          confidence: result.modelConfidence ?? result.confidence,
          calibratedConfidence: result.confidence,
        },
        dataset: {
          name: "No Dataset",
          matchedBreed: "Unknown",
          similarity: 0,
          matchMode: "none",
        },
      },
    };
  }

  const matched = matchLabel(result.breed, result.type, labels);
  if (!matched) {
    return {
      ...result,
      breed: "Unknown",
      confidence: Math.min(result.confidence, 35),
      recommendations:
        "Prediction did not match your synced dataset labels. Upload clearer images or sync the correct dataset.",
      accuracyReports: {
        model: {
          name: modelName,
          confidence: result.modelConfidence ?? result.confidence,
          calibratedConfidence: Math.min(result.confidence, 35),
        },
        dataset: {
          name: "No Match",
          matchedBreed: "Unknown",
          similarity: 0,
          matchMode: "none",
        },
      },
    };
  }

  let nextConfidence = result.confidence;
  if (matched.mode === "exact") {
    nextConfidence = Math.min(100, nextConfidence + 4);
  } else {
    nextConfidence = Math.max(0, Math.round(nextConfidence * 0.94));
  }

  if (matched.label.type !== result.type) {
    nextConfidence = Math.max(0, nextConfidence - 5);
  }

  const typeAdjusted = matched.label.type !== result.type;
  const recommendationPrefix = matched.mode === "fuzzy"
    ? `Matched to nearest dataset breed: ${matched.label.breed}. `
    : "";
  const typeNote = typeAdjusted ? `Type aligned to dataset (${matched.label.type}). ` : "";

  return {
    ...result,
    type: matched.label.type,
    breed: matched.label.breed,
    confidence: nextConfidence,
    recommendations: `${recommendationPrefix}${typeNote}${result.recommendations}`.trim(),
    accuracyReports: {
      model: {
        name: modelName,
        confidence: result.modelConfidence ?? result.confidence,
        calibratedConfidence: nextConfidence,
      },
      dataset: {
        name: matched.label.datasetName,
        matchedBreed: matched.label.breed,
        similarity: Math.round(matched.score * 100),
        imageUrl: matched.label.imageUrl,
        matchMode: matched.mode,
      },
    },
  };
};

const normalizeCvMetrics = (value: unknown): CvMetrics => {
  const safe = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const asNumber = (input: unknown, fallback: number) => {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  return {
    brightness: Math.min(255, Math.max(0, asNumber(safe.brightness, 128))),
    contrast: Math.min(255, Math.max(0, asNumber(safe.contrast, 32))),
    sharpness: Math.min(255, Math.max(0, asNumber(safe.sharpness, 30))),
    width: Math.min(8192, Math.max(1, asNumber(safe.width, 1024))),
    height: Math.min(8192, Math.max(1, asNumber(safe.height, 1024))),
  };
};

const normalizeWarnings = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .slice(0, 10)
    : [];

const normalizeTraits = (value: unknown): Trait[] => {
  const incoming = Array.isArray(value) ? value : [];
  const lookup = new Map<string, Trait>();

  for (const item of incoming) {
    if (!item || typeof item !== "object") continue;
    const rawName = (item as { name?: unknown }).name;
    if (typeof rawName !== "string" || !rawName.trim()) continue;
    const rawValue = (item as { value?: unknown }).value;
    const rawScore = Number((item as { score?: unknown }).score);
    lookup.set(rawName, {
      name: rawName,
      value: typeof rawValue === "string" && rawValue.trim().length > 0 ? rawValue : "Unavailable",
      score: Number.isFinite(rawScore) ? Math.min(10, Math.max(1, Math.round(rawScore))) : 5,
    });
  }

  return BODY_TRAITS.map((name) => lookup.get(name) ?? { name, value: "Unavailable", score: 5 });
};

const deriveQualityScore = (metrics: CvMetrics) => {
  const brightnessScore = Math.max(0, 1 - Math.abs(metrics.brightness - 128) / 128);
  const contrastScore = Math.min(1, metrics.contrast / 64);
  const sharpnessScore = Math.min(1, metrics.sharpness / 60);
  const resolutionScore = Math.min(1, Math.min(metrics.width, metrics.height) / 1024);
  return Math.round(
    (brightnessScore * 0.3 + contrastScore * 0.25 + sharpnessScore * 0.3 + resolutionScore * 0.15) * 100,
  );
};

const deriveTraitReliabilityScore = (traits: Trait[]) => {
  if (!traits.length) return 0;
  const availableRatio = traits.filter((t) => t.value !== "Unavailable").length / traits.length;
  const meanScore = traits.reduce((sum, t) => sum + t.score, 0) / traits.length;
  const normalizedMean = Math.min(1, Math.max(0, meanScore / 10));
  return Math.round((availableRatio * 0.7 + normalizedMean * 0.3) * 100);
};

const calibrateConfidence = ({
  modelConfidence,
  qualityScore,
  traitReliabilityScore,
  warningCount,
  lowMargin,
  highEntropy,
}: {
  modelConfidence: number;
  qualityScore: number;
  traitReliabilityScore: number;
  warningCount: number;
  lowMargin: boolean;
  highEntropy: boolean;
}) => {
  const blended = modelConfidence * 0.68 + qualityScore * 0.22 + traitReliabilityScore * 0.1;
  const warningPenalty = Math.min(20, warningCount * 3);
  const marginPenalty = lowMargin ? 7 : 0;
  const entropyPenalty = highEntropy ? 6 : 0;
  return Math.min(100, Math.max(0, Math.round(blended - warningPenalty - marginPenalty - entropyPenalty)));
};

const buildLlmPrompt = (knownBreeds: KnownBreeds, cvWarnings: string[]) => {
  const warningsText = cvWarnings.length ? cvWarnings.join(" | ") : "none";
  return [
    "Classify the animal in this image.",
    "Return strict JSON only with keys: type, breed, confidence, recommendations, traits.",
    'type must be "cattle" or "buffalo".',
    "confidence must be integer 0..100.",
    "traits must be array of 6 objects with keys: name, value, score.",
    `Known cattle breeds: ${knownBreeds.cattle.join(", ")}.`,
    `Known buffalo breeds: ${knownBreeds.buffalo.join(", ")}.`,
    `Image quality warnings: ${warningsText}.`,
    "If uncertain, still pick the closest likely breed with lower confidence and explain briefly in recommendations.",
  ].join(" ");
};

const normalizeLlmResult = (
  raw: Record<string, unknown>,
  cvMetrics: CvMetrics,
  cvWarnings: string[],
): ClassificationResponse => {
  const type = normalizeType(raw.type);
  const breed = typeof raw.breed === "string" && raw.breed.trim() ? raw.breed.trim() : "Unknown";
  const modelConfidence = normalizeConfidence(raw.confidence);
  const traits = normalizeTraits(raw.traits);
  const qualityScore = deriveQualityScore(cvMetrics);
  const traitReliabilityScore = deriveTraitReliabilityScore(traits);
  const confidence = calibrateConfidence({
    modelConfidence,
    qualityScore,
    traitReliabilityScore,
    warningCount: cvWarnings.length,
    lowMargin: false,
    highEntropy: false,
  });
  const recommendations = typeof raw.recommendations === "string" && raw.recommendations.trim().length > 0
    ? raw.recommendations
    : "LLM-based prediction generated. Capture an additional angle to verify.";

  return {
    type,
    breed,
    confidence,
    modelConfidence,
    traits,
    recommendations,
    provider: "llm",
  };
};

const callOpenAiVision = async ({
  imageData,
  prompt,
  cvMetrics,
  cvWarnings,
}: {
  imageData: string;
  prompt: string;
  cvMetrics: CvMetrics;
  cvWarnings: string[];
}): Promise<ClassificationResponse | null> => {
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
            content: "You are an expert livestock vision classifier. Return only valid JSON.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageData } },
            ],
          },
        ],
      }),
    });
    if (!response.ok) {
      console.warn("OpenAI fallback failed:", response.status, await response.text());
      return null;
    }
    const data = await response.json() as Record<string, unknown>;
    const text = ((data.choices as Array<Record<string, unknown>> | undefined)?.[0]?.message as Record<string, unknown> | undefined)?.content;
    if (typeof text !== "string") return null;
    const parsed = extractJsonObject(text);
    if (!parsed) return null;
    return normalizeLlmResult(parsed, cvMetrics, cvWarnings);
  } catch (error) {
    console.warn("OpenAI fallback exception:", error);
    return null;
  }
};

const callGeminiVision = async ({
  imageData,
  prompt,
  cvMetrics,
  cvWarnings,
}: {
  imageData: string;
  prompt: string;
  cvMetrics: CvMetrics;
  cvWarnings: string[];
}): Promise<ClassificationResponse | null> => {
  if (!GEMINI_API_KEY) return null;
  const parsedDataUrl = parseDataUrl(imageData);
  if (!parsedDataUrl) return null;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: parsedDataUrl.mimeType,
                    data: parsedDataUrl.base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    if (!response.ok) {
      console.warn("Gemini fallback failed:", response.status, await response.text());
      return null;
    }
    const data = await response.json() as Record<string, unknown>;
    const candidate = (data.candidates as Array<Record<string, unknown>> | undefined)?.[0];
    const content = candidate?.content as Record<string, unknown> | undefined;
    const parts = content?.parts as Array<Record<string, unknown>> | undefined;
    const text = parts?.map((part) => (typeof part.text === "string" ? part.text : "")).join("\n").trim();
    if (!text) return null;
    const parsed = extractJsonObject(text);
    if (!parsed) return null;
    return normalizeLlmResult(parsed, cvMetrics, cvWarnings);
  } catch (error) {
    console.warn("Gemini fallback exception:", error);
    return null;
  }
};

const callLlmFallback = async ({
  imageData,
  cvMetrics,
  cvWarnings,
  knownBreeds,
}: {
  imageData: string;
  cvMetrics: CvMetrics;
  cvWarnings: string[];
  knownBreeds: KnownBreeds;
}): Promise<ClassificationResponse | null> => {
  const prompt = buildLlmPrompt(knownBreeds, cvWarnings);
  const openAi = await callOpenAiVision({ imageData, prompt, cvMetrics, cvWarnings });
  if (openAi) return openAi;
  return await callGeminiVision({ imageData, prompt, cvMetrics, cvWarnings });
};

const buildExtraInfoPrompt = ({
  type,
  breed,
  knownBreeds,
  warnings,
}: {
  type: AnimalType;
  breed: string;
  knownBreeds: KnownBreeds;
  warnings: string[];
}) => {
  const warningsText = warnings.length ? warnings.join(" | ") : "none";
  return [
    "Generate practical livestock profile details for the predicted animal.",
    "Return strict JSON only with keys: summary, primaryUse, globalDistribution, climateAdaptation, notableTraits, careTips.",
    `Predicted type: ${type}. Predicted breed: ${breed}.`,
    `Known cattle breeds: ${knownBreeds.cattle.join(", ")}.`,
    `Known buffalo breeds: ${knownBreeds.buffalo.join(", ")}.`,
    `Image quality warnings: ${warningsText}.`,
    "notableTraits and careTips must be string arrays (3 to 6 concise points each).",
    "Keep output factual, practical, and farm-oriented.",
  ].join(" ");
};

const callOpenAiExtraInfo = async ({
  imageData,
  prompt,
}: {
  imageData: string;
  prompt: string;
}): Promise<Record<string, unknown> | null> => {
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
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a livestock expert assistant. Return only valid JSON.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageData } },
            ],
          },
        ],
      }),
    });
    if (!response.ok) {
      console.warn("OpenAI extraInfo failed:", response.status, await response.text());
      return null;
    }
    const data = await response.json() as Record<string, unknown>;
    const text = ((data.choices as Array<Record<string, unknown>> | undefined)?.[0]?.message as Record<string, unknown> | undefined)?.content;
    if (typeof text !== "string") return null;
    return extractJsonObject(text);
  } catch (error) {
    console.warn("OpenAI extraInfo exception:", error);
    return null;
  }
};

const callGeminiExtraInfo = async ({
  imageData,
  prompt,
}: {
  imageData: string;
  prompt: string;
}): Promise<Record<string, unknown> | null> => {
  if (!GEMINI_API_KEY) return null;
  const parsedDataUrl = parseDataUrl(imageData);
  if (!parsedDataUrl) return null;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: parsedDataUrl.mimeType,
                    data: parsedDataUrl.base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    if (!response.ok) {
      console.warn("Gemini extraInfo failed:", response.status, await response.text());
      return null;
    }
    const data = await response.json() as Record<string, unknown>;
    const candidate = (data.candidates as Array<Record<string, unknown>> | undefined)?.[0];
    const content = candidate?.content as Record<string, unknown> | undefined;
    const parts = content?.parts as Array<Record<string, unknown>> | undefined;
    const text = parts?.map((part) => (typeof part.text === "string" ? part.text : "")).join("\n").trim();
    if (!text) return null;
    return extractJsonObject(text);
  } catch (error) {
    console.warn("Gemini extraInfo exception:", error);
    return null;
  }
};

const enrichExtraInfoWithLlm = async ({
  imageData,
  type,
  breed,
  knownBreeds,
  warnings,
}: {
  imageData: string;
  type: AnimalType;
  breed: string;
  knownBreeds: KnownBreeds;
  warnings: string[];
}): Promise<ExtraInfo> => {
  const fallback = buildExtraInfo({ type, breed, warnings });
  const prompt = buildExtraInfoPrompt({ type, breed, knownBreeds, warnings });

  const openAi = await callOpenAiExtraInfo({ imageData, prompt });
  if (openAi) return normalizeExtraInfo(openAi, fallback);

  const gemini = await callGeminiExtraInfo({ imageData, prompt });
  if (gemini) return normalizeExtraInfo(gemini, fallback);

  return fallback;
};

const fallbackClassification = (warnings: string[]): ClassificationResponse => ({
  type: "cattle",
  breed: "Unknown",
  confidence: 0,
  modelConfidence: 0,
  traits: BODY_TRAITS.map((name) => ({ name, value: "Unable to assess", score: 5 })),
  recommendations: warnings.length > 0
    ? `Unable to classify from this image. ${warnings.slice(0, 2).join(" ")}`
    : "Unable to classify from this image. Use a clearer image showing the full body.",
  provider: "fallback",
  extraInfo: buildExtraInfo({
    type: "cattle",
    breed: "Unknown",
    warnings,
  }),
  accuracyReports: {
    model: {
      name: "CNN Inference",
      confidence: 0,
      calibratedConfidence: 0,
    },
    dataset: {
      name: "No Match",
      matchedBreed: "Unknown",
      similarity: 0,
      matchMode: "none",
    },
  },
});

const callCnnInference = async ({
  imageData,
  cvMetrics,
  cvWarnings,
  knownBreeds,
}: {
  imageData: string;
  cvMetrics: CvMetrics;
  cvWarnings: string[];
  knownBreeds: KnownBreeds;
}): Promise<ClassificationResponse | null> => {
  if (!CNN_INFERENCE_URL) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CNN_TIMEOUT_MS);

  try {
    const response = await fetch(CNN_INFERENCE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(CNN_INFERENCE_API_KEY ? { Authorization: `Bearer ${CNN_INFERENCE_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        imageData,
        cvMetrics,
        cvWarnings,
        knownBreeds,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("CNN inference HTTP error:", response.status, await response.text());
      return null;
    }

    const data = await response.json() as Record<string, unknown>;
    const type = normalizeType(data.type);
    const breed = typeof data.breed === "string" && data.breed.trim().length > 0 ? data.breed : "Unknown";
    const modelConfidence = normalizeConfidence(data.confidence);
    const traits = normalizeTraits(data.traits);
    const qualityScore = deriveQualityScore(cvMetrics);
    const traitReliabilityScore = deriveTraitReliabilityScore(traits);
    const modelInfo = typeof data.model_info === "object" && data.model_info !== null
      ? (data.model_info as Record<string, unknown>)
      : {};
    const margin = Number(modelInfo.margin ?? 0);
    const normalizedEntropy = Number(modelInfo.normalized_entropy ?? 1);
    const confidence = calibrateConfidence({
      modelConfidence,
      qualityScore,
      traitReliabilityScore,
      warningCount: cvWarnings.length,
      lowMargin: Number.isFinite(margin) && margin < 0.18,
      highEntropy: Number.isFinite(normalizedEntropy) && normalizedEntropy > 0.65,
    });
    const recommendations = typeof data.recommendations === "string" && data.recommendations.trim().length > 0
      ? data.recommendations
      : "Model prediction generated. Capture additional angles for improved reliability.";

    return { type, breed, confidence, modelConfidence, traits, recommendations, provider: "cnn" };
  } catch (error) {
    console.warn("CNN inference failed:", error);
    return null;
  } finally {
    clearTimeout(timeout);
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
    const body = await req.json() as ClassifyPayload;
    const imageData = typeof body.imageData === "string" ? body.imageData : "";
    if (!imageData.startsWith("data:image/")) {
      return new Response(JSON.stringify({ error: "Invalid imageData. Expected data URL." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cvMetrics = normalizeCvMetrics(body.cvMetrics);
    const cvWarnings = normalizeWarnings(body.cvWarnings);
    const inferenceMode = normalizeInferenceMode(body.inferenceMode);
    const { labels: datasetLabels, hasCustomLabels } = await loadDatasetLabels();
    const knownBreeds = buildKnownBreeds(datasetLabels);

    let result: ClassificationResponse | null = null;

    if (inferenceMode === "llm_only") {
      result = await callLlmFallback({ imageData, cvMetrics, cvWarnings, knownBreeds });
      if (result) {
        result = enforceDatasetMatch(result, datasetLabels, hasCustomLabels);
      }
    } else if (inferenceMode === "auto") {
      result = await callCnnInference({ imageData, cvMetrics, cvWarnings, knownBreeds });
      if (result) {
        result = enforceDatasetMatch(result, datasetLabels, hasCustomLabels);
      }

      const shouldUseLlmFallback =
        !result || result.breed === "Unknown" || result.confidence < CNN_MIN_CONFIDENCE;

      if (shouldUseLlmFallback) {
        const llmResult = await callLlmFallback({ imageData, cvMetrics, cvWarnings, knownBreeds });
        if (llmResult) {
          result = enforceDatasetMatch(llmResult, datasetLabels, hasCustomLabels);
          result = {
            ...result,
            recommendations: `${result.recommendations} LLM fallback was used because CNN confidence was low or unmatched.`,
          };
        }
      }
    }

    if (result && result.confidence < CNN_MIN_CONFIDENCE) {
      result = {
        ...result,
        recommendations:
          `${result.recommendations} Confidence is below threshold (${CNN_MIN_CONFIDENCE}%). Capture another image for better results.`,
      };
    }

    const responseData = result
      ? {
        ...result,
        extraInfo: await enrichExtraInfoWithLlm({
          imageData,
          type: result.type,
          breed: result.breed,
          knownBreeds,
          warnings: cvWarnings,
        }),
      }
      : fallbackClassification(cvWarnings);
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("classify-animal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
