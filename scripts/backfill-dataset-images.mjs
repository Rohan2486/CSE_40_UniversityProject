import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env');
const BUCKET = process.env.DATASET_IMAGE_BUCKET || 'classification-images';
const APPLY = process.argv.includes('--apply');
const DATASET_NAME_ARG_INDEX = process.argv.indexOf('--dataset');
const DATASET_NAME = DATASET_NAME_ARG_INDEX >= 0 ? process.argv[DATASET_NAME_ARG_INDEX + 1] : undefined;

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const entries = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex < 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const rawValue = trimmed.slice(eqIndex + 1).trim();
    entries[key] = rawValue.replace(/^"(.*)"$/, '$1');
  }
  return entries;
};

const envFromFile = parseEnvFile(ENV_PATH);
const SUPABASE_URL = process.env.SUPABASE_URL || envFromFile.SUPABASE_URL || envFromFile.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  envFromFile.SUPABASE_SERVICE_ROLE_KEY ||
  envFromFile.SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const uniq = (items) => [...new Set(items.filter(Boolean))];
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);

const buildFeatureVectorFromBytes = (bytes, bins = 32) => {
  const histogram = new Array(bins).fill(0);
  if (!bytes.length) return histogram;
  for (const byte of bytes) {
    const bucket = Math.min(bins - 1, Math.floor((byte / 256) * bins));
    histogram[bucket] += 1;
  }
  const magnitude = Math.sqrt(histogram.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) return histogram;
  return histogram.map((value) => Number((value / magnitude).toFixed(6)));
};

const listBucketPaths = async (prefix = '') => {
  const collected = [];
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw error;
  if (!data) return collected;

  for (const item of data) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) {
      collected.push(itemPath);
      continue;
    }
    const nested = await listBucketPaths(itemPath);
    collected.push(...nested);
  }

  return collected;
};

const isUsableImagePath = (objectPath) => {
  const fileName = objectPath.split('/').pop() || '';
  if (!fileName) return false;
  if (fileName.startsWith('._')) return false;
  const ext = path.extname(fileName).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
};

const listAllStorageObjects = async () => {
  return listBucketPaths('');
};

const listDatasetRecords = async () => {
  const all = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase
      .from('dataset_records')
      .select('id,dataset_id,data,feature_vector,datasets(name)')
      .range(offset, offset + pageSize - 1);

    if (DATASET_NAME) {
      query = query.eq('datasets.name', DATASET_NAME);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
};

const buildObjectIndex = (paths) => {
  const exact = new Map();
  const partial = [];

  for (const objectPath of paths.filter(isUsableImagePath)) {
    const normalizedPath = normalize(objectPath);
    exact.set(normalizedPath, objectPath);
    partial.push({ normalizedPath, objectPath });
  }

  return { exact, partial };
};

const buildRecordKeys = (record) => {
  const data = record?.data && typeof record.data === 'object' ? record.data : {};
  return uniq([
    normalize(data.sku),
    normalize(data.image_id),
    normalize(data.imageid),
    normalize(data.id),
    normalize(data.code),
    normalize(data.breed),
    normalize(data.name),
    normalize(data.label),
  ]);
};

const scoreObjectMatch = (keys, objectPath) => {
  const normalizedPath = normalize(objectPath);
  let score = 0;
  for (const key of keys) {
    if (!key) continue;
    if (normalizedPath.includes(key)) {
      score = Math.max(score, key.length >= 6 ? 100 + key.length : 50 + key.length);
    }
  }
  return score;
};

const chooseBestObjectPath = (record, objectIndex) => {
  const keys = buildRecordKeys(record);
  if (!keys.length) return null;

  let best = null;
  for (const candidate of objectIndex.partial) {
    const score = scoreObjectMatch(keys, candidate.objectPath);
    if (!best || score > best.score) {
      best = { path: candidate.objectPath, score };
    }
  }

  return best && best.score >= 54 ? best.path : null;
};

const fetchFeatureVectorForObject = async (objectPath) => {
  const { data, error } = await supabase.storage.from(BUCKET).download(objectPath);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  return buildFeatureVectorFromBytes(bytes);
};

const main = async () => {
  console.log(`Loading storage objects from bucket "${BUCKET}"...`);
  const objectPaths = await listAllStorageObjects();
  console.log(`Found ${objectPaths.length} storage objects.`);

  console.log('Loading dataset records...');
  const records = await listDatasetRecords();
  console.log(`Found ${records.length} dataset records${DATASET_NAME ? ` in dataset "${DATASET_NAME}"` : ''}.`);

  const objectIndex = buildObjectIndex(objectPaths);
  const planned = [];

  for (const record of records) {
    const data = record.data && typeof record.data === 'object' ? { ...record.data } : {};
    const existingImage = data.image_url || data.imageUrl || data.image_path || data.imagePath || data.image || data.url;
    const matchedPath = existingImage || chooseBestObjectPath(record, objectIndex);
    if (!matchedPath) continue;

    const nextData = {
      ...data,
      image_url: matchedPath,
    };

    planned.push({
      id: record.id,
      datasetName: record.datasets?.name || '',
      sku: data.sku || '',
      breed: data.breed || '',
      imageUrl: matchedPath,
      featureVectorMissing: !Array.isArray(record.feature_vector),
      nextData,
    });
  }

  console.log(`Prepared ${planned.length} record updates.`);
  console.table(planned.slice(0, 20).map((item) => ({
    id: item.id,
    dataset: item.datasetName,
    sku: item.sku,
    breed: item.breed,
    image_url: item.imageUrl,
    feature_vector_missing: item.featureVectorMissing,
  })));

  if (!APPLY) {
    console.log('Dry run only. Re-run with --apply to update Supabase.');
    return;
  }

  for (const item of planned) {
    const featureVector = item.featureVectorMissing ? await fetchFeatureVectorForObject(item.imageUrl) : undefined;
    const payload = featureVector
      ? { data: item.nextData, feature_vector: featureVector }
      : { data: item.nextData };

    const { error } = await supabase
      .from('dataset_records')
      .update(payload)
      .eq('id', item.id);

    if (error) {
      console.error(`Failed to update ${item.id}:`, error.message);
      continue;
    }
    console.log(`Updated ${item.id} -> ${item.imageUrl}`);
  }

  console.log('Backfill complete.');
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
