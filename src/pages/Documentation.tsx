import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import readmeContent from '../../README.md?raw';

const Documentation = () => {
  return (
    <div className="min-h-screen bg-background">
      <motion.main
        className="container mx-auto px-4 py-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-display font-bold text-foreground">Project Documentation</h1>
          <Link
            to="/"
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            Back to Home
          </Link>
        </div>

        <div className="glass-card p-4 md:p-5">
          <div className="mb-3 text-xs text-muted-foreground">
            Full README is shown below in a compact scroll area.
          </div>
          <div className="max-h-[68vh] overflow-auto rounded-xl border border-border/70 bg-background/60 p-4">
            <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-foreground/90 font-mono">
              {readmeContent}
            </pre>
          </div>
        </div>
      </motion.main>
    </div>
  );
};

export default Documentation;
