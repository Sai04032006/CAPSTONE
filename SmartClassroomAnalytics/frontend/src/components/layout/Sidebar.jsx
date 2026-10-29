import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Radio,
  Users,
  CheckSquare,
  CalendarDays,
  BarChart3,
  Settings,
  GraduationCap,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/live', label: 'Live Monitoring', icon: Radio, highlight: true },
  { path: '/students', label: 'Students', icon: Users },
  { path: '/attendance', label: 'Attendance', icon: CheckSquare },
  { path: '/sessions', label: 'Class Sessions', icon: CalendarDays },
  { path: '/analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ isOpen, onClose }) {
  const { activeSession, backendStatus, isDemoMode } = useApp();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-200 ease-in-out border-r border-slate-800 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                SmartClassroom
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  AI
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">Classroom Analytics</p>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Navigation
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                  <span>{item.label}</span>
                </div>
                {item.highlight && activeSession && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Active Session status banner in sidebar footer */}
        <div className="p-3 border-t border-slate-800">
          {activeSession ? (
            <div className="p-3 rounded-lg bg-slate-800/90 border border-slate-700/80">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active Session #{activeSession.id}
                </span>
                <span className="text-[10px] text-slate-400">
                  {activeSession.duration_minutes}m
                </span>
              </div>
              <p className="text-xs font-medium text-slate-200 truncate">
                {activeSession.subject || 'Class in Progress'}
              </p>
              <NavLink
                to="/live"
                className="mt-2 text-[11px] font-medium text-indigo-300 hover:text-indigo-200 flex items-center gap-1"
              >
                Go to live feed <ChevronRight className="h-3 w-3" />
              </NavLink>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800/80 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                <span>No active session</span>
              </div>
              <NavLink
                to="/sessions"
                className="mt-1.5 block text-[11px] font-medium text-indigo-400 hover:text-indigo-300"
              >
                + Start a class session
              </NavLink>
            </div>
          )}

          {/* Mode Pill */}
          <div className="mt-2.5 px-2 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  backendStatus === 'online'
                    ? 'bg-emerald-500'
                    : backendStatus === 'checking'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-rose-500'
                }`}
              />
              {backendStatus === 'online'
                ? 'Backend Live'
                : backendStatus === 'checking'
                ? 'Connecting...'
                : 'Offline'}
            </span>
            {isDemoMode && (
              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-semibold border border-purple-500/30">
                DEMO
              </span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
