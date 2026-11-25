import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  Search,
  Plus,
  Mail,
  UserCheck,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  BarChart2,
  PhoneCall,
  Shield,
  X,
  RefreshCw,
  Camera,
  CameraOff,
  CheckCircle2,
  RotateCcw,
  Video,
  Layers,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  getStudents,
  createStudent,
  enrollStudent,
  detectFace,
} from '../api/students';
import { getStudentAnalytics } from '../api/analytics';
import { getStudentAttendance } from '../api/attendance';
import { getStudentBehavior } from '../api/behavior';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorAlert from '../components/ui/ErrorAlert';
import EmptyState from '../components/ui/EmptyState';
import {
  formatSecondsToMinutes,
  formatPercentage,
  formatDateTime,
} from '../utils/formatters';

export default function StudentsPage() {
  const { isDemoMode, demoState, activeSession, addToast } = useApp();
  const {
    currentUser,
    isPrincipal,
    activeTeacherId,
    selectedTeacherFilter,
  } = useAuth();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'student_id'

  // Enrollment Modal & Camera State
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [enrollForm, setEnrollForm] = useState({
    student_id: '',
    name: '',
    email: '',
    overwrite: false,
  });
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollError, setEnrollError] = useState(null);
  const [enrollSuccess, setEnrollSuccess] = useState(null);

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [capturedImages, setCapturedImages] = useState([]); // Array of base64 data URLs
  const [captureMode, setCaptureMode] = useState('single'); // 'single' | 'multi'
  const [isCapturingBurst, setIsCapturingBurst] = useState(false);
  const [burstCount, setBurstCount] = useState(0);

  // Live Face Probe (pre-check)
  const [faceProbe, setFaceProbe] = useState(null); // { face_detected, face_count, det_score, message }
  const [isProbing, setIsProbing] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const probeTimerRef = useRef(null);

  // Student Detail Modal/Drawer
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [studentAnalytics, setStudentAnalytics] = useState(null);
  const [studentAttendance, setStudentAttendance] = useState([]);
  const [studentBehavior, setStudentBehavior] = useState([]);

  // Fetch Students
  const loadStudents = async () => {
    setLoading(true);
    setError(null);

    if (isDemoMode) {
      let list = demoState.students;
      if (activeTeacherId) {
        list = list.filter((s) => !s.teacher_id || s.teacher_id === activeTeacherId || true);
      }
      setStudents(list);
      setLoading(false);
      return;
    }

    try {
      const data = await getStudents(activeTeacherId);
      setStudents(data);
    } catch (err) {
      setError(err.userMessage || 'Could not fetch student records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [isDemoMode, activeTeacherId]);

  // ============================================================
  // CAMERA LIFECYCLE MANAGEMENT
  // ============================================================

  const stopCamera = useCallback(() => {
    if (probeTimerRef.current) {
      clearInterval(probeTimerRef.current);
      probeTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setFaceProbe(null);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setCameraLoading(true);

    try {
      const constraints = {
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: 'user',
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setIsCameraActive(true);
      setCameraError(null);
    } catch (err) {
      console.error('Camera initialization error:', err);
      let userMsg;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        userMsg =
          'Camera permission was denied. Please allow camera access in your browser address bar to enroll face biometrics.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        userMsg = 'No camera device was detected on your computer.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        userMsg =
          'Camera hardware is in use by another program. If a live classroom session is running on this device, please stop it first.';
      } else {
        userMsg = `Could not access camera (${err.name || 'Error'}): ${err.message || 'Unknown'}`;
      }
      setCameraError(userMsg);
      setIsCameraActive(false);
    } finally {
      setCameraLoading(false);
    }
  }, [stopCamera]);

  // Real-time Face Probe (runs every 1.8s when live preview is running)
  const probeCurrentFrame = useCallback(async () => {
    if (
      !isCameraActive ||
      !videoRef.current ||
      capturedImages.length > 0 ||
      isCapturingBurst ||
      isProbing
    ) {
      return;
    }

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    try {
      setIsProbing(true);
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.65);

      const res = await detectFace(dataUrl);
      setFaceProbe(res);
    } catch {
      // Ignore background probe errors
    } finally {
      setIsProbing(false);
    }
  }, [isCameraActive, capturedImages.length, isCapturingBurst, isProbing]);

  useEffect(() => {
    if (isCameraActive && capturedImages.length === 0 && !isDemoMode) {
      probeTimerRef.current = setInterval(probeCurrentFrame, 1800);
    } else {
      if (probeTimerRef.current) {
        clearInterval(probeTimerRef.current);
        probeTimerRef.current = null;
      }
    }
    return () => {
      if (probeTimerRef.current) {
        clearInterval(probeTimerRef.current);
      }
    };
  }, [isCameraActive, capturedImages.length, isDemoMode, probeCurrentFrame]);

  // Cleanup camera when modal closes or component unmounts
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Open Enrollment Modal
  const handleOpenEnrollModal = (prefillStudent = null) => {
    setEnrollError(null);
    setEnrollSuccess(null);
    setCapturedImages([]);
    setBurstCount(0);
    setFaceProbe(null);

    if (prefillStudent) {
      setEnrollForm({
        student_id: prefillStudent.student_id,
        name: prefillStudent.name,
        email: prefillStudent.email || '',
        overwrite: true,
      });
    } else {
      setEnrollForm({
        student_id: '',
        name: '',
        email: '',
        overwrite: false,
      });
    }

    setIsEnrollOpen(true);
    // Give modal DOM a tick to mount video element before starting stream
    setTimeout(() => {
      startCamera();
    }, 150);
  };

  const handleCloseEnrollModal = () => {
    stopCamera();
    setIsEnrollOpen(false);
    setCapturedImages([]);
    setEnrollError(null);
    setEnrollSuccess(null);
  };

  // Capture Single Frame
  const captureFrameFromVideo = () => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.95);
  };

  const handleSingleCapture = () => {
    const dataUrl = captureFrameFromVideo();
    if (!dataUrl) {
      setEnrollError('Could not capture frame from video.');
      return;
    }
    setCapturedImages([dataUrl]);
    stopCamera();
  };

  // Capture Multi-Sample Burst (3 samples with 400ms delay)
  const handleBurstCapture = async () => {
    setIsCapturingBurst(true);
    setBurstCount(0);
    const samples = [];

    for (let i = 1; i <= 3; i++) {
      setBurstCount(i);
      const dataUrl = captureFrameFromVideo();
      if (dataUrl) samples.push(dataUrl);
      if (i < 3) {
        await new Promise((r) => setTimeout(r, 450));
      }
    }

    setIsCapturingBurst(false);
    setCapturedImages(samples);
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedImages([]);
    setEnrollError(null);
    setBurstCount(0);
    startCamera();
  };

  // Submit Enrollment
  const handleEnrollSubmit = async (e) => {
    e.preventDefault();
    setEnrollError(null);
    setEnrollLoading(true);

    const studentIdClean = enrollForm.student_id.trim();
    const nameClean = enrollForm.name.trim();

    if (!studentIdClean || !nameClean) {
      setEnrollError('Student ID and Student Name are required.');
      setEnrollLoading(false);
      return;
    }

    if (capturedImages.length === 0) {
      setEnrollError('Please capture your face photo using the camera before enrolling.');
      setEnrollLoading(false);
      return;
    }

    // Demo Mode handling
    if (isDemoMode) {
      const exists = demoState.students.some((s) => s.student_id === studentIdClean);
      if (exists && !enrollForm.overwrite) {
        setEnrollError(
          `Student ID ${studentIdClean} is already registered. Check "Overwrite existing biometric record" to replace.`
        );
        setEnrollLoading(false);
        return;
      }

      const updated = demoState.students.filter((s) => s.student_id !== studentIdClean);
      const newEntry = {
        id: Date.now(),
        student_id: studentIdClean,
        name: nameClean,
        email: enrollForm.email.trim() || null,
        has_embedding: true,
      };

      demoState.setStudents([...updated, newEntry]);
      setStudents([...updated, newEntry]);

      setEnrollSuccess({
        student_id: studentIdClean,
        name: nameClean,
        embedding_dimension: 512,
        det_score: 0.965,
        samples_processed: capturedImages.length,
        message: `Student ${nameClean} (${studentIdClean}) enrolled in demo database with simulated 512-d vector.`,
      });

      addToast('success', 'Student Enrolled', `${nameClean} (${studentIdClean}) biometric registration completed.`);
      setEnrollLoading(false);
      return;
    }

    // Real Backend API Submission
    try {
      const payload = {
        student_id: studentIdClean,
        name: nameClean,
        email: enrollForm.email.trim() || null,
        image: capturedImages.length === 1 ? capturedImages[0] : null,
        images: capturedImages.length > 1 ? capturedImages : null,
        overwrite: enrollForm.overwrite,
      };

      const result = await enrollStudent(payload);

      setEnrollSuccess(result);
      addToast(
        'success',
        'Biometrics Registered',
        `${result.name} (${result.student_id}) enrolled with 512-d InsightFace embedding.`
      );

      // Refresh list in background
      loadStudents();
    } catch (err) {
      console.error('Enrollment submission failed:', err);
      const detailMsg = err.response?.data?.detail || err.userMessage || err.message;
      setEnrollError(detailMsg);
    } finally {
      setEnrollLoading(false);
    }
  };

  // Open Student Details
  const handleOpenDetails = async (student) => {
    setSelectedStudent(student);
    setDetailLoading(true);

    if (isDemoMode) {
      const studentAtt = demoState.attendance.filter(
        (a) => a.student_id === student.student_id
      );
      const studentBeh = demoState.behavior.filter(
        (b) => b.student_id === student.student_id
      );
      const presentCount = studentAtt.filter((a) => a.status === 'PRESENT').length;
      const totalSessions = demoState.sessions.length;
      const rate = totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0;

      setStudentAnalytics({
        student_id: student.student_id,
        student_name: student.name,
        total_sessions: totalSessions,
        present_sessions: presentCount,
        absent_sessions: Math.max(0, totalSessions - presentCount),
        attendance_percentage: rate,
        total_behavior_events: studentBeh.length,
      });
      setStudentAttendance(studentAtt);
      setStudentBehavior(studentBeh);
      setDetailLoading(false);
      return;
    }

    try {
      const [analyticsData, attendanceData, behaviorData] = await Promise.all([
        getStudentAnalytics(student.student_id).catch(() => null),
        getStudentAttendance(student.student_id).catch(() => []),
        getStudentBehavior(student.student_id).catch(() => []),
      ]);

      setStudentAnalytics(analyticsData);
      setStudentAttendance(attendanceData);
      setStudentBehavior(behaviorData);
    } catch {
      setStudentAnalytics(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Filtered & Sorted list
  const filteredStudents = students
    .filter((s) => {
      const query = searchQuery.toLowerCase();
      return (
        s.student_id.toLowerCase().includes(query) ||
        s.name.toLowerCase().includes(query) ||
        (s.email && s.email.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'student_id') {
        return a.student_id.localeCompare(b.student_id);
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Enrolled Student Biometrics &amp; Records
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Synchronized directly with 512-dimensional facial embeddings in PostgreSQL (pgvector)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={RefreshCw}
            onClick={loadStudents}
            title="Refresh student list"
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={Camera}
            onClick={() => handleOpenEnrollModal()}
            title="Enroll a student via browser camera"
          >
            Enroll Student
          </Button>
        </div>
      </div>

      {/* Info Notice about Biometrics Pipeline */}
      <div className="bg-indigo-50/70 rounded-xl border border-indigo-100 p-4 text-xs text-indigo-950 flex items-start gap-3 shadow-xs">
        <Shield className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-indigo-900 block mb-0.5">
            Automated Browser Camera Enrollment Pipeline
          </span>
          <p className="text-indigo-800 leading-relaxed">
            Clicking <strong>Enroll Student</strong> activates your webcam in the browser, captures face frames,
            and transmits them to FastAPI. The backend runs <strong>InsightFace (buffalo_l)</strong> to generate
            a unit-normalized <strong>512-d vector</strong> stored directly in PostgreSQL with pgvector.
            No PyCharm or offline scripts are required.
          </p>
        </div>
      </div>

      {error && <ErrorAlert title="Students Error" message={error} onRetry={loadStudents} />}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-500">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 outline-none cursor-pointer"
          >
            <option value="name">Student Name (A-Z)</option>
            <option value="student_id">Student ID</option>
          </select>
        </div>
      </div>

      {/* Students Table */}
      <Card bodyClassName="p-0">
        {loading ? (
          <LoadingSpinner message="Fetching enrolled students & biometric statuses..." />
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            icon={Users}
            title={searchQuery ? 'No matching students found' : 'No students enrolled'}
            description={
              searchQuery
                ? `No student matching "${searchQuery}" was found.`
                : 'Click Enroll Student to register a new student with live facial biometrics.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Student Name</th>
                  <th className="px-5 py-3">Student ID</th>
                  <th className="px-5 py-3">Email Address</th>
                  <th className="px-5 py-3">Biometrics Status</th>
                  <th className="px-5 py-3">Record</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredStudents.map((student) => (
                  <tr
                    key={student.id || student.student_id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white font-semibold flex items-center justify-center text-xs shrink-0 shadow-xs">
                          {student.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 block">
                            {student.name}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Classroom Student
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-900 font-medium">
                      {student.student_id}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {student.email || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {student.has_embedding ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          512-d Enrolled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertCircle className="h-3 w-3 text-amber-600" />
                          Pending Face Biometrics
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant="ONLINE" size="sm">
                        Active
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => handleOpenDetails(student)}
                        >
                          Details
                        </Button>
                        <Button
                          size="xs"
                          variant={student.has_embedding ? 'outline' : 'primary'}
                          icon={Camera}
                          onClick={() => handleOpenEnrollModal(student)}
                          title="Capture and register face embedding"
                        >
                          {student.has_embedding ? 'Re-enroll' : 'Enroll Face'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ============================================================ */}
      {/* CAMERA BIOMETRIC ENROLLMENT MODAL */}
      {/* ============================================================ */}
      <Modal
        isOpen={isEnrollOpen}
        onClose={handleCloseEnrollModal}
        title="Student Biometric Face Enrollment"
        subtitle="Capture facial photo with browser webcam & extract 512-d InsightFace embedding"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {/* Active Session Hardware Warning */}
          {activeSession && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Class Session #{activeSession.id} is currently active.</strong>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  If this computer is sharing webcam CAM-01 with the live tracker, the browser camera may report
                  &quot;Device in use&quot;. If camera fails to open, pause the active class session first.
                </p>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {enrollSuccess ? (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-emerald-950">
                  Biometric Enrollment Successful!
                </h4>
                <p className="text-xs text-emerald-800 mt-1">
                  <strong>{enrollSuccess.name}</strong> ({enrollSuccess.student_id}) has been registered with a{' '}
                  <strong>{enrollSuccess.embedding_dimension}-dimensional</strong> InsightFace facial vector.
                </p>
                {enrollSuccess.det_score && (
                  <p className="text-[11px] text-emerald-700 font-mono mt-1">
                    Face Detection Confidence: {Math.round(enrollSuccess.det_score * 100)}% • Samples:{' '}
                    {enrollSuccess.samples_processed}
                  </p>
                )}
              </div>
              <div className="pt-2 flex justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEnrollSuccess(null);
                    setCapturedImages([]);
                    setEnrollForm({ student_id: '', name: '', email: '', overwrite: false });
                    startCamera();
                  }}
                >
                  Enroll Another Student
                </Button>
                <Button size="sm" variant="primary" onClick={handleCloseEnrollModal}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleEnrollSubmit} className="space-y-4">
              {enrollError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">{enrollError}</p>
                    {enrollError.includes('already enrolled') && (
                      <label className="flex items-center gap-2 text-xs text-rose-900 cursor-pointer pt-1 font-medium">
                        <input
                          type="checkbox"
                          checked={enrollForm.overwrite}
                          onChange={(e) =>
                            setEnrollForm({ ...enrollForm, overwrite: e.target.checked })
                          }
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Overwrite and update existing biometric embedding</span>
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Student Metadata Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Student ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2300033018"
                    value={enrollForm.student_id}
                    onChange={(e) =>
                      setEnrollForm({ ...enrollForm, student_id: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dinesh Karthik"
                    value={enrollForm.name}
                    onChange={(e) =>
                      setEnrollForm({ ...enrollForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g. student@smartclassroom.edu"
                  value={enrollForm.email}
                  onChange={(e) =>
                    setEnrollForm({ ...enrollForm, email: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* CAMERA CAPTURE VIEWPORT */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 uppercase tracking-wider">
                    Face Camera Capture
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Capture Mode:</span>
                    <button
                      type="button"
                      onClick={() => setCaptureMode('single')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        captureMode === 'single'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Single Shot
                    </button>
                    <button
                      type="button"
                      onClick={() => setCaptureMode('multi')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        captureMode === 'multi'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      3-Sample Burst
                    </button>
                  </div>
                </div>

                <div className="relative bg-slate-950 aspect-video rounded-xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
                  {/* Live Video Element */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${
                      capturedImages.length > 0 ? 'hidden' : 'block'
                    }`}
                  />

                  {/* Captured Photo Preview */}
                  {capturedImages.length > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black">
                      {capturedImages.length === 1 ? (
                        <img
                          src={capturedImages[0]}
                          alt="Captured Face"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="grid grid-cols-3 gap-2 p-3 w-full h-full items-center">
                          {capturedImages.map((imgSrc, idx) => (
                            <div
                              key={idx}
                              className="relative aspect-4/3 rounded-lg overflow-hidden border border-indigo-400/60 shadow"
                            >
                              <img
                                src={imgSrc}
                                alt={`Sample ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1 rounded font-mono">
                                #{idx + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Camera Error / Standby Overlay */}
                  {!isCameraActive && capturedImages.length === 0 && (
                    <div className="p-6 text-center max-w-sm">
                      {cameraLoading ? (
                        <div className="space-y-2 text-indigo-400">
                          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
                          <p className="text-xs text-white">Opening browser camera...</p>
                        </div>
                      ) : (
                        <div className="space-y-2 text-slate-400">
                          <CameraOff className="h-8 w-8 mx-auto text-slate-500" />
                          <p className="text-xs text-slate-300">
                            {cameraError || 'Camera is not active.'}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            icon={Video}
                            onClick={startCamera}
                          >
                            Activate Camera
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Face Guide Target Overlay (only when live camera is on) */}
                  {isCameraActive && capturedImages.length === 0 && (
                    <>
                      {/* Center Oval Face Guide */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div
                          className={`w-44 h-56 rounded-[50%] border-2 border-dashed transition-colors duration-300 ${
                            faceProbe?.face_detected
                              ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)]'
                              : 'border-white/40'
                          }`}
                        />
                      </div>

                      {/* Top HUD Badge: Live Detection Status */}
                      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                        {faceProbe?.face_detected ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-600/60 backdrop-blur-md">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                            Face Detected ({Math.round((faceProbe.det_score || 0.9) * 100)}%)
                          </span>
                        ) : faceProbe?.face_count > 1 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-rose-950/80 text-rose-300 border border-rose-600/60 backdrop-blur-md">
                            <AlertCircle className="h-3 w-3 text-rose-400" />
                            Multiple Faces ({faceProbe.face_count})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono text-slate-300 bg-slate-900/80 border border-slate-700/60 backdrop-blur-md">
                            <Camera className="h-3 w-3 text-indigo-400" />
                            Align Face in Center
                          </span>
                        )}
                      </div>

                      {/* Burst Countdown Indicator */}
                      {isCapturingBurst && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-xs">
                          <div className="text-center text-white">
                            <span className="text-4xl font-extrabold font-mono text-emerald-400">
                              {burstCount} / 3
                            </span>
                            <p className="text-xs text-slate-200 mt-1">
                              Capturing multi-angle samples...
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Captured Success Stamp */}
                  {capturedImages.length > 0 && (
                    <div className="absolute top-3 left-3 z-10">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-900/85 text-emerald-300 border border-emerald-700 backdrop-blur-md">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        {capturedImages.length === 1
                          ? 'Photo Captured'
                          : `${capturedImages.length} Samples Captured`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Instructions & Capture Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 text-xs text-slate-500">
                  <p className="text-[11px] text-slate-500">
                    {capturedImages.length > 0
                      ? 'Review photo above before submitting biometrics.'
                      : 'Position your face inside the dashed oval in good lighting.'}
                  </p>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {capturedImages.length > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        icon={RotateCcw}
                        onClick={handleRetake}
                      >
                        Retake Photo
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        icon={Camera}
                        disabled={!isCameraActive || isCapturingBurst}
                        onClick={captureMode === 'multi' ? handleBurstCapture : handleSingleCapture}
                      >
                        {captureMode === 'multi' ? 'Start 3-Sample Burst' : 'Capture Photo'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Overwrite Checkbox (if manual) */}
              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enrollForm.overwrite}
                    onChange={(e) =>
                      setEnrollForm({ ...enrollForm, overwrite: e.target.checked })
                    }
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Overwrite existing embedding if student ID already exists</span>
                </label>
              </div>

              {/* Bottom Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseEnrollModal}
                  disabled={enrollLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={enrollLoading}
                  disabled={capturedImages.length === 0}
                  icon={UserCheck}
                >
                  {enrollLoading ? 'Extracting Embedding...' : 'Register & Save Biometrics'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* ============================================================ */}
      {/* STUDENT DETAIL MODAL / DRAWER */}
      {/* ============================================================ */}
      <Modal
        isOpen={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        title={selectedStudent?.name || 'Student Details'}
        subtitle={`Student ID: ${selectedStudent?.student_id}`}
      >
        {selectedStudent && (
          <div className="space-y-4">
            {detailLoading ? (
              <LoadingSpinner message="Loading academic analytics..." />
            ) : (
              <>
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block">
                      Total Sessions
                    </span>
                    <span className="text-xl font-bold text-slate-900 mt-1 block">
                      {studentAnalytics?.total_sessions ?? '—'}
                    </span>
                  </div>

                  <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-center">
                    <span className="text-[11px] text-emerald-700 uppercase tracking-wider font-semibold block">
                      Present
                    </span>
                    <span className="text-xl font-bold text-emerald-800 mt-1 block">
                      {studentAnalytics?.present_sessions ?? '—'}
                    </span>
                  </div>

                  <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200 text-center">
                    <span className="text-[11px] text-indigo-700 uppercase tracking-wider font-semibold block">
                      Attendance Rate
                    </span>
                    <span className="text-xl font-bold text-indigo-800 mt-1 block">
                      {studentAnalytics
                        ? formatPercentage(studentAnalytics.attendance_percentage)
                        : '—'}
                    </span>
                  </div>
                </div>

                {/* Biometrics Status */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 block">
                      InsightFace Biometrics
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      {selectedStudent.has_embedding
                        ? '512-dimensional vector enrolled in pgvector'
                        : 'No facial embedding registered yet'}
                    </span>
                  </div>
                  <Button
                    size="xs"
                    variant={selectedStudent.has_embedding ? 'outline' : 'primary'}
                    icon={Camera}
                    onClick={() => {
                      const st = selectedStudent;
                      setSelectedStudent(null);
                      handleOpenEnrollModal(st);
                    }}
                  >
                    {selectedStudent.has_embedding ? 'Re-enroll Face' : 'Enroll Face'}
                  </Button>
                </div>

                {/* Attendance History */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Attendance History
                  </h4>
                  {studentAttendance.length === 0 ? (
                    <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200">
                      No recorded session attendance for this student yet.
                    </p>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {studentAttendance.map((rec) => (
                        <div
                          key={rec.id}
                          className="px-3.5 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">
                              Session #{rec.session_id}
                            </span>
                            <span className="text-slate-400 ml-2">
                              {formatSecondsToMinutes(rec.presence_seconds)} (
                              {formatPercentage(rec.presence_percentage, 0)})
                            </span>
                          </div>
                          <Badge variant={rec.status} size="sm">
                            {rec.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Behavior Events */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Behavior Events ({studentBehavior.length})
                  </h4>
                  {studentBehavior.length === 0 ? (
                    <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200">
                      No behavior infractions logged for this student.
                    </p>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-36 overflow-y-auto">
                      {studentBehavior.map((bev) => (
                        <div
                          key={bev.id}
                          className="px-3.5 py-2 flex items-center justify-between text-xs hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-2">
                            <PhoneCall className="h-3.5 w-3.5 text-amber-500" />
                            <span className="font-medium text-slate-800">
                              {bev.behavior} ({formatSecondsToMinutes(bev.duration_seconds)})
                            </span>
                          </div>
                          <span className="text-slate-400 text-[11px]">
                            Session #{bev.session_id}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <Button variant="outline" onClick={() => setSelectedStudent(null)}>
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
