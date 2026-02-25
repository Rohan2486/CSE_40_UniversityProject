import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Beef, Info, ArrowRight, Download, Share2, BarChart3, Database, ClipboardList } from 'lucide-react';
import { Button } from './ui/button';
import { ClassificationResponse } from './ImageUpload';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ClassificationResultProps {
  result: ClassificationResponse;
  onNewAnalysis: () => void;
}

export const ClassificationResult = ({ result, onNewAnalysis }: ClassificationResultProps) => {
  type ExtraInfo = NonNullable<ClassificationResponse['extraInfo']>;
  type VoiceLanguage = 'english' | 'hindi' | 'tamil';
  type VoiceLocale = 'en-IN' | 'hi-IN' | 'ta-IN';

  const languageOptions: Array<{ value: VoiceLanguage; label: string; locale: VoiceLocale }> = [
    { value: 'english', label: 'English', locale: 'en-IN' },
    { value: 'hindi', label: 'Hindi', locale: 'hi-IN' },
    { value: 'tamil', label: 'Tamil', locale: 'ta-IN' },
  ];

  const [selectedLanguage, setSelectedLanguage] = useState<VoiceLanguage>('english');
  const [translatedInfo, setTranslatedInfo] = useState<Partial<Record<VoiceLanguage, ExtraInfo>>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');

  const modelReport = result.accuracyReports?.model ?? {
    name: 'CNN Inference',
    confidence: result.modelConfidence ?? result.confidence,
    calibratedConfidence: result.confidence,
  };
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

  const baseExtraInfo = result.extraInfo ?? null;
  const activeExtraInfo = (baseExtraInfo && translatedInfo[selectedLanguage]) || baseExtraInfo;
  const selectedLocale = languageOptions.find((option) => option.value === selectedLanguage)?.locale ?? 'en-IN';

  const getVoicesForLanguage = (language: VoiceLanguage) => {
    const localePrefixByLanguage: Record<VoiceLanguage, string[]> = {
      english: ['en'],
      hindi: ['hi'],
      tamil: ['ta'],
    };
    const prefixes = localePrefixByLanguage[language];
    return availableVoices.filter((voice) => {
      const lower = voice.lang.toLowerCase();
      return prefixes.some((prefix) => lower.startsWith(prefix));
    });
  };

  const languageVoices = getVoicesForLanguage(selectedLanguage);
  const hasVoiceForSelectedLanguage = languageVoices.length > 0;

  const speechLabels: Record<VoiceLanguage, {
    primaryUse: string;
    mainlyFoundIn: string;
    climateAdaptation: string;
    notableTraits: string;
    careTips: string;
  }> = {
    english: {
      primaryUse: 'Primary use',
      mainlyFoundIn: 'Mainly found in',
      climateAdaptation: 'Climate adaptation',
      notableTraits: 'Notable traits',
      careTips: 'Care tips',
    },
    hindi: {
      primaryUse: 'मुख्य उपयोग',
      mainlyFoundIn: 'मुख्य रूप से पाया जाता है',
      climateAdaptation: 'जलवायु अनुकूलन',
      notableTraits: 'मुख्य विशेषताएं',
      careTips: 'देखभाल सुझाव',
    },
    tamil: {
      primaryUse: 'முக்கிய பயன்பாடு',
      mainlyFoundIn: 'முக்கியமாக காணப்படும் பகுதிகள்',
      climateAdaptation: 'காலநிலை ஏற்ப்பு',
      notableTraits: 'குறிப்பிடத்தக்க பண்புகள்',
      careTips: 'பராமரிப்பு குறிப்புகள்',
    },
  };

  const buildSpeechText = (info: ExtraInfo, language: VoiceLanguage) => {
    const labels = speechLabels[language];
    return [
      info.summary,
      `${labels.primaryUse}: ${info.primaryUse}`,
      `${labels.mainlyFoundIn}: ${info.globalDistribution}`,
      `${labels.climateAdaptation}: ${info.climateAdaptation}`,
      `${labels.notableTraits}: ${info.notableTraits.join('. ')}`,
      `${labels.careTips}: ${info.careTips.join('. ')}`,
    ].join('. ');
  };

  const fetchTranslation = async (language: VoiceLanguage): Promise<ExtraInfo | null> => {
    if (!baseExtraInfo) return null;
    if (language === 'english') return baseExtraInfo;
    if (translatedInfo[language]) return translatedInfo[language] ?? null;

    setIsTranslating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-extra-info`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': publishableKey,
            'Authorization': `Bearer ${accessToken ?? publishableKey}`,
          },
          body: JSON.stringify({
            extraInfo: baseExtraInfo,
            language,
          }),
        },
      );
      if (!response.ok) {
        const errPayload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(errPayload?.error || `Translation request failed (${response.status})`);
      }
      const data = await response.json() as { extraInfo?: ExtraInfo; provider?: string };
      if (data?.extraInfo) {
        const translated = data.extraInfo as ExtraInfo;
        setTranslatedInfo((prev) => ({ ...prev, [language]: translated }));
        if (data.provider !== 'llm') {
          toast.warning('Translation provider did not return an LLM result.');
        }
        return translated;
      }
      return null;
    } catch (error) {
      console.warn('Translation failed:', error);
      toast.error('Could not translate extra info for selected language.');
      return null;
    } finally {
      setIsTranslating(false);
    }
  };

  useEffect(() => {
    setSelectedLanguage('english');
    setTranslatedInfo({});
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setSelectedVoiceURI('');
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

  useEffect(() => {
    const voices = getVoicesForLanguage(selectedLanguage);
    setSelectedVoiceURI((prev) => {
      if (prev && voices.some((voice) => voice.voiceURI === prev)) {
        return prev;
      }
      return voices[0]?.voiceURI ?? '';
    });
  }, [selectedLanguage, availableVoices]);

  useEffect(() => {
    if (!baseExtraInfo) return;
    if (selectedLanguage === 'english') return;
    if (translatedInfo[selectedLanguage]) return;

    fetchTranslation(selectedLanguage);
  }, [baseExtraInfo, selectedLanguage, translatedInfo]);

  const handleSpeak = async () => {
    const selectedVoice = availableVoices.find((voice) => voice.voiceURI === selectedVoiceURI);
    if (!selectedVoice || !hasVoiceForSelectedLanguage) {
      toast.error(`No ${selectedLanguage} TTS voice found in your OS/browser. Install that language voice first.`);
      return;
    }

    const infoForSpeech = await fetchTranslation(selectedLanguage);
    if (!infoForSpeech) return;
    const speechText = buildSpeechText(infoForSpeech, selectedLanguage);
    if (!speechText) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = selectedLocale;
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
      toast.error('Speech playback failed on this device/browser.');
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
    const payload = {
      type: result.type,
      breed: result.breed,
      confidence: result.confidence,
      model_confidence: modelReport.confidence,
      calibrated_confidence: modelReport.calibratedConfidence,
      dataset_name: datasetReport.name,
      dataset_similarity: datasetReport.similarity,
      dataset_matched_breed: datasetReport.matchedBreed,
      dataset_image_url: datasetReport.imageUrl ?? null,
      traits: result.traits,
      recommendations: result.recommendations ?? null,
      exported_at: new Date().toISOString(),
    };
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonFile = `classification-${result.type}-${stamp}.json`;
    const csvFile = `classification-${result.type}-${stamp}.csv`;
    const csvRow = {
      type: result.type,
      breed: result.breed,
      confidence: result.confidence,
      model_confidence: modelReport.confidence,
      calibrated_confidence: modelReport.calibratedConfidence,
      dataset_name: datasetReport.name,
      dataset_similarity: datasetReport.similarity,
      dataset_matched_breed: datasetReport.matchedBreed,
      dataset_image_url: datasetReport.imageUrl ?? '',
      traits: JSON.stringify(result.traits ?? []),
      recommendations: result.recommendations ?? '',
      exported_at: payload.exported_at,
    };
    downloadBlob(JSON.stringify(payload, null, 2), jsonFile, 'application/json');
    downloadBlob(toCsv([csvRow]), csvFile, 'text/csv');
    toast.success('Report exported.');
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
      {/* Success Header */}
      <div className="flex items-center gap-3 text-success">
        <CheckCircle2 className="w-6 h-6" />
        <span className="font-semibold">Analysis Complete</span>
      </div>

      {/* Main Result Card */}
      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Type & Breed */}
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

          {/* Divider */}
          <div className="hidden md:block w-px bg-border" />

          {/* Traits */}
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

      {/* Accuracy Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h4 className="font-semibold text-foreground">Model Confidence Report</h4>
          </div>
          <p className="text-sm text-muted-foreground">Model: {modelReport.name}</p>
          <p className="text-sm text-muted-foreground">Raw confidence: <span className="font-medium text-foreground">{modelReport.confidence}%</span></p>
          <p className="text-sm text-muted-foreground mb-2">Final confidence: <span className="font-medium text-foreground">{modelReport.calibratedConfidence}%</span></p>
          <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
            Formula (real-time): Final = (Raw x 0.68 + Quality x 0.22 + TraitReliability x 0.10) - Penalties
          </div>
        </motion.div>

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
          <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
            Formula (real-time): Similarity = (1 - LevenshteinDistance(predictedBreed, datasetBreed) / maxLength) x 100
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
      </div>

      {/* Recommendations */}
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

      {/* Extra Animal Info */}
      {result.extraInfo && activeExtraInfo && (
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
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value as VoiceLanguage)}
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    {languageOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <select
                    value={selectedVoiceURI}
                    onChange={(e) => setSelectedVoiceURI(e.target.value)}
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm md:min-w-[240px]"
                    disabled={!hasVoiceForSelectedLanguage}
                  >
                    {hasVoiceForSelectedLanguage ? (
                      languageVoices.map((voice) => (
                        <option key={voice.voiceURI} value={voice.voiceURI}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))
                    ) : (
                      <option value="">No installed voice for this language</option>
                    )}
                  </select>
                  <Button type="button" variant="outline" size="sm" onClick={handleSpeak} disabled={isTranslating}>
                    {isTranslating ? 'Translating...' : 'Speak'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handlePauseResume} disabled={!isSpeaking}>
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleStop} disabled={!isSpeaking}>
                    Stop
                  </Button>
                </div>
                {!hasVoiceForSelectedLanguage && (
                  <p className="text-xs text-destructive mt-2">
                    Install a {selectedLanguage} voice in your OS language settings, then refresh this page.
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

      {/* Action Buttons */}
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
