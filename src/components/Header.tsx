import { motion } from 'framer-motion';
import { Beef, Camera, Upload, History, Info, LogOut } from 'lucide-react';
import { Button } from './ui/button';

interface HeaderProps {
  activeTab: 'upload' | 'live' | 'history';
  setActiveTab: (tab: 'upload' | 'live' | 'history') => void;
  onLogoClick?: () => void;
  totalScans?: number;
  onSignOut?: () => void;
}

export const Header = ({ activeTab, setActiveTab, onLogoClick, totalScans, onSignOut }: HeaderProps) => {
  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-50 w-full bg-card/80 backdrop-blur-xl border-b border-border/50"
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <motion.button 
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
            type="button"
            onClick={onLogoClick}
            aria-label="Go to home"
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl hero-gradient flex items-center justify-center shadow-lg">
                <Beef className="w-7 h-7 text-primary-foreground" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-accent rounded-full border-2 border-card" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-foreground">
                BreedAI
              </h1>
              <p className="text-xs text-muted-foreground">
                Cattle & Buffalo Classification
              </p>
            </div>
          </motion.button>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-2 bg-secondary/50 rounded-2xl p-1.5">
            <NavButton 
              icon={<Upload className="w-4 h-4" />}
              label="Upload"
              active={activeTab === 'upload'}
              onClick={() => setActiveTab('upload')}
            />
            <NavButton 
              icon={<Camera className="w-4 h-4" />}
              label="Live Detection"
              active={activeTab === 'live'}
              onClick={() => setActiveTab('live')}
            />
            <NavButton 
              icon={<History className="w-4 h-4" />}
              label="History"
              active={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
            />
          </nav>

          <div className="flex items-center gap-3">
            {typeof totalScans === 'number' && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs font-medium text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Total Scans: <span className="text-foreground">{totalScans}</span>
              </div>
            )}
            {onSignOut && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSignOut}
                className="rounded-xl"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            )}
            {/* Info Button */}
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Info className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex md:hidden items-center gap-2 mt-4 bg-secondary/50 rounded-2xl p-1.5">
          <NavButton 
            icon={<Upload className="w-4 h-4" />}
            label="Upload"
            active={activeTab === 'upload'}
            onClick={() => setActiveTab('upload')}
          />
          <NavButton 
            icon={<Camera className="w-4 h-4" />}
            label="Live"
            active={activeTab === 'live'}
            onClick={() => setActiveTab('live')}
          />
          <NavButton 
            icon={<History className="w-4 h-4" />}
            label="History"
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
          />
        </nav>
      </div>
    </motion.header>
  );
};

interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

const NavButton = ({ icon, label, active, onClick }: NavButtonProps) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 ${
      active 
        ? 'bg-primary text-primary-foreground shadow-md' 
        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
    } button-glow`}
  >
    {icon}
    <span>{label}</span>
  </button>
);
