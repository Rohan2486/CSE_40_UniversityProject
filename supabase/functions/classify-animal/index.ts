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

const TRAIT_DEFAULT_VALUES: Record<string, string> = {
  "Body Length": "Balanced frame",
  "Height at Withers": "Average height",
  "Chest Girth": "Moderate width",
  "Rump Angle": "Moderate slope",
  "Udder Attachment": "Moderately attached",
  "Body Condition": "Moderate condition",
};

const TRAIT_NAME_ALIASES: Record<string, string> = {
  "body length": "Body Length",
  "length": "Body Length",
  "height at withers": "Height at Withers",
  "withers height": "Height at Withers",
  "height": "Height at Withers",
  "chest girth": "Chest Girth",
  "heart girth": "Chest Girth",
  "chest width": "Chest Girth",
  "rump angle": "Rump Angle",
  "rump slope": "Rump Angle",
  "croup angle": "Rump Angle",
  "udder attachment": "Udder Attachment",
  "udder support": "Udder Attachment",
  "udder": "Udder Attachment",
  "body condition": "Body Condition",
  "bcs": "Body Condition",
  "condition": "Body Condition",
};

type InferenceMode = "auto" | "llm_only";
type AnimalType = "cattle" | "buffalo" | "unidentified";

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
  featureVector?: number[];
};

let datasetLabelCache: { labels: DatasetLabel[]; hasCustomLabels: boolean; expiresAt: number } | null = null;
let datasetImageHashCache: { entries: DatasetImageHashEntry[]; expiresAt: number } | null = null;

type DatasetImageHashEntry = {
  label: DatasetLabel;
  hash: string;
};

const FEATURE_VECTOR_BINS = 32;

type ExtraInfo = NonNullable<ClassificationResponse["extraInfo"]>;

type BreedProfile = {
  primaryUse: string;
  globalDistribution: string;
  climateAdaptation: string;
  notableTraits: string[];
  careTips: string[];
};

const BREED_PROFILES: Record<string, BreedProfile> = {
  kangayam: {
    primaryUse: "Primarily draft work, with hardy field performance and moderate breeding value.",
    globalDistribution: "Mainly concentrated in Tamil Nadu, India, with smaller conservation herds in breeding farms and research centers.",
    climateAdaptation: "Well adapted to hot, dry tropical climates and long working hours under semi-arid conditions.",
    notableTraits: [
      "Compact, muscular body with strong limbs suited for draught use.",
      "Typically grey to white coat with darker shading around the neck and hump in males.",
      "Known for stamina, heat tolerance, and efficient movement over long distances.",
    ],
    careTips: [
      "Maintain mineral-rich feed to support bone strength and working stamina.",
      "Avoid overconditioning; this breed performs best with lean, functional muscle.",
      "Provide shade and clean water after work, especially in peak summer heat.",
    ],
  },
  sahiwal: {
    primaryUse: "Primarily dairy, with strong value in tropical milk production systems.",
    globalDistribution: "Originated in the Punjab region and now found across India, Pakistan, and many tropical dairy programs worldwide.",
    climateAdaptation: "Highly adapted to hot climates and performs better than many exotic dairy breeds under heat stress.",
    notableTraits: [
      "Good dairy frame with loose skin and reddish-brown coat shades.",
      "Known for heat tolerance, tick resistance, and stable milk production.",
      "Usually calmer temperament compared with many dual-purpose indigenous breeds.",
    ],
    careTips: [
      "Support milk yield with balanced energy, protein, and mineral intake.",
      "Keep udder hygiene strong during lactation-heavy periods.",
      "Monitor body condition so high milk output does not reduce reproductive performance.",
    ],
  },
  gir: {
    primaryUse: "Primarily dairy, with strong value in indigenous milk and breeding programs.",
    globalDistribution: "Native to Gujarat, India, and widely used in Indian breeding systems as well as tropical dairy programs abroad.",
    climateAdaptation: "Performs well in hot climates with good tolerance to thermal stress and variable feed conditions.",
    notableTraits: [
      "Distinctive convex forehead, long pendulous ears, and well-developed dairy form.",
      "Valued for persistent lactation and adaptability in tropical systems.",
      "Often recognized by red, mottled, or speckled coat patterns.",
    ],
    careTips: [
      "Maintain clean housing and udder care to protect dairy productivity.",
      "Support lactation with consistent forage quality and mineral supplementation.",
      "Use regular parasite control, especially in humid or mixed-grazing environments.",
    ],
  },
  murrah: {
    primaryUse: "Primarily high-fat milk production with strong breeding value in buffalo dairy systems.",
    globalDistribution: "Widely distributed across India and used internationally in buffalo improvement programs.",
    climateAdaptation: "Performs well in warm climates but benefits from cooling and water access during heat stress.",
    notableTraits: [
      "Jet-black body, tightly curled horns, and strong dairy buffalo conformation.",
      "Well known for high milk yield and high butterfat percentage.",
      "Strong body capacity and broad frame are common selection markers.",
    ],
    careTips: [
      "Provide cooling, shade, and frequent water access during hot weather.",
      "Use balanced concentrate feeding during peak milk production.",
      "Watch hoof and skin hygiene closely in damp housing conditions.",
    ],
  },
  redchittagong: {
    primaryUse: "Primarily milk and smallholder dual-purpose utility in local production systems.",
    globalDistribution: "Mostly found in Bangladesh, especially around Chattogram breeding regions and conservation herds.",
    climateAdaptation: "Adapted to humid subtropical climates and smallholder management systems.",
    notableTraits: [
      "Compact red-coated body with good adaptation to local feed conditions.",
      "Known for disease resistance and suitability in low-input systems.",
      "Maintains useful milk production under village-scale management.",
    ],
    careTips: [
      "Use parasite and vaccination programs consistently in humid environments.",
      "Support reproduction and milk yield with mineral supplementation.",
      "Preserve breed purity through controlled mating where conservation is important.",
    ],
  },
};

const getBreedProfile = (type: AnimalType, breed: string): BreedProfile => {
  const normalizedBreed = normalizeText(breed).replace(/\s+/g, "");
  const directProfile = BREED_PROFILES[normalizedBreed];
  if (directProfile) return directProfile;

  if (type === "unidentified") {
    return {
      primaryUse: "Not applicable because the image does not appear to be cattle or buffalo.",
      globalDistribution: "Not applicable for this image.",
      climateAdaptation: "Not applicable for this image.",
      notableTraits: [
        "The visible animal does not match cattle or buffalo morphology strongly enough.",
        "A different species or a non-livestock image may have been provided.",
        "Use a clear side-view image of cattle or buffalo for breed analysis.",
      ],
      careTips: [
        "Upload a clear image containing only the target animal.",
        "Prefer side-view or full-body livestock images in good lighting.",
        "Avoid cluttered backgrounds and low-resolution uploads.",
      ],
    };
  }

  if (type === "buffalo") {
    return {
      primaryUse: "Primarily milk production, with additional draft or breeding value depending on the regional line.",
      globalDistribution: "Mostly distributed across South Asia, with smaller populations in parts of Southeast Asia, the Middle East, and South America.",
      climateAdaptation: "Generally suited to warm climates when shade, cooling, and water access are available.",
      notableTraits: [
        `${breed} is assessed through body depth, horn pattern, head profile, and dairy conformation.`,
        "Buffalo breeds often show strong body capacity and high milk-fat potential.",
        "Accurate confirmation improves when side-view and head-view images are both available.",
      ],
      careTips: [
        "Provide shade, clean water, and cooling support during warm periods.",
        "Use balanced minerals and energy intake for milk and breeding performance.",
        "Monitor hoof hygiene and parasites closely in wet or muddy housing.",
      ],
    };
  }

  return {
    primaryUse: "Milk, draft, or dual-purpose utility depending on the regional breeding line.",
    globalDistribution: "Primarily distributed through South Asian breeding systems, with conservation or improvement herds in other regions.",
    climateAdaptation: "Generally adapted to tropical or subtropical climates, with performance shaped by local management and feed quality.",
    notableTraits: [
      `${breed} is best differentiated using body conformation, head profile, horn pattern, and coat markers.`,
      "Indigenous cattle breeds often balance adaptation, disease tolerance, and functional productivity.",
      "Breed confirmation improves with clear full-body and side-angle images.",
    ],
    careTips: [
      "Maintain balanced forage, protein, and mineral intake across seasons.",
      "Track body condition and parasite load regularly under field conditions.",
      "Use clean housing, vaccination, and deworming schedules to protect productivity.",
    ],
  };
};

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
  const breedProfile = getBreedProfile(type, breed);
  const summary = isUnknown
    ? `This appears to be a ${type}. Breed-level confidence is limited for this image.`
    : `${breed} identified as ${type}. This profile is tailored to that breed's common field characteristics.`;

  const careTips = warnings.length > 0
    ? [...breedProfile.careTips, "For better AI assessment, upload sharp full-body images with stable lighting."]
    : breedProfile.careTips;

  return {
    summary,
    primaryUse: breedProfile.primaryUse,
    globalDistribution: breedProfile.globalDistribution,
    climateAdaptation: breedProfile.climateAdaptation,
    notableTraits: breedProfile.notableTraits,
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

const normalizeType = (value: unknown): AnimalType => {
  const normalized = normalizeText(typeof value === "string" ? value : "");
  if (!normalized) return "unidentified";
  if (
    normalized === "buffalo" ||
    normalized === "water buffalo" ||
    normalized.includes("buffalo")
  ) {
    return "buffalo";
  }
  if (
    normalized === "cattle" ||
    normalized === "cow" ||
    normalized === "bovine" ||
    normalized === "bull" ||
    normalized === "heifer" ||
    normalized === "ox" ||
    normalized.includes("cattle")
  ) {
    return "cattle";
  }
  return "unidentified";
};

const normalizeConfidence = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, Math.round(parsed)));
};

const inferTypeFromBreed = (breed: string, knownBreeds: KnownBreeds): AnimalType => {
  const normalizedBreed = normalizeText(breed);
  if (!normalizedBreed) return "unidentified";
  if (knownBreeds.cattle.some((item) => normalizeText(item) === normalizedBreed)) return "cattle";
  if (knownBreeds.buffalo.some((item) => normalizeText(item) === normalizedBreed)) return "buffalo";
  return "unidentified";
};

const normalizeText = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const parseDataUrl = (dataUrl: string): { mimeType: string; base64: string } | null => {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
};

const bytesToHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

const sha256Hex = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
};

const decodeBase64 = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const normalizeFeatureVector = (value: unknown): number[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const values = value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
  return values.length > 0 ? values : undefined;
};

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

const buildFeatureVectorFromDataUrl = (dataUrl: string) => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  return buildFeatureVectorFromBytes(decodeBase64(parsed.base64));
};

const cosineSimilarity = (a: number[], b: number[]) => {
  const length = Math.min(a.length, b.length);
  if (!length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (!normA || !normB) return 0;
  return Math.max(0, Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
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
  const featureVector = normalizeFeatureVector(
    record.feature_vector ?? record.featureVector ?? record.features,
  );
  if (!normalizedBreed) return null;
  return {
    breed,
    normalizedBreed,
    type,
    datasetName: "Default",
    imageUrl: toPublicStorageUrl(imageRef),
    featureVector,
  };
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
    const key = `${label.type}|${label.normalizedBreed}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, label);
      continue;
    }

    const existingScore =
      (existing.imageUrl ? 2 : 0) +
      (existing.featureVector && existing.featureVector.length > 0 ? 2 : 0) +
      (existing.datasetName !== "Breeds Table" ? 1 : 0);
    const nextScore =
      (label.imageUrl ? 2 : 0) +
      (label.featureVector && label.featureVector.length > 0 ? 2 : 0) +
      (label.datasetName !== "Breeds Table" ? 1 : 0);

    if (nextScore >= existingScore) {
      byKey.set(key, {
        ...existing,
        ...label,
        imageUrl: label.imageUrl ?? existing.imageUrl,
        featureVector: label.featureVector ?? existing.featureVector,
      });
    }
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
      .select("data,feature_vector,datasets(name)")
      .range(offset, offset + pageSize - 1);
    if (recordsError || !Array.isArray(records) || records.length === 0) break;

    hasCustomLabels = true;
    for (const row of records as Array<{ data?: unknown; feature_vector?: unknown; datasets?: unknown }>) {
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
        featureVector: normalizeFeatureVector(row.feature_vector) ?? parsed.featureVector,
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

const buildDatasetExactMatchResult = ({
  label,
  cvWarnings,
}: {
  label: DatasetLabel;
  cvWarnings: string[];
}): ClassificationResponse => ({
  type: label.type,
  breed: label.breed,
  confidence: 100,
  modelConfidence: 100,
  traits: BODY_TRAITS.map((name) => ({ name, value: TRAIT_DEFAULT_VALUES[name] ?? "Moderate", score: 10 })),
  recommendations: cvWarnings.length > 0
    ? "Exact dataset image match found. Image quality warnings were ignored because the uploaded photo matches a synced dataset image."
    : "Exact dataset image match found in the synced Supabase bucket.",
  provider: "fallback",
  extraInfo: buildExtraInfo({
    type: label.type,
    breed: label.breed,
    warnings: cvWarnings,
  }),
  accuracyReports: {
    model: {
      name: "Exact Dataset Image Match",
      confidence: 100,
      calibratedConfidence: 100,
    },
    dataset: {
      name: label.datasetName,
      matchedBreed: label.breed,
      similarity: 100,
      imageUrl: label.imageUrl,
      matchMode: "exact",
    },
  },
});

const buildDatasetImageHashCache = async (labels: DatasetLabel[]): Promise<DatasetImageHashEntry[]> => {
  const labelsWithImages = labels.filter((label) => typeof label.imageUrl === "string" && label.imageUrl.trim().length > 0);
  const entries = await Promise.all(labelsWithImages.map(async (label) => {
    try {
      const response = await fetch(label.imageUrl as string);
      if (!response.ok) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length) return null;
      return { label, hash: await sha256Hex(bytes) };
    } catch (_error) {
      return null;
    }
  }));
  return entries.filter((entry): entry is DatasetImageHashEntry => entry !== null);
};

const findExactDatasetImageMatch = async (
  imageData: string,
  labels: DatasetLabel[],
): Promise<DatasetLabel | null> => {
  const parsed = parseDataUrl(imageData);
  if (!parsed) return null;

  const now = Date.now();
  if (!datasetImageHashCache || datasetImageHashCache.expiresAt <= now) {
    const entries = await buildDatasetImageHashCache(labels);
    datasetImageHashCache = {
      entries,
      expiresAt: now + DATASET_CACHE_TTL_MS,
    };
  }

  if (!datasetImageHashCache.entries.length) return null;
  const imageHash = await sha256Hex(decodeBase64(parsed.base64));
  const exact = datasetImageHashCache.entries.find((entry) => entry.hash === imageHash);
  return exact?.label ?? null;
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
    ?? null;
  if (exact) {
    return { label: exact, score: 1, mode: "exact" as const };
  }

  let best: { label: DatasetLabel; score: number } | null = null;
  const pool = labels.filter((label) => label.type === type);
  const searchPool = pool;

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

const matchLabelByFeatureVector = (inputVector: number[], type: AnimalType, labels: DatasetLabel[]) => {
  const pool = labels.filter((label) => label.type === type && Array.isArray(label.featureVector) && label.featureVector.length > 0);
  const searchPool = pool;

  let best: { label: DatasetLabel; score: number } | null = null;
  for (const label of searchPool) {
    const score = cosineSimilarity(inputVector, label.featureVector as number[]);
    if (!best || score > best.score) {
      best = { label, score };
    }
  }

  if (best && best.score >= 0.55) {
    return {
      label: best.label,
      score: best.score,
      mode: best.score >= 0.98 ? "exact" as const : "fuzzy" as const,
    };
  }

  return null;
};

const resolveDatasetImageUrl = (label: DatasetLabel, labels: DatasetLabel[]) => {
  if (label.imageUrl) return label.imageUrl;
  const fallback = labels.find((candidate) =>
    candidate.type === label.type &&
    candidate.normalizedBreed === label.normalizedBreed &&
    typeof candidate.imageUrl === "string" &&
    candidate.imageUrl.trim().length > 0
  );
  return fallback?.imageUrl;
};

const buildDatasetReport = (
  result: ClassificationResponse,
  labels: DatasetLabel[],
  strictDatasetMatching: boolean,
  inputVector?: number[] | null,
) => {
  if (!strictDatasetMatching) {
    const similarity = result.breed !== "Unknown" ? 100 : 0;
    return {
      name: "Global (No Synced Dataset)",
      matchedBreed: result.breed,
      similarity,
      matchMode: similarity > 0 ? "exact" as const : "none" as const,
      imageUrl: undefined,
    };
  }

  if (!labels.length || result.breed === "Unknown") {
    return {
      name: "No Dataset",
      matchedBreed: "Unknown",
      similarity: 0,
      matchMode: "none" as const,
      imageUrl: undefined,
    };
  }

  const matched = inputVector
    ? matchLabelByFeatureVector(inputVector, result.type, labels) ?? matchLabel(result.breed, result.type, labels)
    : matchLabel(result.breed, result.type, labels);
  if (!matched) {
    return {
      name: "No Match",
      matchedBreed: "Unknown",
      similarity: 0,
      matchMode: "none" as const,
      imageUrl: undefined,
    };
  }

  return {
    name: matched.label.datasetName,
    matchedBreed: matched.label.breed,
    similarity: Math.round(matched.score * 100),
    imageUrl: resolveDatasetImageUrl(matched.label, labels),
    matchMode: matched.mode,
  };
};

const enforceDatasetMatch = (
  result: ClassificationResponse,
  labels: DatasetLabel[],
  strictDatasetMatching: boolean,
  inputVector?: number[] | null,
): ClassificationResponse => {
  const modelName = modelNameForProvider(result.provider);
  const dataset = buildDatasetReport(result, labels, strictDatasetMatching, inputVector);
  return {
    ...result,
    accuracyReports: {
      model: {
        name: modelName,
        confidence: result.modelConfidence ?? result.confidence,
        calibratedConfidence: result.confidence,
      },
      dataset,
    },
  };
};

const mergeDatasetReport = (
  primaryResult: ClassificationResponse,
  datasetSourceResult: ClassificationResponse | null,
  labels: DatasetLabel[],
  strictDatasetMatching: boolean,
  inputVector?: number[] | null,
): ClassificationResponse => {
  const datasetAppliedToPrimary = enforceDatasetMatch(primaryResult, labels, strictDatasetMatching, inputVector);
  if (!datasetSourceResult) return datasetAppliedToPrimary;

  const datasetAppliedToSource = enforceDatasetMatch(datasetSourceResult, labels, strictDatasetMatching, inputVector);
  return {
    ...datasetAppliedToPrimary,
    accuracyReports: {
      model: datasetAppliedToPrimary.accuracyReports?.model ?? {
        name: modelNameForProvider(datasetAppliedToPrimary.provider),
        confidence: datasetAppliedToPrimary.modelConfidence ?? datasetAppliedToPrimary.confidence,
        calibratedConfidence: datasetAppliedToPrimary.confidence,
      },
      dataset: datasetAppliedToSource.accuracyReports?.dataset ?? datasetAppliedToPrimary.accuracyReports?.dataset ?? {
        name: "No Match",
        matchedBreed: "Unknown",
        similarity: 0,
        matchMode: "none",
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

const buildUnidentifiedTraits = (): Trait[] =>
  BODY_TRAITS.map((name) => ({ name, value: "Not applicable", score: 0 }));

const isIndeterminateBreed = (breed: string) => {
  const normalized = normalizeText(breed);
  return !normalized || normalized === "unknown" || normalized === "unidentified";
};

const toUnidentifiedResponse = (
  provider: ClassificationResponse["provider"],
  recommendations: string,
): ClassificationResponse => ({
  type: "unidentified",
  breed: "Unidentified",
  confidence: 0,
  modelConfidence: 0,
  traits: buildUnidentifiedTraits(),
  recommendations,
  provider,
  accuracyReports: {
    model: {
      name: modelNameForProvider(provider),
      confidence: 0,
      calibratedConfidence: 0,
    },
    dataset: {
      name: "Not Applicable",
      matchedBreed: "Not Applicable",
      similarity: 0,
      matchMode: "none",
    },
  },
});

const isUnavailableLike = (value: string) => {
  const normalized = normalizeText(value);
  return normalized === "unavailable" ||
    normalized === "unable to assess" ||
    normalized === "unknown" ||
    normalized === "not visible" ||
    normalized === "not clear" ||
    normalized === "n a";
};

const canonicalTraitName = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = normalizeText(value);
  return TRAIT_NAME_ALIASES[normalized] ?? null;
};

const defaultTraitValue = (name: string) => TRAIT_DEFAULT_VALUES[name] ?? "Moderate";

const normalizeTraitValue = (name: string, rawValue: unknown) => {
  if (typeof rawValue !== "string") return defaultTraitValue(name);
  const trimmed = rawValue.trim();
  if (!trimmed || isUnavailableLike(trimmed)) return defaultTraitValue(name);
  return trimmed;
};

const normalizeTraits = (value: unknown): Trait[] => {
  const incoming = Array.isArray(value) ? value : [];
  const lookup = new Map<string, Trait>();

  for (const item of incoming) {
    if (!item || typeof item !== "object") continue;
    const canonicalName = canonicalTraitName((item as { name?: unknown }).name);
    if (!canonicalName) continue;
    const value = normalizeTraitValue(canonicalName, (item as { value?: unknown }).value);
    const rawScore = Number((item as { score?: unknown }).score);
    lookup.set(canonicalName, {
      name: canonicalName,
      value,
      score: Number.isFinite(rawScore) ? Math.min(10, Math.max(1, Math.round(rawScore))) : 6,
    });
  }

  return BODY_TRAITS.map((name) => lookup.get(name) ?? { name, value: defaultTraitValue(name), score: 6 });
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
  const availableRatio = traits.filter((t) => t.value.trim().length > 0 && !isUnavailableLike(t.value)).length / traits.length;
  const meanScore = traits.reduce((sum, t) => sum + t.score, 0) / traits.length;
  const normalizedMean = Math.min(1, Math.max(0, meanScore / 10));
  return Math.round((availableRatio * 0.7 + normalizedMean * 0.3) * 100);
};

const calibrateConfidence = ({
  modelConfidence,
}: {
  modelConfidence: number;
}) => {
  return Math.min(100, Math.max(0, Math.round(modelConfidence)));
};

const buildLlmPrompt = (knownBreeds: KnownBreeds, cvWarnings: string[]) => {
  const warningsText = cvWarnings.length ? cvWarnings.join(" | ") : "none";
  return `Classify the animal image. Return ONLY JSON:
{"type":"cattle|buffalo|unidentified","breed":"string","confidence":0,"recommendations":"string","traits":[{"name":"Body Length","value":"string","score":0},{"name":"Height at Withers","value":"string","score":0},{"name":"Chest Girth","value":"string","score":0},{"name":"Rump Angle","value":"string","score":0},{"name":"Udder Attachment","value":"string","score":0},{"name":"Body Condition","value":"string","score":0}]}
Rules:
- type must be cattle, buffalo, or unidentified
- if not cattle/buffalo: type="unidentified", breed="Unidentified", confidence=0, recommendations="This is not a cattle or buffalo animal.", traits use the same 6 names with score 0
- choose breed only from cattle: ${knownBreeds.cattle.join(", ")}
- choose breed only from buffalo: ${knownBreeds.buffalo.join(", ")}
- if uncertain, choose closest breed and lower confidence
- confidence must be integer 0-100
- traits must be exactly these 6 names and this order
- every trait value must be concrete; never use Unavailable, Unknown, or N/A
- if partly hidden, estimate morphology and lower score
- trait scores are integers 1-10 except unidentified can use 0
- warnings: ${warningsText}
- factor warnings into confidence and trait scores
- no markdown, no comments, no extra keys`;
};

const normalizeLlmResult = (
  raw: Record<string, unknown>,
  knownBreeds: KnownBreeds,
  cvMetrics: CvMetrics,
  cvWarnings: string[],
): ClassificationResponse => {
  const breed = typeof raw.breed === "string" && raw.breed.trim() ? raw.breed.trim() : "Unknown";
  const explicitType = normalizeType(raw.type);
  const inferredType = isIndeterminateBreed(breed) ? "unidentified" : inferTypeFromBreed(breed, knownBreeds);
  const type = explicitType !== "unidentified" ? explicitType : inferredType;
  if (type === "unidentified") {
    return toUnidentifiedResponse("llm", "This is not a cattle or buffalo animal.");
  }
  const modelConfidence = normalizeConfidence(raw.confidence);
  const traits = normalizeTraits(raw.traits);
  const confidence = calibrateConfidence({
    modelConfidence,
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
  knownBreeds,
  cvMetrics,
  cvWarnings,
}: {
  imageData: string;
  prompt: string;
  knownBreeds: KnownBreeds;
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
            content: "Expert livestock classifier. Return only valid JSON.",
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
    return normalizeLlmResult(parsed, knownBreeds, cvMetrics, cvWarnings);
  } catch (error) {
    console.warn("OpenAI fallback exception:", error);
    return null;
  }
};

const callGeminiVision = async ({
  imageData,
  prompt,
  knownBreeds,
  cvMetrics,
  cvWarnings,
}: {
  imageData: string;
  prompt: string;
  knownBreeds: KnownBreeds;
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
    return normalizeLlmResult(parsed, knownBreeds, cvMetrics, cvWarnings);
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
  const openAi = await callOpenAiVision({ imageData, prompt, knownBreeds, cvMetrics, cvWarnings });
  if (openAi && openAi.type !== "unidentified") return openAi;

  const gemini = await callGeminiVision({ imageData, prompt, knownBreeds, cvMetrics, cvWarnings });
  if (gemini) return gemini;

  return openAi;
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
  return `You are an expert livestock profile AI.

## TASK
Generate a short practical profile for the predicted animal. Return ONLY strict JSON.

## OUTPUT SCHEMA
{
  "summary": string,
  "primaryUse": string,
  "globalDistribution": string,
  "climateAdaptation": string,
  "notableTraits": string[],
  "careTips": string[]
}

## CONTEXT
- type: ${type}
- breed: ${breed}
- cattle breeds: ${knownBreeds.cattle.join(", ")}
- buffalo breeds: ${knownBreeds.buffalo.join(", ")}
- image warnings: ${warningsText}

## RULES
- Keep output factual, farm-oriented, and concise
- notableTraits and careTips must each contain 3 to 6 short strings
- Return only JSON with exactly these keys`;
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
            content: "Livestock profile generator. Return only valid JSON.",
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
  ...toUnidentifiedResponse(
    "fallback",
    warnings.length > 0
      ? `Unable to classify from this image. ${warnings.slice(0, 2).join(" ")}`
      : "Unable to classify from this image. Use a clearer image showing the full body.",
  ),
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
    const confidence = calibrateConfidence({
      modelConfidence,
    });
    const recommendations = typeof data.recommendations === "string" && data.recommendations.trim().length > 0
      ? data.recommendations
      : "Model prediction generated. Capture additional angles for improved reliability.";

    if (confidence === 0 && isIndeterminateBreed(breed)) {
      return toUnidentifiedResponse("cnn", recommendations);
    }

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
    const inputFeatureVector = buildFeatureVectorFromDataUrl(imageData);

    const exactDatasetImageMatch = await findExactDatasetImageMatch(imageData, datasetLabels);

    let result: ClassificationResponse | null = null;

    if (inferenceMode === "llm_only") {
      const [llmResult, cnnResult] = await Promise.all([
        callLlmFallback({ imageData, cvMetrics, cvWarnings, knownBreeds }),
        callCnnInference({ imageData, cvMetrics, cvWarnings, knownBreeds }),
      ]);
      result = llmResult;
      if (result) {
        result = mergeDatasetReport(
          result,
          cnnResult,
          datasetLabels,
          hasCustomLabels,
          inputFeatureVector,
        );
      } else {
        result = fallbackClassification(cvWarnings);
      }
    } else if (inferenceMode === "auto") {
      const [cnnResult, llmResult] = await Promise.all([
        callCnnInference({ imageData, cvMetrics, cvWarnings, knownBreeds }),
        callLlmFallback({ imageData, cvMetrics, cvWarnings, knownBreeds }),
      ]);

      const primaryResult = llmResult ?? cnnResult;
      if (primaryResult) {
        result = mergeDatasetReport(
          primaryResult,
          cnnResult,
          datasetLabels,
          hasCustomLabels,
          inputFeatureVector,
        );
        if (llmResult && cnnResult) {
          result = {
            ...result,
            recommendations: `${result.recommendations} LLM analysis was used for the final result while CNN ran in parallel for comparison.`,
          };
        } else if (llmResult) {
          result = {
            ...result,
            recommendations: `${result.recommendations} Final result was generated from LLM image analysis.`,
          };
        }
      } else {
        result = exactDatasetImageMatch
          ? buildDatasetExactMatchResult({ label: exactDatasetImageMatch, cvWarnings })
          : fallbackClassification(cvWarnings);
      }
    }

    if (result && result.confidence < CNN_MIN_CONFIDENCE) {
      result = {
        ...result,
        recommendations:
          `${result.recommendations} Confidence is below threshold (${CNN_MIN_CONFIDENCE}%). Capture another image for better results.`,
      };
    }

    if (result?.type === "unidentified") {
      result = toUnidentifiedResponse(
        result.provider,
        result.recommendations || "This is not a cattle or buffalo animal.",
      );
    }

    const responseData = result
      ? {
        ...result,
        extraInfo: result.type === "unidentified"
          ? undefined
          : await enrichExtraInfoWithLlm({
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
