import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";
import { PageLoader } from "@/components/animations/SmoothLoader";
import { supabase } from "./integrations/supabase/client";

const queryClient = new QueryClient();
const Index = lazy(() => import("./pages/Index"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Documentation = lazy(() => import("./pages/Documentation"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));

const RouteLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <PageLoader fullScreen={false} />
  </div>
);

const ProtectedRoute = ({
  session,
  sessionLoading,
  children,
}: {
  session: Session | null;
  sessionLoading: boolean;
  children: ReactNode;
}) => {
  if (sessionLoading) return <RouteLoader />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const PublicOnlyRoute = ({
  session,
  sessionLoading,
  children,
}: {
  session: Session | null;
  sessionLoading: boolean;
  children: ReactNode;
}) => {
  if (sessionLoading) return <RouteLoader />;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(currentSession);
      setSessionLoading(false);
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      <Suspense fallback={<RouteLoader />}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <Routes location={location}>
              <Route
                path="/login"
                element={(
                  <PublicOnlyRoute session={session} sessionLoading={sessionLoading}>
                    <Login />
                  </PublicOnlyRoute>
                )}
              />
              <Route
                path="/signup"
                element={(
                  <PublicOnlyRoute session={session} sessionLoading={sessionLoading}>
                    <Signup />
                  </PublicOnlyRoute>
                )}
              />
              <Route
                path="/"
                element={(
                  <ProtectedRoute session={session} sessionLoading={sessionLoading}>
                    <Index />
                  </ProtectedRoute>
                )}
              />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/documentation" element={<Documentation />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </Suspense>
    </>
  );
};

const App = () => {

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
