export interface CvQualityMetrics {
  brightness: number;
  contrast: number;
  sharpness: number;
  width: number;
  height: number;
}

export interface CvPreprocessResult {
  imageData: string;
  warnings: string[];
  metrics: CvQualityMetrics;
}

interface CvPreprocessOptions {
  targetMaxSize?: number;
  jpegQuality?: number;
}

const loadImage = async (imageData: string): Promise<HTMLImageElement> =>
  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for preprocessing"));
    img.src = imageData;
  });

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const analyzeQuality = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): CvQualityMetrics => {
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 120000)));
  let count = 0;
  let sum = 0;
  let sumSq = 0;
  let edgeEnergy = 0;

  for (let y = 0; y < height - step; y += step) {
    for (let x = 0; x < width - step; x += step) {
      const i = (y * width + x) * 4;
      const ir = pixels[i];
      const ig = pixels[i + 1];
      const ib = pixels[i + 2];
      const luma = 0.299 * ir + 0.587 * ig + 0.114 * ib;
      sum += luma;
      sumSq += luma * luma;

      const j = (y * width + (x + step)) * 4;
      const kr = pixels[j];
      const kg = pixels[j + 1];
      const kb = pixels[j + 2];
      const lumaRight = 0.299 * kr + 0.587 * kg + 0.114 * kb;

      const k = ((y + step) * width + x) * 4;
      const lr = pixels[k];
      const lg = pixels[k + 1];
      const lb = pixels[k + 2];
      const lumaDown = 0.299 * lr + 0.587 * lg + 0.114 * lb;

      edgeEnergy += Math.abs(luma - lumaRight) + Math.abs(luma - lumaDown);
      count += 1;
    }
  }

  if (count === 0) {
    return { brightness: 0, contrast: 0, sharpness: 0, width, height };
  }

  const brightness = sum / count;
  const variance = Math.max(0, sumSq / count - brightness * brightness);
  const contrast = Math.sqrt(variance);
  const sharpness = edgeEnergy / count;

  return { brightness, contrast, sharpness, width, height };
};

const collectWarnings = (metrics: CvQualityMetrics): string[] => {
  const warnings: string[] = [];

  if (metrics.width < 640 || metrics.height < 640) {
    warnings.push("Low resolution image. Use a clearer, higher-resolution photo.");
  }
  if (metrics.brightness < 55) {
    warnings.push("Image is underexposed. Improve lighting for better accuracy.");
  }
  if (metrics.brightness > 210) {
    warnings.push("Image is overexposed. Reduce glare or bright light.");
  }
  if (metrics.contrast < 18) {
    warnings.push("Low contrast image. Increase subject-background separation.");
  }
  if (metrics.sharpness < 20) {
    warnings.push("Image appears blurry. Keep camera steady and refocus.");
  }

  return warnings;
};

export const preprocessImageDataUrl = async (
  imageData: string,
  options: CvPreprocessOptions = {},
): Promise<CvPreprocessResult> => {
  const targetMaxSize = options.targetMaxSize ?? 1280;
  const jpegQuality = options.jpegQuality ?? 0.88;

  const img = await loadImage(imageData);
  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = srcWidth;
  sourceCanvas.height = srcHeight;
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) {
    throw new Error("Could not create source canvas context");
  }
  sourceCtx.drawImage(img, 0, 0, srcWidth, srcHeight);
  const sourceImage = sourceCtx.getImageData(0, 0, srcWidth, srcHeight);
  const metrics = analyzeQuality(sourceImage.data, srcWidth, srcHeight);

  const minSide = Math.min(srcWidth, srcHeight);
  const cropSize = Math.max(1, Math.round(minSide * 0.95));
  const cropX = Math.round((srcWidth - cropSize) / 2);
  const cropY = Math.round((srcHeight - cropSize) / 2);

  const scale = Math.min(1, targetMaxSize / cropSize);
  const outputSize = clamp(Math.round(cropSize * scale), 320, targetMaxSize);

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outputSize;
  outputCanvas.height = outputSize;
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) {
    throw new Error("Could not create output canvas context");
  }

  outputCtx.imageSmoothingEnabled = true;
  outputCtx.imageSmoothingQuality = "high";
  outputCtx.drawImage(
    sourceCanvas,
    cropX,
    cropY,
    cropSize,
    cropSize,
    0,
    0,
    outputSize,
    outputSize,
  );

  const warnings = collectWarnings(metrics);
  const processed = outputCanvas.toDataURL("image/jpeg", jpegQuality);

  return {
    imageData: processed,
    warnings,
    metrics,
  };
};
