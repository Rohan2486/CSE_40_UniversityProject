import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { ImageUpload, ClassificationContext, ClassificationResponse } from '@/components/ImageUpload';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const LiveDetection = lazy(() =>
  import('@/components/LiveDetection').then((module) => ({ default: module.LiveDetection })),
);
const ClassificationHistory = lazy(() =>
  import('@/components/ClassificationHistory').then((module) => ({ default: module.ClassificationHistory })),
);

const Index = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'upload' | 'live' | 'history'>('upload');
  const [showHero, setShowHero] = useState(true);
  const [totalScans, setTotalScans] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const handleGetStarted = () => {
    setShowHero(false);
    setActiveTab('upload');
  };

  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setCurrentUserId(data.user?.id ?? null);
    };
    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setTotalScans(0);
      return;
    }

    const fetchTotal = async () => {
      const { count, error } = await supabase
        .from('classifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUserId);
      if (!error && typeof count === 'number') {
        setTotalScans(count);
      }
    };

    fetchTotal();

    const channel = supabase
      .channel('realtime:classifications-count')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'classifications', filter: `user_id=eq.${currentUserId}` },
        () => {
          setTotalScans((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const uploadImage = useCallback(async (imageData: string) => {
    const response = await fetch(imageData);
    const blob = await response.blob();
    const fileExt = blob.type.split('/')[1] || 'jpg';
    const fileName = `classification-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('classification-images')
      .upload(fileName, blob, { upsert: true });

    if (error || !data) throw error ?? new Error('Upload failed');

    const { data: publicData } = supabase.storage
      .from('classification-images')
      .getPublicUrl(data.path);

    return publicData.publicUrl;
  }, []);

  const classifyImage = useCallback(async (
    imageData: string,
    context?: ClassificationContext,
  ): Promise<ClassificationResponse> => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/classify-animal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          imageData,
          cvMetrics: context?.cvMetrics,
          cvWarnings: context?.cvWarnings ?? [],
          inferenceMode: context?.inferenceMode ?? 'auto',
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 429) {
        toast.error('Rate limit exceeded. Please wait a moment and try again.');
        throw new Error('Rate limit exceeded');
      }
      
      if (response.status === 402) {
        toast.error('Usage limit reached. Please add credits to continue.');
        throw new Error('Payment required');
      }
      
      throw new Error(errorData.error || 'Classification failed');
    }

    const result = await response.json();
    
    if (result.confidence > 0) {
      toast.success(`Identified: ${result.breed} (${result.type})`);
    } else {
      toast.warning('Could not identify the animal in the image');
    }

    try {
      const imageUrl = await uploadImage(imageData);
      const saveResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-classification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            image_url: imageUrl,
            user_id: currentUserId,
            type: result.type,
            breed: result.breed,
            confidence: result.confidence,
            traits: result.traits,
            recommendations: result.recommendations,
          }),
        }
      );
      if (!saveResponse.ok) {
        const errText = await saveResponse.text();
        throw new Error(errText || 'Failed to save classification');
      }
    } catch (saveError) {
      console.warn('Failed to save classification:', saveError);
      try {
        const { error } = await supabase.from('classifications').insert({
          user_id: currentUserId,
          image_url: null,
          type: result.type,
          breed: result.breed,
          confidence: result.confidence,
          traits: result.traits,
          recommendations: result.recommendations ?? null,
        });
        if (error) {
          throw error;
        }
      } catch (fallbackError) {
        console.warn('Fallback save failed:', fallbackError);
      }
    }
    
    return result;
  }, [uploadImage, currentUserId]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    toast.success('Signed out');
    navigate('/login');
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 ambient-grid opacity-70" />
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setShowHero(false);
        }}
        onLogoClick={() => {
          setShowHero(true);
          setActiveTab('upload');
        }}
        totalScans={totalScans}
        onSignOut={handleSignOut}
      />

      <main className="container mx-auto px-4 pb-12 relative">
        <AnimatePresence mode="wait">
          {showHero && (
            <motion.div
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <HeroSection onGetStarted={handleGetStarted} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!showHero && (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="py-8"
            >
              <AnimatePresence mode="wait">
                {activeTab === 'upload' && (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <div className="max-w-4xl mx-auto">
                      <div className="mb-8">
                        <h2 className="text-3xl font-display font-bold text-foreground mb-2">
                          Upload Image
                        </h2>
                        <p className="text-muted-foreground">
                          Upload a clear image of a cattle or buffalo for AI-powered breed classification
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-4">
                          <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
                            JPG/PNG Supported
                          </span>
                          <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
                            Max 10MB
                          </span>
                          <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
                            Avg Result &lt; 2s
                          </span>
                        </div>
                      </div>
                      <ImageUpload onClassify={classifyImage} />
                    </div>
                  </motion.div>
                )}

                {activeTab === 'live' && (
                  <motion.div
                    key="live"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <div className="max-w-4xl mx-auto">
                      <div className="mb-8">
                        <h2 className="text-3xl font-display font-bold text-foreground mb-2">
                          Live Detection
                        </h2>
                        <p className="text-muted-foreground">
                          Use your camera for real-time breed detection and classification
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-4">
                          <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
                            Low Latency
                          </span>
                          <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
                            HD Preview
                          </span>
                          <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
                            Instant Results
                          </span>
                        </div>
                      </div>
                      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading live detection...</div>}>
                        <LiveDetection onClassify={classifyImage} />
                      </Suspense>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'history' && (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                  <div className="max-w-5xl mx-auto">
                    <div className="mb-6">
                      <h2 className="text-3xl font-display font-bold text-foreground mb-2">
                        Classification History
                      </h2>
                      <p className="text-muted-foreground">
                        Review your recent classifications and insights
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-4">
                        <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
                          Recent Scans
                        </span>
                        <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
                          Export-Ready
                        </span>
                        <span className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
                          Secure Storage
                        </span>
                      </div>
                    </div>
                    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading history...</div>}>
                      <ClassificationHistory userId={currentUserId} />
                    </Suspense>
                  </div>
                </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-8 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <p className="text-sm text-muted-foreground">
                Developed by CSE_40
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                AI-powered Animal Type Classification System
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link
                to="/privacy"
                className="hover:text-foreground transition-colors"
                title="View Privacy Policy"
              >
                Privacy Policy
              </Link>
              <span>&bull;</span>
              <Link
                to="/terms"
                className="hover:text-foreground transition-colors"
                title="View Terms of Service"
              >
                Terms of Service
              </Link>
              <span>&bull;</span>
              <a
                href="mailto:ROHAN.20221CSE0009@PresidencyUniversity.in"
                className="hover:text-foreground transition-colors"
                title="Email us"
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
