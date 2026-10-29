import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ToastContainer from '../ui/Toast';
import { useApp } from '../../context/AppContext';
import { AlertCircle } from 'lucide-react';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { backendStatus, isDemoMode, toggleDemoMode } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen w-full">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Banner if backend is offline and NOT in demo mode */}
        {backendStatus === 'offline' && !isDemoMode && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                Backend API is not reachable at <strong>http://127.0.0.1:8000</strong>. Start FastAPI with{' '}
                <code className="bg-amber-100 px-1.5 py-0.5 rounded text-amber-950 font-mono">
                  uvicorn backend.main:app --reload
                </code>{' '}
                or switch to Demo Mode.
              </span>
            </div>
            <button
              onClick={() => toggleDemoMode(true)}
              className="text-xs font-semibold text-amber-800 underline hover:text-amber-950 cursor-pointer ml-2 shrink-0"
            >
              Switch to Demo Mode
            </button>
          </div>
        )}

        {/* Demo Mode Notice Banner */}
        {isDemoMode && (
          <div className="bg-purple-500/10 border-b border-purple-500/20 px-4 py-1.5 text-xs text-purple-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
              <span>
                <strong>DEMO MODE ACTIVE:</strong> Showing simulated classroom analytics with the 5 enrolled student profiles.
              </span>
            </div>
            <button
              onClick={() => toggleDemoMode(false)}
              className="text-xs font-semibold text-purple-800 underline hover:text-purple-950 cursor-pointer ml-2"
            >
              Exit Demo Mode
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Toast Notification Stack */}
      <ToastContainer />
    </div>
  );
}
