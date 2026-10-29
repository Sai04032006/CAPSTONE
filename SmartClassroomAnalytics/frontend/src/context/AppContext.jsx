import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { checkHealth } from '../api/health';
import { getActiveSession as fetchActiveSession } from '../api/sessions';
import { getApiBaseUrl, setApiBaseUrl, apiClient } from '../api/client';
import {
  INITIAL_STUDENTS,
  INITIAL_SESSIONS,
  INITIAL_ATTENDANCE,
  INITIAL_BEHAVIOR,
} from '../data/mockData';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [backendStatus, setBackendStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [activeSession, setActiveSession] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(() => {
    return localStorage.getItem('smartclassroom_demo_mode') === 'true';
  });
  const [toasts, setToasts] = useState([]);
  const [lastChecked, setLastChecked] = useState(null);
  const [apiBaseUrl, setApiBaseUrlState] = useState(getApiBaseUrl());

  // Demo state stores for local simulation when demo mode is active
  const [demoSessions, setDemoSessions] = useState(() => {
    const saved = localStorage.getItem('demo_sessions');
    return saved ? JSON.parse(saved) : INITIAL_SESSIONS;
  });
  const [demoStudents, setDemoStudents] = useState(() => {
    const saved = localStorage.getItem('demo_students');
    return saved ? JSON.parse(saved) : INITIAL_STUDENTS;
  });
  const [demoAttendance, setDemoAttendance] = useState(() => {
    const saved = localStorage.getItem('demo_attendance');
    return saved ? JSON.parse(saved) : INITIAL_ATTENDANCE;
  });
  const [demoBehavior, setDemoBehavior] = useState(() => {
    const saved = localStorage.getItem('demo_behavior');
    return saved ? JSON.parse(saved) : INITIAL_BEHAVIOR;
  });

  // Save demo state changes
  useEffect(() => {
    localStorage.setItem('demo_sessions', JSON.stringify(demoSessions));
  }, [demoSessions]);
  useEffect(() => {
    localStorage.setItem('demo_students', JSON.stringify(demoStudents));
  }, [demoStudents]);
  useEffect(() => {
    localStorage.setItem('demo_attendance', JSON.stringify(demoAttendance));
  }, [demoAttendance]);
  useEffect(() => {
    localStorage.setItem('demo_behavior', JSON.stringify(demoBehavior));
  }, [demoBehavior]);

  // Toast notifications
  const addToast = useCallback((type, title, message) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Update active session
  const refreshActiveSession = useCallback(async () => {
    if (isDemoMode) {
      const active = demoSessions.find((s) => s.status === 'ACTIVE') || null;
      setActiveSession(active);
      return active;
    }
    try {
      const active = await fetchActiveSession();
      setActiveSession(active);
      return active;
    } catch {
      setActiveSession(null);
      return null;
    }
  }, [isDemoMode, demoSessions]);

  // Check backend health with dual-path auto-fallback (/api proxy vs direct URL)
  const checkBackend = useCallback(async (notify = false) => {
    setBackendStatus('checking');

    // 1. Try current configured baseURL
    try {
      await checkHealth();
      setBackendStatus('online');
      setLastChecked(new Date());
      if (notify) {
        addToast('success', 'Backend Connected', `FastAPI backend is online at ${getApiBaseUrl()}`);
      }
      refreshActiveSession();
      return true;
    } catch (_primaryErr) {
      // 2. Try alternate path (if currently /api, try http://127.0.0.1:8000; if direct, try /api)
      const currentUrl = apiClient.defaults.baseURL;
      const fallbackUrl = currentUrl === '/api' ? 'http://127.0.0.1:8000' : '/api';

      try {
        const testRes = await axios.get(`${fallbackUrl}/health`, { timeout: 3000 });
        if (testRes.data) {
          apiClient.defaults.baseURL = fallbackUrl;
          setApiBaseUrlState(fallbackUrl);
          setBackendStatus('online');
          setLastChecked(new Date());
          if (notify) {
            addToast('success', 'Backend Connected', `Connected via ${fallbackUrl}`);
          }
          refreshActiveSession();
          return true;
        }
      } catch (_fallbackErr) {
        // Both primary and fallback failed
      }

      setBackendStatus('offline');
      setLastChecked(new Date());
      if (notify) {
        addToast(
          'error',
          'Backend Offline',
          'Could not reach FastAPI backend. Make sure uvicorn is running on port 8000.'
        );
      }
      return false;
    }
  }, [addToast, refreshActiveSession]);

  // Initial backend check
  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  const toggleDemoMode = useCallback((val) => {
    const nextVal = typeof val === 'boolean' ? val : !isDemoMode;
    setIsDemoMode(nextVal);
    localStorage.setItem('smartclassroom_demo_mode', String(nextVal));
    if (nextVal) {
      addToast('info', 'Demo Mode Active', 'Using simulated classroom data. Real backend is bypassed.');
    } else {
      addToast('info', 'Live Mode Active', 'Connecting to real backend API.');
      checkBackend(true);
    }
  }, [isDemoMode, addToast, checkBackend]);

  const updateApiUrl = useCallback((newUrl) => {
    setApiBaseUrl(newUrl);
    setApiBaseUrlState(newUrl || '/api');
    checkBackend(true);
  }, [checkBackend]);

  const resetDemoData = useCallback(() => {
    setDemoSessions(INITIAL_SESSIONS);
    setDemoStudents(INITIAL_STUDENTS);
    setDemoAttendance(INITIAL_ATTENDANCE);
    setDemoBehavior(INITIAL_BEHAVIOR);
    localStorage.removeItem('demo_sessions');
    localStorage.removeItem('demo_students');
    localStorage.removeItem('demo_attendance');
    localStorage.removeItem('demo_behavior');
    addToast('success', 'Demo Data Reset', 'Simulated data reset to initial classroom state.');
  }, [addToast]);

  return (
    <AppContext.Provider
      value={{
        backendStatus,
        lastChecked,
        checkBackend,
        isDemoMode,
        toggleDemoMode,
        activeSession,
        refreshActiveSession,
        toasts,
        addToast,
        removeToast,
        apiBaseUrl,
        updateApiUrl,
        // Demo state handlers
        demoState: {
          sessions: demoSessions,
          setSessions: setDemoSessions,
          students: demoStudents,
          setStudents: setDemoStudents,
          attendance: demoAttendance,
          setAttendance: setDemoAttendance,
          behavior: demoBehavior,
          setBehavior: setDemoBehavior,
          resetDemoData,
        },
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
