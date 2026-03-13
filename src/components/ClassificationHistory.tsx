import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Beef, ChevronRight, Search, Filter, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { supabase } from '@/integrations/supabase/client';

interface HistoryItem {
  id: string;
  type: 'cattle' | 'buffalo' | 'unidentified';
  breed: string;
  confidence: number;
  timestamp: Date;
  imageUrl?: string;
  traits: {
    name: string;
    value: string;
    score: number;
  }[];
  recommendations?: string;
}

interface ClassificationHistoryProps {
  userId: string | null;
}

export const ClassificationHistory = ({ userId }: ClassificationHistoryProps) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'cattle' | 'buffalo'>('all');
  const [datasetName, setDatasetName] = useState('');
  const [datasetSource, setDatasetSource] = useState('');
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchHistory = async () => {
      if (!userId) {
        setHistory([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from('classifications')
        .select('id,type,breed,confidence,created_at,image_url,traits,recommendations')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (!error && data) {
        const mapped = data.map((row) => ({
          id: row.id,
          type: (row.type ?? 'cattle') as 'cattle' | 'buffalo',
          breed: row.breed ?? 'Unknown',
          confidence: Number(row.confidence ?? 0),
          timestamp: row.created_at ? new Date(row.created_at) : new Date(),
          imageUrl: row.image_url ?? undefined,
          traits: Array.isArray(row.traits)
            ? row.traits.map((trait) => ({
                name: typeof (trait as { name?: unknown }).name === 'string'
                  ? (trait as { name: string }).name
                  : 'Trait',
                value: typeof (trait as { value?: unknown }).value === 'string'
                  ? (trait as { value: string }).value
                  : 'Unavailable',
                score: Number.isFinite(Number((trait as { score?: unknown }).score))
                  ? Math.min(10, Math.max(1, Math.round(Number((trait as { score?: unknown }).score))))
                  : 0,
              }))
            : [],
          recommendations:
            typeof row.recommendations === 'string' ? row.recommendations : undefined,
        }));
        setHistory(mapped);
      } else if (error) {
        setLoadError(error.message);
      }
      setIsLoading(false);
    };

  useEffect(() => {
    fetchHistory();
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel('realtime:classifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'classifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as {
            id: string;
            type: string | null;
            breed: string | null;
            confidence: number | null;
            created_at: string | null;
            image_url: string | null;
            traits: unknown;
            recommendations: string | null;
          };

          const mapped: HistoryItem = {
            id: row.id,
            type: (row.type ?? 'cattle') as 'cattle' | 'buffalo',
            breed: row.breed ?? 'Unknown',
            confidence: Number(row.confidence ?? 0),
            timestamp: row.created_at ? new Date(row.created_at) : new Date(),
            imageUrl: row.image_url ?? undefined,
            traits: Array.isArray(row.traits)
              ? row.traits.map((trait) => ({
                  name: typeof (trait as { name?: unknown }).name === 'string'
                    ? (trait as { name: string }).name
                    : 'Trait',
                  value: typeof (trait as { value?: unknown }).value === 'string'
                    ? (trait as { value: string }).value
                    : 'Unavailable',
                  score: Number.isFinite(Number((trait as { score?: unknown }).score))
                    ? Math.min(10, Math.max(1, Math.round(Number((trait as { score?: unknown }).score))))
                    : 0,
                }))
              : [],
            recommendations:
              typeof row.recommendations === 'string' ? row.recommendations : undefined,
          };

          setHistory((prev) => {
            if (prev.some((item) => item.id === mapped.id)) {
              return prev;
            }
            return [mapped, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleDatasetUpload = async () => {
    if (!datasetName || !datasetFile) {
      setUploadStatus('error');
      setUploadMessage('Dataset name and file are required.');
      return;
    }

    setUploadStatus('uploading');
    setUploadMessage(null);

    try {
      const fileText = await datasetFile.text();
      const isCsv = datasetFile.name.toLowerCase().endsWith('.csv');

      let payload: Record<string, unknown>;
      if (isCsv) {
        payload = {
          dataset_name: datasetName,
          source: datasetSource || undefined,
          format: 'csv',
          csv: fileText,
        };
      } else {
        const parsed = JSON.parse(fileText);
        const records = Array.isArray(parsed) ? parsed : parsed.records;
        if (!Array.isArray(records)) {
          throw new Error('JSON must be an array or include a records[] field.');
        }
        payload = {
          dataset_name: datasetName,
          source: datasetSource || undefined,
          records,
        };
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-dataset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Upload failed');
      }

      setUploadStatus('success');
      setUploadMessage('Dataset uploaded successfully.');
      setDatasetFile(null);
    } catch (error) {
      setUploadStatus('error');
      setUploadMessage(error instanceof Error ? error.message : 'Upload failed.');
    }
  };

  const filteredHistory = history.filter(item => {
    const matchesSearch = item.breed.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesType;
  });

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const formatAbsoluteTimestamp = (date: Date) => {
    return date.toLocaleString();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return 'text-success bg-success/10';
    if (confidence >= 70) return 'text-warning bg-warning/10';
    return 'text-destructive bg-destructive/10';
  };

  const getAverageTraitScore = (traits: HistoryItem['traits']) => {
    if (!traits.length) return 0;
    const total = traits.reduce((sum, trait) => sum + trait.score, 0);
    return Math.round((total / traits.length) * 10) / 10;
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

  const handleExportReport = () => {
    const rows = filteredHistory.length ? filteredHistory : history;
    if (!rows.length) return;

    const payload = rows.map((item) => ({
      id: item.id,
      type: item.type,
      breed: item.breed,
      confidence: item.confidence,
      average_trait_score: getAverageTraitScore(item.traits),
      traits: item.traits,
      recommendations: item.recommendations ?? null,
      image_url: item.imageUrl ?? null,
      created_at: item.timestamp.toISOString(),
    }));

    const fileStamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonFile = `classification-report-${fileStamp}.json`;
    const csvFile = `classification-report-${fileStamp}.csv`;
    const csvRows = payload.map((item) => ({
      id: item.id,
      type: item.type,
      breed: item.breed,
      confidence: item.confidence,
      average_trait_score: item.average_trait_score,
      traits: JSON.stringify(item.traits ?? []),
      recommendations: item.recommendations ?? '',
      image_url: item.image_url ?? '',
      created_at: item.created_at,
    }));
    downloadBlob(JSON.stringify(payload, null, 2), jsonFile, 'application/json');
    downloadBlob(toCsv(csvRows), csvFile, 'text/csv');
  };

  return (
      <div className="space-y-6 animate-rise">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">
            Classification History
          </h2>
          <p className="text-muted-foreground">
            View and manage your past classifications
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHistory}
            disabled={isLoading}
            className="button-glow"
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setFilterType('all');
            }}
            className="button-glow"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Reset Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportReport}
            className="button-glow"
          >
            Export
          </Button>
        </div>
      </div>

      {/* Dataset Upload */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Dataset name"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
          />
          <Input
            placeholder="Source (optional)"
            value={datasetSource}
            onChange={(e) => setDatasetSource(e.target.value)}
          />
          <Input
            type="file"
            accept=".json,.csv"
            onChange={(e) => setDatasetFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <Button
            variant="outline"
            onClick={handleDatasetUpload}
            disabled={uploadStatus === 'uploading'}
          >
            {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload Dataset'}
          </Button>
          {uploadMessage && (
            <span
              className={`text-sm ${
                uploadStatus === 'success'
                  ? 'text-success'
                  : uploadStatus === 'error'
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              }`}
            >
              {uploadMessage}
            </span>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search by breed name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <FilterButton
              active={filterType === 'all'}
              onClick={() => setFilterType('all')}
            >
              All
            </FilterButton>
            <FilterButton
              active={filterType === 'cattle'}
              onClick={() => setFilterType('cattle')}
            >
              Cattle
            </FilterButton>
            <FilterButton
              active={filterType === 'buffalo'}
              onClick={() => setFilterType('buffalo')}
            >
              Buffalo
            </FilterButton>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="space-y-3 stagger-grid">
        {loadError && (
          <div className="glass-card p-4 text-sm text-destructive">
            Failed to load history: {loadError}
          </div>
        )}
        {isLoading ? (
          <div className="glass-card p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Loading history
            </h3>
            <p className="text-muted-foreground">
              Fetching your latest classifications
            </p>
          </div>
        ) : filteredHistory.length > 0 ? (
          filteredHistory.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card p-4 hover:shadow-lg transition-all duration-300 cursor-pointer group"
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
            >
              <div className="flex items-center gap-4">
                {/* Icon / Preview */}
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={`${item.breed} preview`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full hero-gradient flex items-center justify-center text-primary-foreground">
                      <Beef className="w-7 h-7" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground truncate">
                      {item.breed}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground capitalize">
                      {item.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatTimestamp(item.timestamp)}
                    </span>
                    <span className="text-xs text-muted-foreground/80">
                      {formatAbsoluteTimestamp(item.timestamp)}
                    </span>
                    <span className="flex items-center gap-1">
                      Avg Trait: {getAverageTraitScore(item.traits) || 0}/10
                    </span>
                  </div>
                </div>

                {/* Confidence */}
                <div className={`px-3 py-1.5 rounded-xl font-semibold text-sm ${getConfidenceColor(item.confidence)}`}>
                  {item.confidence}%
                </div>

                {/* Arrow */}
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
              </div>

              {expandedId === item.id && (
                <div className="mt-4 border-t border-border/50 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="md:col-span-2 space-y-3">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Trait Calculations
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {item.traits.length ? (
                        item.traits.map((trait) => (
                          <div key={`${item.id}-${trait.name}`} className="rounded-xl bg-muted/40 p-3">
                            <p className="font-medium text-foreground">{trait.name}</p>
                            <p className="text-muted-foreground">{trait.value}</p>
                            <p className="text-foreground mt-1">Score: {trait.score}/10</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground">No trait calculations available.</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Recommendations
                    </p>
                    <p className="text-muted-foreground">
                      {item.recommendations ?? 'No recommendations available.'}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          ))
        ) : (
          <div className="glass-card p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No results found
            </h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Classifications"
          value={history.length.toString()}
        />
        <StatCard
          label="Cattle"
          value={history.filter(h => h.type === 'cattle').length.toString()}
        />
        <StatCard
          label="Buffalo"
          value={history.filter(h => h.type === 'buffalo').length.toString()}
        />
        <StatCard
          label="Avg. Confidence"
          value={
            history.length
              ? `${Math.round(history.reduce((acc, h) => acc + h.confidence, 0) / history.length)}%`
              : '-'
          }
        />
      </div>
    </div>
  );
};

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const FilterButton = ({ active, onClick, children }: FilterButtonProps) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
      active
        ? 'bg-primary text-primary-foreground shadow-md'
        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
    }`}
  >
    {children}
  </button>
);

interface StatCardProps {
  label: string;
  value: string;
}

const StatCard = ({ label, value }: StatCardProps) => (
  <div className="glass-card p-4 text-center">
    <p className="text-2xl font-display font-bold text-foreground">{value}</p>
    <p className="text-sm text-muted-foreground">{label}</p>
  </div>
);


