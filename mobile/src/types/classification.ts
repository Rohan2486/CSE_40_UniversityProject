export type AnimalType = 'cattle' | 'buffalo' | 'unidentified';

export type Trait = {
  name: string;
  value: string;
  score: number;
};

export type ClassificationResponse = {
  type: AnimalType;
  breed: string;
  confidence: number;
  modelConfidence?: number;
  traits: Trait[];
  recommendations?: string;
  provider?: 'cnn' | 'llm' | 'fallback';
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
      matchMode: 'exact' | 'fuzzy' | 'none';
    };
  };
};

export type HistoryItem = {
  id: string;
  type: AnimalType;
  breed: string;
  confidence: number;
  timestamp: string;
  imageUrl?: string;
  recommendations?: string;
  traits: Trait[];
};
