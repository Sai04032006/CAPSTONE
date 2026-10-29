import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Radio,
  Play,
  Square,
  Users,
  Camera,
  Cpu,
  CheckCircle2,
  PhoneCall,
  RefreshCw,
  Video,
  VideoOff,
  Maximize2,
  Sparkles,
  Layers,
  AlertCircle,
  Terminal,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { endSession, createSession, getTrackerStatus, startTracker, stopTracker } from '../api/sessions';
import { getSessionAttendance } from '../api/attendance';
import { getSessionBehavior } from '../api/behavior';
import { getStudents } from '../api/students';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ErrorAlert from '../components/ui/ErrorAlert';
import EmptyState from '../components/ui/EmptyState';
import {
  formatSecondsToMinutes,
  formatPercentage,
  formatDateTime,
} from '../utils/formatters';

export default function LiveMonitoringPage() {
  const {
    isDemoMode,
    demoState,
    activeSession,
    refreshActiveSession,
    addToast,
    apiBaseUrl,
  } = useApp();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(3000);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const [students, setStudents] = useState([]);
  const [sessionAttendance, setSessionAttendance] = useState([]);
  const [sessionBehavior, setSessionBehavior] = useState([]);

  // AI Tracker Subprocess State
  const [trackerStatus, setTrackerStatus] = useState('IDLE'); // IDLE, STARTING, RUNNING, STOPPED, FAILED
  const [trackerPid, setTrackerPid] = useState(null);
  const [trackerError, setTrackerError] = useState(null);
  const [trackerLogs, setTrackerLogs] = useState([]);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  // Live Stream State
  const [aiStreamActive, setAiStreamActive] = useState(false);
  const [streamAge, setStreamAge] = useState(null);
  const [browserCameraActive, setBrowserCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const videoContainerRef = useRef(null);
  const browserVideoRef = useRef(null);
  const browserStreamRef = useRef(null);

  // Modals
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('Computer Vision & AI');
  const [newDuration, setNewDuration] = useState(50);
  const [actionLoading, setActionLoading] = useState(false);

  // Resolve base stream URL
  const resolvedBaseUrl = apiBaseUrl || '/api';
  const streamVideoUrl = `${resolvedBaseUrl}/stream/video`;

  // Check AI Stream Status
  const checkAiStream = async () => {
    try {
      const res = await axios.get(`${resolvedBaseUrl}/stream/status`, { timeout: 2000 });
      setAiStreamActive(res.data?.active || false);
      setStreamAge(res.data?.age_seconds);
    } catch {
      setAiStreamActive(false);
    }
  };

  useEffect(() => {
    checkAiStream();
    const streamInterval = setInterval(checkAiStream, 2000);
    return () => clearInterval(streamInterval);
  }, [resolvedBaseUrl]);

  // Poll AI Tracker process lifecycle & status
  const checkTracker = async () => {
    if (isDemoMode) return;
    try {
      const data = await getTrackerStatus();
      if (data) {
        setTrackerStatus(data.status || 'IDLE');
        setTrackerPid(data.pid || null);
        setTrackerError(data.last_error || null);
        if (data.recent_logs) {
          setTrackerLogs(data.recent_logs);
        }
      }
    } catch {
      // Backend may be restarting
    }
  };

  useEffect(() => {
    checkTracker();
    const trackerInterval = setInterval(checkTracker, 2000);
    return () => clearInterval(trackerInterval);
  }, [isDemoMode]);

  // Explicit Tracker controls
  const handleStartTracker = async () => {
    if (!activeSession) return;
    setTrackerLoading(true);
    setTrackerStatus('STARTING');
    try {
      await startTracker(activeSession.id);
      addToast('info', 'AI Tracker Starting', 'Initializing YOLO & InsightFace camera pipeline...');
      await checkTracker();
    } catch (err) {
      addToast('error', 'Tracker Launch Failed', err.userMessage || err.message);
      await checkTracker();
    } finally {
      setTrackerLoading(false);
    }
  };

  const handleStopTracker = async () => {
    if (!activeSession) return;
    setTrackerLoading(true);
    try {
      await stopTracker(activeSession.id);
      addToast('info', 'AI Tracker Stopped', 'Camera feed released.');
      await checkTracker();
    } catch (err) {
      addToast('error', 'Could not stop tracker', err.userMessage || err.message);
    } finally {
      setTrackerLoading(false);
    }
  };

  // Browser Webcam Handler (fallback direct camera access)
  const toggleBrowserCamera = async () => {
    if (browserCameraActive) {
      if (browserStreamRef.current) {
        browserStreamRef.current.getTracks().forEach((track) => track.stop());
        browserStreamRef.current = null;
      }
      setBrowserCameraActive(false);
      setCameraError(null);
    } else {
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        browserStreamRef.current = stream;
        if (browserVideoRef.current) {
          browserVideoRef.current.srcObject = stream;
        }
        setBrowserCameraActive(true);
        addToast('success', 'Webcam Activated', 'Local browser webcam is now streaming.');
      } catch (err) {
        setCameraError(err.message || 'Cannot access webcam');
        addToast('error', 'Camera Error', 'Could not open browser webcam: ' + err.message);
      }
    }
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (browserStreamRef.current) {
        browserStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Fetch session data
  const fetchLiveData = async (isManual = false) => {
    if (isManual) setLoading(true);

    if (isDemoMode) {
      const demoActive = demoState.sessions.find((s) => s.status === 'ACTIVE') || null;
      setStudents(demoState.students);
      if (demoActive) {
        const att = demoState.attendance.filter((a) => a.session_id === demoActive.id);
        const beh = demoState.behavior.filter((b) => b.session_id === demoActive.id);
        setSessionAttendance(att);
        setSessionBehavior(beh);
      } else {
        setSessionAttendance([]);
        setSessionBehavior([]);
      }
      setLastRefreshed(new Date());
      setLoading(false);
      return;
    }

    try {
      const currentActive = await refreshActiveSession();
      const allStudents = await getStudents().catch(() => []);
      setStudents(allStudents);

      if (currentActive) {
        const [att, beh] = await Promise.all([
          getSessionAttendance(currentActive.id).catch(() => []),
          getSessionBehavior(currentActive.id).catch(() => []),
        ]);
        setSessionAttendance(att);
        setSessionBehavior(beh);
      } else {
        setSessionAttendance([]);
        setSessionBehavior([]);
      }
      setError(null);
      setLastRefreshed(new Date());
    } catch (err) {
      if (isManual) {
        setError(err.userMessage || 'Failed to poll live monitoring feed');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveData(true);
  }, [isDemoMode]);

  // Periodic polling for live presence
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;
    const interval = setInterval(() => {
      fetchLiveData(false);
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, activeSession, isDemoMode]);

  // Handle End Session
  const handleEndSession = async () => {
    if (!activeSession) return;
    setActionLoading(true);

    if (isDemoMode) {
      const updated = demoState.sessions.map((s) =>
        s.id === activeSession.id
          ? { ...s, status: 'COMPLETED', ended_at: new Date().toISOString() }
          : s
      );
      demoState.setSessions(updated);
      setIsEndModalOpen(false);
      setActionLoading(false);
      refreshActiveSession();
      addToast('success', 'Session Ended', `Class session #${activeSession.id} has ended.`);
      return;
    }

    try {
      await endSession(activeSession.id);
      addToast('success', 'Session Ended', `Class session #${activeSession.id} ended. Final attendance calculated.`);
      setIsEndModalOpen(false);
      setTrackerStatus('STOPPED');
      await refreshActiveSession();
      fetchLiveData(true);
      checkTracker();
    } catch (err) {
      addToast('error', 'Could not end session', err.userMessage || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Start Session
  const handleStartSession = async (e) => {
    e.preventDefault();
    setActionLoading(true);

    if (isDemoMode) {
      const newId = (demoState.sessions[0]?.id || 0) + 1;
      const newSession = {
        id: newId,
        subject: newSubject.trim() || 'Untitled Class',
        duration_minutes: Number(newDuration) || 50,
        attendance_threshold: 0.70,
        started_at: new Date().toISOString(),
        ended_at: null,
        status: 'ACTIVE',
      };
      demoState.setSessions([newSession, ...demoState.sessions]);
      setIsStartModalOpen(false);
      setActionLoading(false);
      refreshActiveSession();
      addToast('success', 'Session Started', `Class session #${newId} is now active.`);
      return;
    }

    try {
      const created = await createSession({
        subject: newSubject,
        duration_minutes: newDuration,
      });
      addToast('success', 'Session Started', `Session #${created.id} is active. AI camera pipeline auto-started.`);
      setIsStartModalOpen(false);
      setTrackerStatus('STARTING');
      await refreshActiveSession();
      fetchLiveData(true);
      checkTracker();
    } catch (err) {
      addToast('error', 'Failed to start session', err.userMessage || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const presentCount = sessionAttendance.filter((a) => a.status === 'PRESENT').length;

  return (
    <div className="space-y-6">
      {/* Session Status & Quick Control Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
              activeSession
                ? 'bg-emerald-50 text-emerald-600 ring-4 ring-emerald-50'
                : 'bg-slate-100 text-slate-400'
            }`}
          >
            <Radio
              className={`h-6 w-6 ${activeSession ? 'animate-pulse text-emerald-600' : ''}`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                {activeSession
                  ? activeSession.subject || `Session #${activeSession.id}`
                  : 'No Active Class Session'}
              </span>
              <Badge
                variant={activeSession ? 'ACTIVE' : 'DEFAULT'}
                dot={!!activeSession}
                size="sm"
              >
                {activeSession ? 'SESSION RUNNING' : 'IDLE'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeSession ? (
                <>
                  Session #{activeSession.id} • Started{' '}
                  {formatDateTime(activeSession.started_at)} •{' '}
                  {activeSession.duration_minutes} min duration • 70% threshold
                </>
              ) : (
                'Start a class session to begin accumulating student presence and behavior tracking'
              )}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          {/* Polling controller */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="hidden sm:inline">Polling:</span>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
            >
              <option value={2000}>2s</option>
              <option value={3000}>3s</option>
              <option value={5000}>5s</option>
              <option value={0}>Paused</option>
            </select>
          </div>

          <Button
            size="sm"
            variant="outline"
            icon={RefreshCw}
            onClick={() => fetchLiveData(true)}
            title="Refresh now"
          >
            Refresh
          </Button>

          {activeSession ? (
            <Button
              size="sm"
              variant="danger"
              icon={Square}
              onClick={() => setIsEndModalOpen(true)}
            >
              End Session
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              icon={Play}
              onClick={() => setIsStartModalOpen(true)}
            >
              Start Session
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorAlert title="Live Feed Synchronization" message={error} />}

      {/* Main Grid: Camera/Video Card & Side Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera / AI Video Workspace (2 Columns) */}
        <div className="lg:col-span-2 space-y-4">
          <Card
            title="Classroom Camera Feed"
            subtitle="Real-time YOLO Bounding Boxes & InsightFace Identification"
            action={
              <div className="flex items-center gap-2">
                {activeSession && trackerStatus === 'RUNNING' && (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={Square}
                    loading={trackerLoading}
                    onClick={handleStopTracker}
                    title="Stop AI tracking pipeline"
                  >
                    Stop Tracker
                  </Button>
                )}
                {activeSession && (trackerStatus === 'STOPPED' || trackerStatus === 'FAILED' || trackerStatus === 'IDLE') && (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={Play}
                    loading={trackerLoading}
                    onClick={handleStartTracker}
                    title="Start AI tracking pipeline"
                  >
                    Start AI Tracker
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={browserCameraActive ? 'danger' : 'outline'}
                  icon={browserCameraActive ? VideoOff : Video}
                  onClick={toggleBrowserCamera}
                >
                  {browserCameraActive ? 'Stop Webcam' : 'Browser Webcam'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Maximize2}
                  onClick={toggleFullscreen}
                  title="Fullscreen"
                />
              </div>
            }
            bodyClassName="p-0"
          >
            {/* Visualizer Area */}
            <div
              ref={videoContainerRef}
              className="relative bg-slate-950 aspect-video rounded-b-xl overflow-hidden flex flex-col justify-between p-4 sm:p-5 text-white border-t border-slate-800"
            >
              {/* TOP STREAM HUD OVERLAY */}
              <div className="flex items-center justify-between text-xs z-20">
                <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 font-mono">
                  <Camera className="h-4 w-4 text-emerald-400" />
                  <span>CAM-01</span>
                  <span className="text-slate-500">|</span>
                  {aiStreamActive ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      AI STREAM LIVE {trackerPid ? `(PID: ${trackerPid})` : ''}
                    </span>
                  ) : trackerStatus === 'STARTING' ? (
                    <span className="text-indigo-400 font-bold flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                      STARTING AI PIPELINE...
                    </span>
                  ) : trackerStatus === 'FAILED' ? (
                    <span className="text-rose-400 font-bold flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-400" />
                      TRACKER ERROR
                    </span>
                  ) : browserCameraActive ? (
                    <span className="text-blue-400 font-bold flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                      BROWSER WEBCAM
                    </span>
                  ) : (
                    <span className="text-amber-400 font-semibold">STREAM STANDBY</span>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 font-mono text-[11px]">
                  <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                  <span>YOLOv11 + InsightFace (0.45)</span>
                  {trackerLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowLogModal(true)}
                      className="ml-1 text-slate-400 hover:text-white underline text-[10px]"
                    >
                      Logs
                    </button>
                  )}
                </div>
              </div>

              {/* VIDEO FEED RENDERING */}
              {aiStreamActive ? (
                /* LIVE AI ANNOTATED MJPEG STREAM */
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                  <img
                    src={streamVideoUrl}
                    alt="Classroom AI Tracking Feed"
                    className="w-full h-full object-contain"
                    onError={() => setAiStreamActive(false)}
                  />
                </div>
              ) : trackerStatus === 'STARTING' ? (
                /* LAUNCHING PIPELINE SPINNER */
                <div className="max-w-md mx-auto my-auto text-center z-10 bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-indigo-500/30 shadow-2xl">
                  <div className="h-12 w-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                  <h4 className="text-base font-bold text-white tracking-tight">
                    Launching AI Camera Pipeline
                  </h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Automatically starting YOLO person tracker, InsightFace recognition model, and camera capture...
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-2 text-xs text-indigo-300 font-mono">
                    <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                    Initializing neural models &amp; camera index 0...
                  </div>
                  {trackerLogs.length > 0 && (
                    <div className="mt-3 text-[11px] text-slate-400 font-mono bg-black/50 p-2 rounded max-h-20 overflow-y-auto text-left">
                      {trackerLogs.slice(-2).map((l, i) => (
                        <div key={i} className="truncate">{l}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : trackerStatus === 'FAILED' ? (
                /* ERROR RECOVERY STATE */
                <div className="max-w-md mx-auto my-auto text-center z-10 bg-slate-900/95 backdrop-blur-md p-6 rounded-2xl border border-rose-500/30 shadow-2xl">
                  <div className="h-12 w-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <h4 className="text-base font-bold text-rose-300 tracking-tight">
                    AI Camera Tracker Failed
                  </h4>
                  <p className="text-xs text-rose-200 mt-2 leading-relaxed font-mono bg-rose-950/40 p-2.5 rounded-lg border border-rose-900/40 select-all">
                    {trackerError || 'Process exited unexpectedly or camera 0 was busy.'}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                    {activeSession && (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={Play}
                        loading={trackerLoading}
                        onClick={handleStartTracker}
                      >
                        Retry AI Tracker
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      icon={Video}
                      onClick={toggleBrowserCamera}
                    >
                      Use Browser Webcam
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowLogModal(true)}
                    >
                      View Logs
                    </Button>
                  </div>
                </div>
              ) : browserCameraActive ? (
                /* BROWSER WEBCAM STREAM */
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                  <video
                    ref={browserVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : activeSession ? (
                /* ACTIVE SESSION STANDBY */
                <div className="max-w-md mx-auto my-auto text-center z-10 bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-2xl">
                  <div className="h-12 w-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
                    <Camera className="h-6 w-6" />
                  </div>
                  <h4 className="text-base font-bold text-white tracking-tight">
                    Class Session Active — AI Tracker Standby
                  </h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Session #{activeSession.id} ({activeSession.subject || 'Class'}) is active.
                    Click below to start automated camera tracking and face recognition.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      icon={Play}
                      loading={trackerLoading}
                      onClick={handleStartTracker}
                    >
                      Start AI Camera Tracker
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={Video}
                      onClick={toggleBrowserCamera}
                    >
                      Browser Webcam
                    </Button>
                  </div>
                </div>
              ) : (
                /* NO ACTIVE SESSION */
                <div className="max-w-md mx-auto my-auto text-center z-10 bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-2xl">
                  <div className="h-12 w-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3 border border-slate-700">
                    <VideoOff className="h-6 w-6" />
                  </div>
                  <h4 className="text-base font-bold text-white tracking-tight">
                    No Active Class Session
                  </h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Start a classroom session above to begin automatic AI camera tracking, face recognition, and real-time attendance recording.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      icon={Play}
                      onClick={() => setIsStartModalOpen(true)}
                    >
                      Start Class Session
                    </Button>
                  </div>
                </div>
              )}

              {/* BOTTOM STATUS BAR */}
              <div className="flex items-center justify-between text-xs font-mono text-slate-300 z-20">
                <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1 rounded-md border border-slate-800 text-[11px]">
                  <span className="text-slate-400">Tracked in Session:</span>
                  <span className="font-bold text-emerald-400">
                    {sessionAttendance.length} students
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-900/85 backdrop-blur-md px-3 py-1 rounded-md border border-slate-800">
                  {aiStreamActive
                    ? 'Transmitting from Python AI'
                    : browserCameraActive
                    ? 'Local Video Stream'
                    : 'Awaiting feed'}
                </div>
              </div>

              {/* Background decorative grid */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)',
                  backgroundSize: '24px 24px',
                }}
              />
            </div>
          </Card>

          {/* Behavior / Phone Detection alerts */}
          <Card
            title="Real-Time Behavior & Phone Detection"
            subtitle="Distractions detected via YOLO COCO Class 67 (cell phone)"
            bodyClassName="p-0"
          >
            {sessionBehavior.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-semibold text-slate-700">No active behavior infractions</p>
                <p className="text-slate-400 mt-0.5">
                  Cell phone detections (&gt;5s continuous) will trigger alerts here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sessionBehavior.map((event) => (
                  <div
                    key={event.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <PhoneCall className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 font-mono">
                            {event.student_id}
                          </span>
                          <Badge variant={event.severity} size="sm">
                            {event.behavior}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Detected for {formatSecondsToMinutes(event.duration_seconds)} •{' '}
                          {formatDateTime(event.start_time)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={event.status === 'ACTIVE' ? 'WARNING' : 'DEFAULT'}
                      size="sm"
                    >
                      {event.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Live Attendance Panel (Right Column) */}
        <div className="space-y-4">
          <Card
            title="Session Attendance"
            subtitle={`${sessionAttendance.length} student records`}
            action={
              <span className="text-xs font-semibold text-emerald-600">
                {presentCount} Present
              </span>
            }
            bodyClassName="p-0"
          >
            {sessionAttendance.length === 0 ? (
              <div className="p-6 text-center">
                <EmptyState
                  icon={Users}
                  title="No students detected yet"
                  description="When students are recognized in the camera frame, their attendance will populate here."
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {sessionAttendance.map((record) => {
                  const student = students.find((s) => s.student_id === record.student_id);
                  const isPresent = record.status === 'PRESENT';

                  return (
                    <div
                      key={record.id}
                      className="p-3.5 hover:bg-slate-50/60 transition-colors text-xs"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <span className="font-semibold text-slate-900 block font-mono">
                            {record.student_id}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {student?.name || 'Enrolled Student'}
                          </span>
                        </div>
                        <Badge
                          variant={record.status}
                          dot={isPresent}
                          size="sm"
                        >
                          {record.status}
                        </Badge>
                      </div>

                      {/* Progress bar towards 70% attendance */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                          <span>
                            Time: {formatSecondsToMinutes(record.presence_seconds)}
                          </span>
                          <span>
                            {formatPercentage(record.presence_percentage, 0)} (Req: 70%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              isPresent ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{
                              width: `${Math.min(100, record.presence_percentage)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Quick Info Box on InsightFace Recognition */}
          <Card title="Face Recognition Engine">
            <div className="text-xs text-slate-600 space-y-2.5">
              <p>
                Student identification uses <strong>InsightFace</strong> with 512-dimensional facial embedding vectors stored in PostgreSQL via the <code className="text-indigo-600 font-mono">pgvector</code> extension.
              </p>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cosine Threshold:</span>
                  <span className="font-mono font-semibold text-slate-800">0.45</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Presence Threshold:</span>
                  <span className="font-mono font-semibold text-slate-800">70% duration</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cell Phone Grace:</span>
                  <span className="font-mono font-semibold text-slate-800">1.5 seconds</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Start Session Modal */}
      <Modal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        title="Start New Class Session"
        subtitle="Initialize camera tracking and attendance accumulation"
      >
        <form onSubmit={handleStartSession} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Subject / Course Name
            </label>
            <input
              type="text"
              required
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="e.g. Computer Vision & Machine Learning"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Class Duration (Minutes)
            </label>
            <input
              type="number"
              min="1"
              max="360"
              required
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Default is 50 minutes. Students must be present for at least 70% of this duration to be marked PRESENT.
            </p>
          </div>

          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
            <strong>Attendance Rule:</strong> The attendance threshold is fixed at 70% as required by academic policy.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsStartModalOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={actionLoading}
              icon={Play}
            >
              Start Session
            </Button>
          </div>
        </form>
      </Modal>

      {/* Tracker Diagnostics Logs Modal */}
      <Modal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        title="AI Tracker Diagnostics Logs"
        subtitle="Real-time console output from python identity_tracking_test.py"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span>Status: <strong className="text-slate-800 font-mono">{trackerStatus}</strong></span>
            {trackerPid && <span>PID: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">{trackerPid}</code></span>}
          </div>
          {trackerError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-mono">
              <strong>Error:</strong> {trackerError}
            </div>
          )}
          <div className="p-3 bg-slate-950 text-emerald-400 rounded-xl font-mono text-[11px] max-h-80 overflow-y-auto space-y-1">
            {trackerLogs.length === 0 ? (
              <p className="text-slate-500 italic">No logs recorded yet.</p>
            ) : (
              trackerLogs.map((log, idx) => (
                <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                  {log}
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button size="sm" variant="outline" onClick={() => setShowLogModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* End Session Confirmation Modal */}
      <Modal
        isOpen={isEndModalOpen}
        onClose={() => setIsEndModalOpen(false)}
        title="End Current Class Session"
        subtitle="Finalize attendance calculation"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to end active class session{' '}
            <strong className="text-slate-900 font-mono">
              #{activeSession?.id} ({activeSession?.subject || 'Class'})
            </strong>
            ? This will finalize all attendance percentages and mark the session as COMPLETED.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsEndModalOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleEndSession}
              loading={actionLoading}
              icon={Square}
            >
              Confirm End Session
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
