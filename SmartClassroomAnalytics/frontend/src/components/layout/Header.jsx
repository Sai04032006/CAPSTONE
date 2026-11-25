import React, { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Menu,
  RefreshCw,
  LogOut,
  User,
  Shield,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import Badge from '../ui/Badge';

const TITLE_MAP = {
  '/': { title: 'Classroom Dashboard', subtitle: 'Overview of attendance, sessions & student activity' },
  '/evaluation': { title: 'Evaluation Metrics & Graphs', subtitle: 'Empirical AI benchmarks across YOLOv11, InsightFace & tracking' },
  '/live': { title: 'Live Classroom Monitoring', subtitle: 'Real-time YOLO & InsightFace tracking feed' },
  '/students': { title: 'Student Directory', subtitle: 'Enrolled students and individual attendance records' },
  '/attendance': { title: 'Attendance Management', subtitle: 'Presence calculation, verification & session reports' },
  '/sessions': { title: 'Class Sessions', subtitle: 'Session scheduling, duration tracking and threshold rules' },
  '/analytics': { title: 'Analytics & Reports', subtitle: 'Visual performance metrics and attendance trends' },
  '/teachers': { title: 'Faculty & Teacher Directory', subtitle: 'Principal administration & teacher assignment module' },
  '/settings': { title: 'Settings & Status', subtitle: 'API server configuration and system diagnostics' },
};

export default function Header({ onMenuClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    backendStatus,
    checkBackend,
    isDemoMode,
    toggleDemoMode,
    activeSession,
  } = useApp();

  const {
    currentUser,
    isPrincipal,
    teachersList,
    selectedTeacherFilter,
    setSelectedTeacherFilter,
    logout,
  } = useAuth();

  const [showProfileMenu, setShowProfileMenu] = useState(false);

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

      {/* Right side controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Principal School-wide Teacher Scoping Filter */}
        {isPrincipal && (
          <div className="hidden md:flex items-center gap-1.5 bg-purple-50/80 border border-purple-200 rounded-lg px-2.5 py-1">
            <Filter className="h-3.5 w-3.5 text-purple-600" />
            <span className="text-[11px] font-semibold text-purple-900">View Scope:</span>
            <select
              value={selectedTeacherFilter || ''}
              onChange={(e) => setSelectedTeacherFilter(e.target.value || null)}
              className="bg-transparent text-xs font-semibold text-purple-950 focus:outline-none cursor-pointer"
            >
              <option value="">All Teachers (School-wide)</option>
              {teachersList.map((t) => (
                <option key={t.teacher_id} value={t.teacher_id}>
                  {t.name} (#{t.teacher_id})
                </option>
              ))}
            </select>
          </div>
        )}

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

        {/* Current User Role Pill & Menu */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu((prev) => !prev)}
            className={`flex items-center gap-2 pl-2 pr-3 py-1 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
              isPrincipal
                ? 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100'
                : 'bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100'
            }`}
          >
            <div
              className={`h-6 w-6 rounded-lg flex items-center justify-center text-[11px] font-bold text-white ${
                isPrincipal ? 'bg-purple-600' : 'bg-indigo-600'
              }`}
            >
              {isPrincipal ? 'P' : currentUser?.teacher_id ? currentUser.teacher_id.slice(-2) : 'T'}
            </div>
            <span className="hidden sm:inline truncate max-w-[120px]">
              {currentUser?.name || (isPrincipal ? 'Principal' : 'Teacher')}
            </span>
          </button>

          {/* Profile Dropdown */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs">
              <div className="px-3.5 py-2 border-b border-slate-100">
                <p className="font-semibold text-slate-900 truncate">
                  {currentUser?.name || (isPrincipal ? 'Principal Office' : 'Teacher')}
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  {isPrincipal ? 'Username: principle' : `Teacher ID: ${currentUser?.teacher_id}`}
                </p>
                <div className="mt-1">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isPrincipal
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    {isPrincipal ? 'School Principal (Full Access)' : 'Classroom Teacher'}
                  </span>
                </div>
              </div>

              <div className="py-1">
                <Link
                  to="/login"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span>Switch Account / Sign In</span>
                </Link>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    logout();
                    navigate('/login');
                  }}
                  className="w-full text-left flex items-center gap-2 px-3.5 py-2 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5 text-rose-500" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
