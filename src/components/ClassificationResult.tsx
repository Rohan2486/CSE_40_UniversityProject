import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Beef, Info, ArrowRight, Download, Share2, BarChart3, Database, ClipboardList } from 'lucide-react';
import { Button } from './ui/button';
import { ClassificationResponse } from './ImageUpload';
import { toast } from 'sonner';

interface ClassificationResultProps {
  result: ClassificationResponse;
  inputImage?: string | null;
  onNewAnalysis: () => void;
}

export const ClassificationResult = ({ result, inputImage, onNewAnalysis }: ClassificationResultProps) => {
  type ExtraInfo = NonNullable<ClassificationResponse['extraInfo']>;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const modelReport = result.accuracyReports?.model ?? {
    name: 'CNN Inference',
    confidence: result.modelConfidence ?? result.confidence,
    calibratedConfidence: result.confidence,
  };
  const isUnidentified = result.type === 'unidentified';
  const datasetReport = result.accuracyReports?.dataset ?? {
    name: 'No Match',
    matchedBreed: result.breed ?? 'Unknown',
    similarity: result.breed && result.breed !== 'Unknown' ? 100 : 0,
    imageUrl: undefined,
    matchMode: result.breed && result.breed !== 'Unknown' ? 'exact' as const : 'none' as const,
  };

  const getTypeIcon = () => {
    return <Beef className="w-8 h-8" />;
  };

  const activeExtraInfo = result.extraInfo ?? null;
  const englishVoices = availableVoices.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
  const selectedVoice = englishVoices[0] ?? null;
  const hasEnglishVoice = englishVoices.length > 0;
  const roundedModelConfidence = Math.round(modelReport.confidence);
  const confidenceFormula = roundedModelConfidence === result.confidence
    ? `Formula: Confidence = round(${modelReport.confidence}%) = ${result.confidence}%`
    : `Formula: round(${modelReport.confidence}%) = ${roundedModelConfidence}%, then dataset matching adjusts it to ${result.confidence}%`;

  const buildSpeechText = (info: ExtraInfo) => {
    return [
      info.summary,
      `Primary use: ${info.primaryUse}`,
      `Mainly found in: ${info.globalDistribution}`,
      `Climate adaptation: ${info.climateAdaptation}`,
      `Notable traits: ${info.notableTraits.join('. ')}`,
      `Care tips: ${info.careTips.join('. ')}`,
    ].join('. ');
  };

  useEffect(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, [result]);

  useEffect(() => {
    const syncVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };

    syncVoices();
    window.speechSynthesis.onvoiceschanged = syncVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const handleSpeak = async () => {
    if (!selectedVoice || !hasEnglishVoice) {
      toast.error('No English TTS voice found in your OS/browser. Install one and refresh the page.');
      return;
    }

    if (!activeExtraInfo) return;
    const speechText = buildSpeechText(activeExtraInfo);
    if (!speechText) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'en-IN';
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.voice = selectedVoice;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handlePauseResume = () => {
    if (!isSpeaking) return;
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-success';
    if (confidence >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-success';
    if (score >= 6) return 'bg-warning';
    if (score >= 4) return 'bg-accent';
    return 'bg-muted-foreground';
  };

  const confidenceCircumference = 2 * Math.PI * 42;
  const confidenceOffset = confidenceCircumference * (1 - result.confidence / 100);

  const downloadBlob = (content: string, fileName: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const escapeCsv = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value);
    const escaped = text.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const toCsv = (rows: Array<Record<string, unknown>>) => {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const lines = [headers.map(escapeCsv).join(',')];
    for (const row of rows) {
      lines.push(headers.map((key) => escapeCsv(row[key])).join(','));
    }
    return lines.join('\n');
  };

  const handleExport = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportWindow = window.open('', '_blank', 'width=960,height=1200');
    if (!reportWindow) {
      toast.error('Allow pop-ups to export the PDF report.');
      return;
    }

    const traitRows = result.traits
      .map((trait) => `
        <tr>
          <td>${trait.name}</td>
          <td>${trait.value}</td>
          <td>${trait.score}/10</td>
        </tr>
      `)
      .join('');

    const recommendations = result.recommendations
      ? `<section class="card"><h2>Recommendations</h2><p>${result.recommendations}</p></section>`
      : '';

    const inputImageSection = inputImage
      ? `
        <section class="card">
          <h2>Input Image</h2>
          <img src="${inputImage}" alt="Input animal" />
        </section>
      `
      : '';

    const matchedImageSection = datasetReport.imageUrl
      ? `
        <section class="card">
          <h2>Matched Dataset Image</h2>
          <p><strong>Matched breed:</strong> ${datasetReport.matchedBreed}</p>
          <img src="${datasetReport.imageUrl}" alt="${datasetReport.matchedBreed} dataset image" />
          <p><strong>Source:</strong> <a href="${datasetReport.imageUrl}">${datasetReport.imageUrl}</a></p>
        </section>
      `
      : `
        <section class="card">
          <h2>Matched Dataset Image</h2>
          <p>No matched dataset image was available.</p>
        </section>
      `;

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>classification-report-${stamp}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
      h1 { margin: 0 0 8px; font-size: 28px; }
      h2 { margin: 0 0 12px; font-size: 18px; }
      p { margin: 4px 0; line-height: 1.5; }
      .meta { color: #4b5563; margin-bottom: 20px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
      .card { border: 1px solid #d1d5db; border-radius: 12px; padding: 16px; margin-bottom: 16px; break-inside: avoid; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 14px; }
      th { background: #f3f4f6; }
      img { width: 100%; max-height: 320px; object-fit: contain; border-radius: 10px; border: 1px solid #e5e7eb; background: #f9fafb; }
      .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #eef2ff; color: #3730a3; font-size: 12px; font-weight: 600; }
      @media print {
        body { margin: 12mm; }
        .print-note { display: none; }
      }
    </style>
  </head>
  <body>
    <p class="print-note">Use "Save as PDF" in the print dialog.</p>
    <h1>BreedVision AI Report</h1>
    <p class="meta">Exported at ${new Date().toLocaleString()}</p>

    <div class="grid">
      <section class="card">
        <h2>Classification Summary</h2>
        <p><strong>Type:</strong> ${result.type}</p>
        <p><strong>Breed:</strong> ${result.breed}</p>
        <p><strong>Confidence:</strong> ${result.confidence}%</p>
        <p><strong>Model:</strong> ${modelReport.name}</p>
      </section>
      <section class="card">
        <h2>Dataset Match</h2>
        <p><strong>Dataset:</strong> ${datasetReport.name}</p>
        <p><strong>Matched breed:</strong> ${datasetReport.matchedBreed}</p>
        <p><strong>Similarity:</strong> ${datasetReport.similarity}%</p>
        <p><strong>Match mode:</strong> <span class="badge">${datasetReport.matchMode}</span></p>
      </section>
    </div>

    ${inputImageSection}
    ${matchedImageSection}

    <section class="card">
      <h2>Trait Assessment</h2>
      <table>
        <thead>
          <tr>
            <th>Trait</th>
            <th>Value</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>${traitRows}</tbody>
      </table>
    </section>

    ${recommendations}
  </body>
</html>`;

    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.onload = () => {
      reportWindow.print();
    };
    toast.success('PDF report opened.');
  };

  const handleShare = async () => {
    const shareText = `Breed: ${result.breed}\nType: ${result.type}\nConfidence: ${result.confidence}%`;
    if (navigator.share) {
      await navigator.share({
        title: 'BreedVision AI Result',
        text: shareText,
      });
      return;
    }
    await navigator.clipboard.writeText(shareText);
    toast.success('Result copied to clipboard.');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 animate-rise"
    >
      <div className="flex items-center gap-3 text-success">
        <CheckCircle2 className="w-6 h-6" />
        <span className="font-semibold">Analysis Complete</span>
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl hero-gradient flex items-center justify-center text-primary-foreground">
                {getTypeIcon()}
              </div>
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Identified As</p>
                <h3 className="text-2xl font-display font-bold text-foreground capitalize">
                  {result.type}
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Breed</p>
                <p className="text-lg font-semibold text-foreground">{result.breed}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Confidence</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 confidence-bar">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${result.confidence}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="confidence-fill"
                    />
                  </div>
                  <span className={`font-bold ${getConfidenceColor(result.confidence)}`}>
                    {result.confidence}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden md:block w-px bg-border" />

          <div className="flex-1">
            <h4 className="text-sm text-muted-foreground uppercase tracking-wider mb-4">
              Body Traits Assessment
            </h4>
            <div className="space-y-3">
              {result.traits.map((trait, index) => (
                <motion.div
                  key={trait.name}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{trait.name}</p>
                    <p className="text-xs text-muted-foreground">{trait.value}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${trait.score * 10}%` }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className={`h-full rounded-full ${getScoreColor(trait.score)}`}
                      />
                    </div>
                    <span className="text-sm font-semibold text-foreground w-8 text-right">
                      {trait.score}/10
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${isUnidentified ? '' : 'lg:grid-cols-2'} gap-4`}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h4 className="font-semibold text-foreground">Confidence</h4>
          </div>
          <p className="text-sm text-muted-foreground">Model: {modelReport.name}</p>
          <p className="text-sm text-muted-foreground mb-2">
            Confidence: <span className="font-medium text-foreground">{result.confidence}%</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {confidenceFormula}
          </p>
          <div className="mt-4 flex items-center justify-center">
            <div className="relative h-28 w-28">
              <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-muted"
                  strokeWidth="8"
                  fill="none"
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-primary"
                  strokeWidth="8"
                  strokeLinecap="round"
                  fill="none"
                  initial={{ strokeDashoffset: confidenceCircumference }}
                  animate={{ strokeDashoffset: confidenceOffset }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  strokeDasharray={confidenceCircumference}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold ${getConfidenceColor(result.confidence)}`}>
                  {result.confidence}%
                </span>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Confidence
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {!isUnidentified && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-card p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-5 h-5 text-primary" />
              <h4 className="font-semibold text-foreground">Dataset Similarity Report</h4>
            </div>
            <p className="text-sm text-muted-foreground">Dataset: <span className="font-medium text-foreground">{datasetReport.name}</span></p>
            <p className="text-sm text-muted-foreground">Matched breed: <span className="font-medium text-foreground">{datasetReport.matchedBreed}</span></p>
            <p className="text-sm text-muted-foreground mb-2">Similarity: <span className="font-medium text-foreground">{datasetReport.similarity}%</span> ({datasetReport.matchMode})</p>
            <p className="text-sm text-muted-foreground break-all">
              Image URL: {datasetReport.imageUrl ? (
                <a
                  href={datasetReport.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  {datasetReport.imageUrl}
                </a>
              ) : (
                <span className="text-foreground">Not available</span>
              )}
            </p>
            {datasetReport.imageUrl && (
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={datasetReport.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Open Image
                </a>
                <a
                  href={datasetReport.imageUrl}
                  download={`${datasetReport.matchedBreed || 'matched-breed'}.jpg`}
                  className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Download Image
                </a>
              </div>
            )}
            <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
              Formula: Match % = CosineSimilarity(input image vector, dataset image vector) x 100
            </div>
            {datasetReport.imageUrl && (
              <div className="mt-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Dataset Image</p>
                <img
                  src={datasetReport.imageUrl}
                  alt={`${datasetReport.matchedBreed} dataset reference`}
                  className="w-full h-40 object-cover rounded-xl border border-border/50"
                />
              </div>
            )}
          </motion.div>
        )}
      </div>

      {result.recommendations && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent flex-shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">AI Recommendations</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {result.recommendations}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {!isUnidentified && activeExtraInfo && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card p-6"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="w-full space-y-3">
              <h4 className="font-semibold text-foreground">Animal Profile</h4>
              <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Kiosk Voice Assistant</p>
                <div className="flex flex-col md:flex-row gap-2 md:items-center">
                  <select
                    value={selectedVoice?.voiceURI ?? ''}
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm md:min-w-[240px]"
                    disabled
                  >
                    {hasEnglishVoice ? (
                      <option value={selectedVoice?.voiceURI ?? ''}>
                        {selectedVoice?.name} ({selectedVoice?.lang})
                      </option>
                    ) : (
                      <option value="">No installed English voice</option>
                    )}
                  </select>
                  <Button type="button" variant="outline" size="sm" onClick={handleSpeak}>
                    Speak
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handlePauseResume} disabled={!isSpeaking}>
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleStop} disabled={!isSpeaking}>
                    Stop
                  </Button>
                </div>
                {!hasEnglishVoice && (
                  <p className="text-xs text-destructive mt-2">
                    Install an English voice in your OS language settings, then refresh this page.
                  </p>
                )}
              </div>

              <p className="text-sm text-muted-foreground">{activeExtraInfo.summary}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Primary Use</p>
                  <p className="text-foreground">{activeExtraInfo.primaryUse}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Global Distribution</p>
                  <p className="text-foreground">{activeExtraInfo.globalDistribution}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Climate Adaptation</p>
                  <p className="text-foreground">{activeExtraInfo.climateAdaptation}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Notable Traits</p>
                  <ul className="space-y-1 text-foreground">
                    {activeExtraInfo.notableTraits.map((trait) => (
                      <li key={trait}>- {trait}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Care Tips</p>
                  <ul className="space-y-1 text-foreground">
                    {activeExtraInfo.careTips.map((tip) => (
                      <li key={tip}>- {tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex flex-wrap gap-4">
        <Button variant="hero" size="lg" onClick={onNewAnalysis} className="button-glow">
          Analyze Another
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
        <Button variant="outline" size="lg" onClick={handleExport} className="button-glow">
          <Download className="w-5 h-5 mr-2" />
          Export Report
        </Button>
        <Button variant="ghost" size="lg" onClick={handleShare} className="button-glow">
          <Share2 className="w-5 h-5 mr-2" />
          Share
        </Button>
      </div>
    </motion.div>
  );
};
