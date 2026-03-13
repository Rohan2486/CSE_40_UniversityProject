import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Image as ImageIcon, X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { ClassificationResult } from './ClassificationResult';
import { preprocessImageDataUrl, type CvQualityMetrics } from '@/lib/cvPreprocess';

interface ImageUploadProps {
  onClassify: (imageData: string, context?: ClassificationContext) => Promise<ClassificationResponse>;
}

export interface ClassificationContext {
  cvMetrics?: CvQualityMetrics;
  cvWarnings?: string[];
  inferenceMode?: 'auto' | 'llm_only';
}

export interface ClassificationResponse {
  type: 'cattle' | 'buffalo' | 'unidentified';
  breed: string;
  confidence: number;
  modelConfidence?: number;
  traits: {
    name: string;
    value: string;
    score: number;
  }[];
  recommendations?: string;
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
}

export const ImageUpload = ({ onClassify }: ImageUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [analysisImage, setAnalysisImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPreprocessing, setIsPreprocessing] = useState(false);
  const [result, setResult] = useState<ClassificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cvWarnings, setCvWarnings] = useState<string[]>([]);
  const [cvMetrics, setCvMetrics] = useState<CvQualityMetrics | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      processImage(file);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  }, []);

  const processImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      setImage(imageData);
      setIsPreprocessing(true);
      setError(null);
      try {
        const preprocessed = await preprocessImageDataUrl(imageData);
        setAnalysisImage(preprocessed.imageData);
        setCvWarnings(preprocessed.warnings);
        setCvMetrics(preprocessed.metrics);
      } catch (preprocessError) {
        console.warn('Preprocessing failed, using original image:', preprocessError);
        setAnalysisImage(imageData);
        setCvWarnings(['Could not run CV preprocessing. Using original image.']);
        setCvMetrics(null);
      } finally {
        setResult(null);
        setIsPreprocessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!analysisImage) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const response = await onClassify(analysisImage, {
        cvMetrics: cvMetrics ?? undefined,
        cvWarnings,
      });
      setResult(response);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to analyze image. Please try again.';
      setError(message);
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setImage(null);
    setAnalysisImage(null);
    setResult(null);
    setError(null);
    setCvWarnings([]);
    setCvMetrics(null);
  };

  return (
    <div className="space-y-6 animate-rise">
      <AnimatePresence mode="wait">
        {!image ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`upload-zone flex flex-col items-center justify-center min-h-[400px] cursor-pointer ${
              isDragging ? 'drag-active' : ''
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            
            <motion.div
              animate={{ y: isDragging ? -10 : 0 }}
              className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6"
            >
              <Upload className={`w-10 h-10 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
            </motion.div>
            
            <h3 className="text-xl font-display font-semibold text-foreground mb-2">
              {isDragging ? 'Drop your image here' : 'Upload Image'}
            </h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              Drag and drop a cattle or buffalo image, or click to browse
            </p>
            <p className="text-sm text-muted-foreground/70">
              Supports: JPG, PNG, WEBP
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            {/* Image Preview */}
            <div className="relative glass-card overflow-hidden">
              <img
                src={image}
                alt="Uploaded cattle/buffalo"
                className="w-full h-auto max-h-[500px] object-contain rounded-xl"
              />
              
              {/* Clear Button */}
              <Button
                variant="glass"
                size="icon"
                className="absolute top-4 right-4"
                onClick={handleClear}
              >
                <X className="w-5 h-5" />
              </Button>

              {/* Analyzing Overlay */}
              {(isAnalyzing || isPreprocessing) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center overflow-hidden"
                >
                  <div className="shimmer" />
                  <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                  <p className="text-foreground font-medium">
                    {isPreprocessing ? 'Preparing image...' : 'Analyzing image...'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isPreprocessing ? 'Running CV preprocessing and quality checks' : 'AI is identifying breed and traits'}
                  </p>
                </motion.div>
              )}
            </div>


            {/* Action Buttons */}
            {!result && !isAnalyzing && !isPreprocessing && (
              <div className="flex gap-4">
                <Button
                  variant="hero"
                  size="lg"
                  onClick={handleAnalyze}
                  className="flex-1 button-glow"
                >
                  <ImageIcon className="w-5 h-5 mr-2" />
                  Analyze Image
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleClear}
                  className="button-glow"
                >
                  Choose Different Image
                </Button>
              </div>
            )}

            {/* Error State */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 text-destructive"
              >
                <AlertCircle className="w-5 h-5" />
                <p>{error}</p>
              </motion.div>
            )}

            {/* Results */}
            {result && (
              <ClassificationResult result={result} inputImage={image} onNewAnalysis={handleClear} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


