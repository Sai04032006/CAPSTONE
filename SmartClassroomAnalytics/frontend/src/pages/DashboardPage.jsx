import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Radio,
  CalendarDays,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Clock,
  ArrowRight,
  PlusCircle,
  Eye,
  ShieldCheck,
  AlertTriangle,
  GraduationCap,
  Activity,
  Shield,
  Layers,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { getStudents } from '../api/students';
import { getSessions } from '../api/sessions';
import { getSessionAttendance } from '../api/attendance';
import { getSessionAnalytics } from '../api/analytics';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorAlert from '../components/ui/ErrorAlert';
import EmptyState from '../components/ui/EmptyState';
import AttendanceChart from '../components/charts/AttendanceChart';
import {
  formatSecondsToMinutes,
  formatPercentage,
  formatDateTime,
  formatDateShort,
} from '../utils/formatters';

export default function DashboardPage() {
  const { isDemoMode, demoState, activeSession, backendStatus } = useApp();
  const {
    currentUser,
    isPrincipal,
    isTeacher,
    activeTeacherId,
    selectedTeacherFilter,
    setSelectedTeacherFilter,
    teachersList,
  } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [latestAttendance, setLatestAttendance] = useState([]);
  const [sessionAnalytics, setSessionAnalytics] = useState(null);
  const [chartData, setChartData] = useState([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    if (isDemoMode) {
      // Filter demo sessions and students if teacher or filtered
      let demoSessions = demoState.sessions;
      let demoStudents = demoState.students;

      if (activeTeacherId) {
        demoSessions = demoSessions.filter(
          (s) => !s.teacher_id || s.teacher_id === activeTeacherId
        );
      }

      const latest = demoSessions[0];
      const att = latest
        ? demoState.attendance.filter((a) => a.session_id === latest.id)
        : [];

      setStudents(demoStudents);
      setSessions(demoSessions);
      setLatestAttendance(att);

      // Compute analytics
      const presentCount = att.filter((a) => a.status === 'PRESENT').length;
      const absentCount = demoStudents.length - presentCount;
      const rate = demoStudents.length > 0 ? (presentCount / demoStudents.length) * 100 : 0;

      setSessionAnalytics({
        total_students: demoStudents.length,
        present_students: presentCount,
        absent_students: absentCount,
        attendance_percentage: rate,
      });

      // Prepare chart data across sessions
      const chart = demoSessions.map((s) => {
        const sAtt = demoState.attendance.filter((a) => a.session_id === s.id);
        const pres = sAtt.filter((a) => a.status === 'PRESENT').length;
        const abs = Math.max(0, demoStudents.length - pres);
        return {
          name: s.subject ? s.subject.substring(0, 14) : `Session #${s.id}`,
          present: pres,
          absent: abs,
        };
      });
      setChartData(chart);
      setLoading(false);
      return;
    }

    try {
      // Real API calls with activeTeacherId scoping
      const [studentsData, sessionsData] = await Promise.all([
        getStudents(activeTeacherId),
        getSessions(activeTeacherId),
      ]);

      setStudents(studentsData);
      setSessions(sessionsData);

      const latest = sessionsData[0];
      if (latest) {
        try {
          const [attData, analyticsData] = await Promise.all([
            getSessionAttendance(latest.id),
            getSessionAnalytics(latest.id),
          ]);
          setLatestAttendance(attData);
          setSessionAnalytics(analyticsData);
        } catch {
          const attData = await getSessionAttendance(latest.id).catch(() => []);
          setLatestAttendance(attData);
          const pres = attData.filter((a) => a.status === 'PRESENT').length;
          setSessionAnalytics({
            total_students: studentsData.length,
            present_students: pres,
            absent_students: Math.max(0, studentsData.length - pres),
            attendance_percentage: studentsData.length ? (pres / studentsData.length) * 100 : 0,
          });
        }
      }

      // Generate chart for recent sessions
      const recent = sessionsData.slice(0, 5).reverse();
      const chartPromises = recent.map(async (s) => {
        try {
          const sAtt = await getSessionAttendance(s.id);
          const pres = sAtt.filter((a) => a.status === 'PRESENT').length;
          const abs = Math.max(0, studentsData.length - pres);
          return {
            name: s.subject ? s.subject.substring(0, 14) : `Session #${s.id}`,
            present: pres,
            absent: abs,
          };
        } catch {
          return {
            name: `Session #${s.id}`,
            present: 0,
            absent: 0,
          };
        }
      });

      const resolvedChart = await Promise.all(chartPromises);
      setChartData(resolvedChart);
    } catch (err) {
      setError(err.userMessage || 'Could not fetch dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isDemoMode, activeTeacherId]);

  const latestSession = sessions[0] || null;

  return (
    <div className="space-y-6">
      {/* Role-Specific Header Banner */}
      {isPrincipal ? (
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200 text-xs font-semibold border border-purple-400/30 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-purple-300" />
                School Principal Dashboard (Global Admin)
              </span>
              {selectedTeacherFilter && (
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs font-mono">
                  Filtered: Teacher #{selectedTeacherFilter}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              {selectedTeacherFilter
                ? `Viewing Records for Teacher #${selectedTeacherFilter}`
                : 'School-Wide Real-Time Analytics Overview'}
            </h2>
            <p className="text-xs text-purple-200/80 mt-1 max-w-xl">
              {selectedTeacherFilter
                ? 'Inspecting individual teacher performance, student attendance rates, and active classroom monitoring.'
                : `Comprehensive oversight across all ${teachersList.length} faculty members, all enrolled students, and classroom sessions.`}
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Link to="/evaluation">
              <Button variant="secondary" className="!bg-purple-800/80 !text-white border-purple-700 text-xs">
                <Activity className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                Evaluation Metrics
              </Button>
            </Link>
            <Link to="/teachers">
              <Button variant="primary" className="!bg-purple-600 hover:!bg-purple-500 text-xs shadow-md">
                <Shield className="h-3.5 w-3.5 mr-1" />
                Faculty Directory
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-semibold border border-indigo-400/30 flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-indigo-300" />
                Teacher Portal • ID: #{currentUser?.teacher_id || '1001'}
              </span>
              <span className="text-xs text-slate-300">
                {currentUser?.subject || 'Classroom Teacher'}
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              Welcome back, {currentUser?.name || 'Teacher'}!
            </h2>
            <p className="text-xs text-slate-300/80 mt-1">
              Viewing your assigned classroom sessions, enrolled students, and verified attendance rates.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Link to="/evaluation">
              <Button variant="secondary" className="!bg-slate-800 !text-slate-200 border-slate-700 text-xs">
                <Activity className="h-3.5 w-3.5 mr-1 text-indigo-400" />
                Evaluation Metrics
              </Button>
            </Link>
            <Link to="/sessions">
              <Button variant="primary" className="text-xs shadow-md">
                <PlusCircle className="h-3.5 w-3.5 mr-1" />
                New Class Session
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Active Session Highlight Callout if session is running */}
      {activeSession && (
        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
              <Radio className="h-5 w-5 animate-pulse text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  Live Class in Session
                </span>
                <span className="text-xs text-slate-300 font-mono">
                  #{activeSession.id}
                </span>
              </div>
              <h3 className="text-lg font-bold mt-0.5 text-white">
                {activeSession.subject || 'Active Session'}
              </h3>
              <p className="text-xs text-slate-300">
                Started {formatDateTime(activeSession.started_at)} • Duration:{' '}
                {activeSession.duration_minutes} min • Threshold: 70%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/live">
              <Button size="sm" variant="success" icon={Radio}>
                Open Live Monitor
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <ErrorAlert
          title="Dashboard synchronization issue"
          message={error}
          onRetry={loadData}
        />
      )}

      {/* Top Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <Card className="border-l-4 border-l-indigo-500" bodyClassName="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Enrolled Students
            </span>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {loading ? '—' : students.length}
            </span>
            <span className="text-xs text-slate-500 font-normal">
              in database
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            5 enrolled in face embedding vector database
          </div>
        </Card>

        {/* Present Students */}
        <Card className="border-l-4 border-l-emerald-500" bodyClassName="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Present (Latest)
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">
              {loading
                ? '—'
                : sessionAnalytics
                ? sessionAnalytics.present_students
                : 0}
            </span>
            <span className="text-xs text-slate-500 font-normal">
              students attended
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Met 70% duration threshold
          </div>
        </Card>

        {/* Absent Students */}
        <Card className="border-l-4 border-l-rose-500" bodyClassName="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Absent (Latest)
            </span>
            <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-700">
              {loading
                ? '—'
                : sessionAnalytics
                ? sessionAnalytics.absent_students
                : 0}
            </span>
            <span className="text-xs text-slate-500 font-normal">
              below threshold
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {students.length > 0 && sessionAnalytics
              ? `${Math.round(
                  (sessionAnalytics.absent_students / students.length) * 100
                )}% absence rate`
              : 'No record'}
          </div>
        </Card>

        {/* Overall Attendance Rate */}
        <Card className="border-l-4 border-l-blue-500" bodyClassName="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Attendance Rate
            </span>
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {loading
                ? '—'
                : sessionAnalytics
                ? formatPercentage(sessionAnalytics.attendance_percentage)
                : '0%'}
            </span>
            <span className="text-xs text-slate-500 font-normal">
              for session {latestSession ? `#${latestSession.id}` : ''}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Authoritative backend calculation
          </div>
        </Card>
      </div>

      {/* Main Grid: Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart: Present vs Absent */}
        <div className="lg:col-span-2">
          <Card
            title="Class Attendance Trend"
            subtitle="Present vs Absent distribution across recent sessions"
            action={
              <Link to="/analytics">
                <Button size="sm" variant="ghost" icon={ArrowRight}>
                  Full Analytics
                </Button>
              </Link>
            }
          >
            {loading ? (
              <LoadingSpinner message="Calculating session statistics..." />
            ) : chartData.length > 0 ? (
              <AttendanceChart data={chartData} height={260} />
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="No session history yet"
                description="Start a class session and record student presence to view attendance trends."
              />
            )}
          </Card>
        </div>

        {/* Quick Operations & System Specs */}
        <div className="space-y-4">
          <Card title="Quick Actions">
            <div className="space-y-2">
              <Link to="/sessions" className="block">
                <div className="p-2.5 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-indigo-900">
                  <div className="flex items-center gap-2.5">
                    <CalendarDays className="h-4 w-4 text-indigo-600" />
                    <span>Create / Manage Sessions</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                </div>
              </Link>

              <Link to="/live" className="block">
                <div className="p-2.5 rounded-lg border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-emerald-900">
                  <div className="flex items-center gap-2.5">
                    <Radio className="h-4 w-4 text-emerald-600" />
                    <span>Live Classroom Monitoring</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                </div>
              </Link>

              <Link to="/students" className="block">
                <div className="p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900">
                  <div className="flex items-center gap-2.5">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span>Student Directory & Profiles</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                </div>
              </Link>

              <Link to="/attendance" className="block">
                <div className="p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-teal-600" />
                    <span>Attendance Records & CSV Export</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                </div>
              </Link>
            </div>
          </Card>

          {/* AI Pipeline Architecture Spec */}
          <Card title="AI Engine Specs">
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Person Tracking</span>
                <span className="font-semibold text-slate-800">YOLOv11 Nano</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Face Recognition</span>
                <span className="font-semibold text-slate-800">InsightFace (512-d)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Database Engine</span>
                <span className="font-semibold text-slate-800">PostgreSQL 18 + pgvector</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Attendance Rule</span>
                <span className="font-semibold text-indigo-700">Fixed 70% Duration</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Sessions Table & Latest Attendance Records */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sessions */}
        <Card
          title="Recent Class Sessions"
          subtitle="Latest recorded lectures and classes"
          action={
            <Link to="/sessions">
              <Button size="sm" variant="outline">
                All Sessions
              </Button>
            </Link>
          }
          bodyClassName="p-0"
        >
          {loading ? (
            <LoadingSpinner size="sm" />
          ) : sessions.length === 0 ? (
            <EmptyState
              title="No class sessions found"
              description="Create a new class session to start tracking classroom attendance."
            />
          ) : (
            <div className="divide-y divide-slate-100 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 text-slate-500 font-medium">
                  <tr>
                    <th className="px-4 py-2.5">ID / Subject</th>
                    <th className="px-4 py-2.5">Duration</th>
                    <th className="px-4 py-2.5">Started</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {sessions.slice(0, 5).map((session) => (
                    <tr key={session.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900 block">
                          {session.subject || 'Class Session'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: #{session.id}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {session.duration_minutes} min
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateShort(session.started_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={session.status}
                          dot={session.status === 'ACTIVE'}
                          size="sm"
                        >
                          {session.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Latest Attendance Records */}
        <Card
          title={`Session Attendance (${latestSession ? latestSession.subject || `#${latestSession.id}` : 'No session'})`}
          subtitle="Student presence calculated by AI engine"
          action={
            <Link to="/attendance">
              <Button size="sm" variant="outline">
                View Records
              </Button>
            </Link>
          }
          bodyClassName="p-0"
        >
          {loading ? (
            <LoadingSpinner size="sm" />
          ) : latestAttendance.length === 0 ? (
            <EmptyState
              title="No attendance records"
              description="No attendance logged for the latest session."
            />
          ) : (
            <div className="divide-y divide-slate-100 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 text-slate-500 font-medium">
                  <tr>
                    <th className="px-4 py-2.5">Student ID</th>
                    <th className="px-4 py-2.5">Duration</th>
                    <th className="px-4 py-2.5">Presence %</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {latestAttendance.slice(0, 5).map((record) => {
                    const student = students.find(
                      (s) => s.student_id === record.student_id
                    );
                    return (
                      <tr key={record.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-900 block font-mono">
                            {record.student_id}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {student?.name || 'Enrolled Student'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {formatSecondsToMinutes(record.presence_seconds)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${
                                  record.status === 'PRESENT'
                                    ? 'bg-emerald-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{
                                  width: `${Math.min(
                                    100,
                                    record.presence_percentage
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="font-mono text-[11px]">
                              {formatPercentage(record.presence_percentage, 0)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={record.status} size="sm">
                            {record.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
