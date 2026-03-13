import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from './supabase';
import type { ClassificationResponse, HistoryItem } from '../types/classification';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const CLASSIFICATION_BUCKET = 'classification-images';

const base64ToUint8Array = (value: string) => {
  const buffer = Buffer.from(value, 'base64');
  return new Uint8Array(buffer);
};

export const fileUriToDataUrl = async (uri: string, mimeType = 'image/jpeg') => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });
  return `data:${mimeType};base64,${base64}`;
};

export const uploadImageToStorage = async ({
  uri,
  mimeType,
}: {
  uri: string;
  mimeType: string;
}) => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });
  const fileExt = mimeType.split('/')[1] || 'jpg';
  const fileName = `mobile-classification-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  const bytes = base64ToUint8Array(base64);

  const { data, error } = await supabase.storage
    .from(CLASSIFICATION_BUCKET)
    .upload(fileName, bytes, {
      contentType: mimeType,
      upsert: true,
    });

  if (error || !data) {
    throw error ?? new Error('Storage upload failed');
  }

  const { data: publicUrlData } = supabase.storage.from(CLASSIFICATION_BUCKET).getPublicUrl(data.path);
  return publicUrlData.publicUrl;
};

export const classifyAnimal = async ({
  imageData,
  inferenceMode = 'llm_only',
}: {
  imageData: string;
  inferenceMode?: 'auto' | 'llm_only';
}): Promise<ClassificationResponse> => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/classify-animal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({
      imageData,
      inferenceMode,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Classification failed');
  }

  return (await response.json()) as ClassificationResponse;
};

export const saveClassification = async ({
  imageUrl,
  result,
  userId,
}: {
  imageUrl: string | null;
  result: ClassificationResponse;
  userId: string | null;
}) => {
  const payload = {
    image_url: imageUrl,
    user_id: userId,
    type: result.type,
    breed: result.breed,
    confidence: result.confidence,
    traits: result.traits,
    recommendations: result.recommendations,
  };

  const response = await fetch(`${SUPABASE_URL}/functions/v1/save-classification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) return;

  const { error } = await supabase.from('classifications').insert(payload);
  if (error) throw error;
};

export const loadHistory = async (userId: string) => {
  const { data, error } = await supabase
    .from('classifications')
    .select('id,type,breed,confidence,created_at,image_url,traits,recommendations')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  return (data ?? []).map(
    (row): HistoryItem => ({
      id: row.id,
      type: (row.type ?? 'unidentified') as HistoryItem['type'],
      breed: row.breed ?? 'Unknown',
      confidence: Number(row.confidence ?? 0),
      timestamp: row.created_at ?? new Date().toISOString(),
      imageUrl: row.image_url ?? undefined,
      recommendations: row.recommendations ?? undefined,
      traits: Array.isArray(row.traits)
        ? row.traits.map((trait) => ({
            name: typeof (trait as { name?: unknown }).name === 'string' ? String((trait as { name: string }).name) : 'Trait',
            value: typeof (trait as { value?: unknown }).value === 'string' ? String((trait as { value: string }).value) : 'Unavailable',
            score: Number((trait as { score?: unknown }).score ?? 0) || 0,
          }))
        : [],
    }),
  );
};
