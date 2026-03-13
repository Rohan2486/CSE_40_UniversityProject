import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  CameraOff,
  Loader2,
  Pause,
  Play,
} from 'lucide-react';
import { Button } from './ui/button';
import { ClassificationResponse } from './ImageUpload';

interface LiveDetectionProps {
  onClassify: (imageData: string, context?: { inferenceMode?: 'auto' | 'llm_only' }) => Promise<ClassificationResponse>;
}

const smoothLiveResult = (
  history: ClassificationResponse[],
  next: ClassificationResponse,
): ClassificationResponse => {
  const windowed = [...history.slice(-4), next];
  const scoreByLabel = new Map<string, number>();

  for (let index = 0; index < windowed.length; index += 1) {
    const item = windowed[index];
    const key = `${item.type}|${item.breed}`;
    const recencyWeight = (index + 1) / windowed.length;
    const weight = item.confidence * (0.6 + recencyWeight * 0.4);
    scoreByLabel.set(key, (scoreByLabel.get(key) ?? 0) + weight);
  }

  let bestLabel = `${next.type}|${next.breed}`;
  let bestScore = -1;
  for (const [label, score] of scoreByLabel.entries()) {
    if (score > bestScore) {
      bestLabel = label;
      bestScore = score;
    }
  }

  const [smoothedType, smoothedBreed] = bestLabel.split("|") as [
    ClassificationResponse["type"],
    string,
  ];
  const matching = windowed.filter((item) => `${item.type}|${item.breed}` === bestLabel);
  const matchingAvg =
    matching.length > 0
      ? matching.reduce((sum, item) => sum + item.confidence, 0) / matching.length
      : next.confidence;
  const blendedConfidence = Math.round(next.confidence * 0.55 + matchingAvg * 0.45);

  return {
    ...next,
    type: smoothedType,
    breed: smoothedBreed,
    confidence: Math.max(0, Math.min(100, blendedConfidence)),
  };
};

export const LiveDetection = ({ onClassify }: LiveDetectionProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoCaptureTimerRef = useRef<number | null>(null);
  const lastFrameSignatureRef = useRef<string | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] =
    useState<ClassificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultHistory, setResultHistory] = useState<ClassificationResponse[]>([]);

  /* ===============================
     START CAMERA (CRITICAL FIX)
  =============================== */
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;

      // IMPORTANT: render <video> FIRST
      setIsStreaming(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to access camera'
      );
    }
  }, []);

  /* ===============================
     STOP CAMERA
  =============================== */
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

      setIsStreaming(false);
      setIsPaused(false);
      setCurrentResult(null);
      setResultHistory([]);
      lastFrameSignatureRef.current = null;
      if (autoCaptureTimerRef.current !== null) {
        window.clearInterval(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
  }, []);

  /* ===============================
     PAUSE / RESUME
  =============================== */
  const togglePause = () => {
    if (!videoRef.current) return;

    if (isPaused) {
      videoRef.current.play().catch(console.warn);
    } else {
      videoRef.current.pause();
    }

    setIsPaused(!isPaused);
  };

  /* ===============================
     CAPTURE & ANALYZE
  =============================== */
  const captureAndAnalyze = useCallback(async () => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      isAnalyzing
    )
      return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('Video not ready yet');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);
    const sampleSize = 32;
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = sampleSize;
    sampleCanvas.height = sampleSize;
    const sampleCtx = sampleCanvas.getContext('2d');
    if (!sampleCtx) return;
    sampleCtx.drawImage(video, 0, 0, sampleSize, sampleSize);
    const sampled = sampleCtx.getImageData(0, 0, sampleSize, sampleSize).data;
    let total = 0;
    const bins: number[] = [];
    for (let i = 0; i < sampled.length; i += 16) {
      const value = Math.round((sampled[i] + sampled[i + 1] + sampled[i + 2]) / 3 / 16);
      bins.push(value);
      total += value;
    }
    const frameSignature = `${Math.round(total / Math.max(1, bins.length))}:${bins.join('-')}`;
    if (lastFrameSignatureRef.current === frameSignature) {
      return;
    }
    lastFrameSignatureRef.current = frameSignature;
    const imageData = canvas.toDataURL('image/jpeg', 0.85);

    setIsAnalyzing(true);
    try {
      const result = await onClassify(imageData, { inferenceMode: 'llm_only' });
      setResultHistory((previous) => {
        const nextHistory = [...previous.slice(-4), result];
        setCurrentResult(smoothLiveResult(previous, result));
        return nextHistory;
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  }, [onClassify, isAnalyzing]);

  /* ===============================
     CLEANUP
  =============================== */
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (!isStreaming || !videoRef.current || !streamRef.current) return;

    // Attach stream once the <video> is in the DOM
    videoRef.current.srcObject = streamRef.current;

    // Play AFTER React renders the video
    const playTimeout = setTimeout(() => {
      videoRef.current
        ?.play()
        .catch((e) => console.warn('Autoplay blocked:', e));
    }, 50);

    return () => clearTimeout(playTimeout);
  }, [isStreaming]);

  useEffect(() => {
    if (!isStreaming || isPaused) {
      if (autoCaptureTimerRef.current !== null) {
        window.clearInterval(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
      return;
    }

    const runCapture = () => {
      void captureAndAnalyze();
    };

    runCapture();
    autoCaptureTimerRef.current = window.setInterval(runCapture, 3000);

    return () => {
      if (autoCaptureTimerRef.current !== null) {
        window.clearInterval(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
    };
  }, [isStreaming, isPaused, captureAndAnalyze]);

  return (
    <div className="space-y-6 animate-rise">
      {/* CAMERA VIEW */}
      <div className="glass-card overflow-hidden">
        <div className="relative bg-muted aspect-video">
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              className={`absolute inset-0 w-full h-full object-cover z-0 ${
                isStreaming ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* OVERLAY */}
            <div className="absolute inset-0 z-10 pointer-events-none">
              <div className="absolute inset-8 border-2 border-accent/50 rounded-3xl" />

              {isAnalyzing && (
                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-full bg-accent text-accent-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing
                </div>
              )}

              {isAnalyzing && (
                <div className="shimmer" />
              )}

              {currentResult && !isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-4 left-4"
                >
                  <div className="flex gap-3 px-4 py-3 rounded-2xl bg-card/90 backdrop-blur">
                    <div className="font-bold">
                      {currentResult.confidence}%
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {currentResult.type}
                      </p>
                      <p className="font-semibold">
                        {currentResult.breed}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {!isStreaming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Camera className="w-14 h-14 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Camera preview
                </p>
              </div>
            )}
          </>

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* CONTROLS */}
        <div className="p-4 flex justify-between border-t">
          <div className="flex gap-2">
            {!isStreaming ? (
              <Button onClick={startCamera} className="button-glow">
                <Camera className="w-4 h-4 mr-2" />
                Start Camera
              </Button>
            ) : (
              <>
                <Button
                  variant="destructive"
                  onClick={stopCamera}
                  className="button-glow"
                >
                  <CameraOff className="w-4 h-4 mr-2" />
                  Stop
                </Button>
                <Button
                  variant="outline"
                  onClick={togglePause}
                  className="button-glow"
                >
                  {isPaused ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <Pause className="w-4 h-4" />
                  )}
                </Button>
              </>
            )}
          </div>

          {isStreaming && (
            <div className="flex items-center text-sm text-muted-foreground">
              {isPaused ? 'Auto capture paused' : isAnalyzing ? 'Auto capturing...' : 'Auto capture active'}
            </div>
          )}
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="glass-card p-4 text-destructive">
          {error}
        </div>
      )}

      {/* RESULTS */}
      <AnimatePresence>
        {currentResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card p-6"
          >
            <h4 className="font-semibold mb-3">
              Live Classification
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-secondary p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Model Confidence Report</p>
                <p className="text-sm text-foreground">
                  Raw: {currentResult.accuracyReports?.model.confidence ?? currentResult.modelConfidence ?? currentResult.confidence}%
                </p>
                <p className="text-sm text-foreground">
                  Final: {currentResult.accuracyReports?.model.calibratedConfidence ?? currentResult.confidence}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Formula: Final = (Raw x 0.68 + Quality x 0.22 + TraitReliability x 0.10) - Penalties
                </p>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Dataset Similarity Report</p>
                <p className="text-sm text-foreground">
                  Dataset: {currentResult.accuracyReports?.dataset.name ?? 'No Match'}
                </p>
                <p className="text-sm text-foreground">
                  Similarity: {currentResult.accuracyReports?.dataset.similarity ?? (currentResult.breed !== 'Unknown' ? 100 : 0)}%
                </p>
                <p className="text-xs text-muted-foreground break-all">
                  Image URL: {currentResult.accuracyReports?.dataset.imageUrl ? (
                    <a
                      href={currentResult.accuracyReports.dataset.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      {currentResult.accuracyReports.dataset.imageUrl}
                    </a>
                  ) : (
                    <span className="text-foreground">Not available</span>
                  )}
                </p>
                {currentResult.accuracyReports?.dataset.imageUrl && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a
                      href={currentResult.accuracyReports.dataset.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Open Image
                    </a>
                    <a
                      href={currentResult.accuracyReports.dataset.imageUrl}
                      download={`${currentResult.accuracyReports.dataset.matchedBreed || 'matched-breed'}.jpg`}
                      className="inline-flex items-center rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Download Image
                    </a>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Formula: Match % = CosineSimilarity(input image vector, dataset image vector) x 100
                </p>
                {currentResult.accuracyReports?.dataset.imageUrl && (
                  <img
                    src={currentResult.accuracyReports.dataset.imageUrl}
                    alt={`${currentResult.accuracyReports.dataset.matchedBreed} dataset reference`}
                    className="mt-2 w-full h-24 object-cover rounded-lg border border-border/40"
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {currentResult.traits
                .slice(0, 4)
                .map((trait) => (
                  <div
                    key={trait.name}
                    className="text-center p-4 bg-secondary rounded-xl"
                  >
                    <p className="text-xl font-bold">
                      {trait.score}/10
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {trait.name}
                    </p>
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
