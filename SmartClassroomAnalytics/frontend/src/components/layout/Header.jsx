import { useLocation, Link } from 'react-router-dom';
import {
  Menu,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Badge from '../ui/Badge';

const TITLE_MAP = {
  '/': { title: 'Classroom Dashboard', subtitle: 'Overview of attendance, sessions & student activity' },
  '/live': { title: 'Live Classroom Monitoring', subtitle: 'Real-time YOLO & InsightFace tracking feed' },
  '/students': { title: 'Student Directory', subtitle: 'Enrolled students and individual attendance records' },
  '/attendance': { title: 'Attendance Management', subtitle: 'Presence calculation, verification & session reports' },
  '/sessions': { title: 'Class Sessions', subtitle: 'Session scheduling, duration tracking and threshold rules' },
  '/analytics': { title: 'Analytics & Reports', subtitle: 'Visual performance metrics and attendance trends' },
  '/settings': { title: 'Settings & Status', subtitle: 'API server configuration and system diagnostics' },
};

export default function Header({ onMenuClick }) {
  const location = useLocation();
  const {
    backendStatus,
    checkBackend,
    isDemoMode,
    toggleDemoMode,
    activeSession,
  } = useApp();

  const currentMeta = TITLE_MAP[location.pathname] || {
    title: 'Smart Classroom',
    subtitle: 'AI Analytics Platform',
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {currentMeta.title}
          </h2>
          <p className="hidden sm:block text-xs text-slate-500 font-normal">
            {currentMeta.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Active session alert, Connection badge, Demo toggle, Refresh */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Active Session indicator */}
        {activeSession && (
          <Link
            to="/live"
            className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Session #{activeSession.id}</span>
            <span className="text-emerald-600 font-normal">
              ({activeSession.duration_minutes}m)
            </span>
          </Link>
        )}

        {/* Demo Mode Toggle Button */}
        <button
          type="button"
          onClick={() => toggleDemoMode()}
          title="Toggle between real FastAPI backend and simulated demo data"
          className={`cursor-pointer px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
            isDemoMode
              ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isDemoMode ? 'bg-purple-600' : 'bg-slate-400'
            }`}
          />
          <span className="hidden xs:inline">
            {isDemoMode ? 'Demo Mode' : 'Live Mode'}
          </span>
        </button>

        {/* Backend Status Badge */}
        <div className="flex items-center gap-1.5">
          <Badge
            variant={
              backendStatus === 'online'
                ? 'ONLINE'
                : backendStatus === 'checking'
                ? 'CHECKING'
                : 'OFFLINE'
            }
            dot
            size="sm"
          >
            <span className="hidden sm:inline">API: </span>
            {backendStatus === 'online'
              ? 'Connected'
              : backendStatus === 'checking'
              ? 'Checking...'
              : 'Disconnected'}
          </Badge>

          <button
            type="button"
            onClick={() => checkBackend(true)}
            title="Refresh backend connection"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`h-4 w-4 ${backendStatus === 'checking' ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
