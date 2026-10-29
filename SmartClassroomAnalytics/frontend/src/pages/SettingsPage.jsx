import React, { useState } from 'react';
import {
  Settings,
  Server,
  Database,
  Cpu,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Info,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { checkHealth, checkRoot } from '../api/health';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorAlert from '../components/ui/ErrorAlert';

export default function SettingsPage() {
  const {
    backendStatus,
    checkBackend,
    isDemoMode,
    toggleDemoMode,
    apiBaseUrl,
    updateApiUrl,
    demoState,
    addToast,
  } = useApp();

  const [inputUrl, setInputUrl] = useState(apiBaseUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Test API endpoint connectivity
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const start = performance.now();

    try {
      const data = await checkHealth();
      const latency = Math.round(performance.now() - start);
      setTestResult({
        success: true,
        message: `FastAPI responded in ${latency}ms: status="${data.status}"`,
      });
      addToast('success', 'Connection Verified', `Connected to ${apiBaseUrl} (${latency}ms)`);
      checkBackend();
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      setTestResult({
        success: false,
        message: `Failed after ${latency}ms: ${err.userMessage || err.message}`,
      });
      addToast('error', 'Connection Test Failed', err.userMessage || err.message);
    } finally {
      setTesting(false);
    }
  };

  // Save new API Base URL
  const handleSaveUrl = (e) => {
    e.preventDefault();
    const cleanUrl = inputUrl.trim().replace(/\/+$/, '');
    updateApiUrl(cleanUrl);
    addToast('info', 'API Endpoint Updated', `Base URL set to ${cleanUrl}`);
  };

  const handleResetUrl = () => {
    setInputUrl('http://127.0.0.1:8000');
    updateApiUrl('http://127.0.0.1:8000');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Title */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          System Settings & Diagnostics
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure API endpoints, examine backend connectivity and review AI specifications
        </p>
      </div>

      {/* Backend API Configuration */}
      <Card
        title="Backend API Connection"
        subtitle="Configure the FastAPI server endpoint for attendance and analytics"
      >
        <form onSubmit={handleSaveUrl} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              API Base URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                required
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="http://127.0.0.1:8000"
                className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                >
                  Save URL
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleTestConnection}
                  loading={testing}
                  icon={RefreshCw}
                >
                  Test Ping
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleResetUrl}
                >
                  Default
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Default is <code className="font-mono">http://127.0.0.1:8000</code>. Vite proxy also routes <code className="font-mono">/api</code>.
            </p>
          </div>

          {/* Test connection result banner */}
          {testResult && (
            <div
              className={`p-3 rounded-lg text-xs flex items-start gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border border-rose-200 text-rose-900'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="font-mono">{testResult.message}</span>
            </div>
          )}

          {/* Current Status Badge row */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-600">Current API Status:</span>
            <Badge
              variant={
                backendStatus === 'online'
                  ? 'ONLINE'
                  : backendStatus === 'checking'
                  ? 'CHECKING'
                  : 'OFFLINE'
              }
              dot
            >
              {backendStatus === 'online'
                ? 'Connected (FastAPI Healthy)'
                : backendStatus === 'checking'
                ? 'Checking...'
                : 'Offline / Unreachable'}
            </Badge>
          </div>
        </form>
      </Card>

      {/* Demo Simulation Controls */}
      <Card
        title="Simulation / Demo Mode"
        subtitle="Run the dashboard with simulated data without a live camera or database"
      >
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="font-semibold text-slate-900 block">
                Enable Simulated Demo Mode
              </span>
              <p className="text-slate-500 mt-0.5 text-[11px]">
                Useful when FastAPI or camera hardware is offline. Uses real schema shapes and the 5 enrolled student identities.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleDemoMode()}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isDemoMode ? 'bg-purple-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isDemoMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {isDemoMode && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-slate-500">Reset simulated state:</span>
              <Button
                size="sm"
                variant="outline"
                icon={RotateCcw}
                onClick={demoState.resetDemoData}
              >
                Reset Demo Data
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Architecture & Environment Specifications */}
      <Card
        title="Smart Classroom Platform Architecture"
        subtitle="Underlying technologies and production constraints"
      >
        <div className="divide-y divide-slate-100 text-xs">
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-500">Frontend Stack</span>
            <span className="font-semibold text-slate-800 font-mono">
              React 19 • Vite 8 • Tailwind CSS v4 • Recharts
            </span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-500">Backend Framework</span>
            <span className="font-semibold text-slate-800 font-mono">
              FastAPI • Uvicorn • Pydantic v2
            </span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-500">Database Engine</span>
            <span className="font-semibold text-slate-800 font-mono">
              PostgreSQL 18 • SQLAlchemy 2.0 • pgvector
            </span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-500">Person Tracking</span>
            <span className="font-semibold text-slate-800 font-mono">
              YOLOv11 Nano (yolo11n.pt)
            </span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-500">Face Recognition Vector</span>
            <span className="font-semibold text-slate-800 font-mono">
              InsightFace 512-d (Cosine Threshold: 0.45)
            </span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-500">Attendance Business Rule</span>
            <span className="font-semibold text-indigo-700 font-mono">
              70% Class Duration (Fixed Institutional Policy)
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
