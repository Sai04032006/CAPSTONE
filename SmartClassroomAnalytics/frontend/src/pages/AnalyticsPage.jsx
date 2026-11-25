import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  TrendingUp,
  AlertTriangle,
  Clock,
  RefreshCw,
  PhoneCall,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { getSessions } from '../api/sessions';
import { getStudents } from '../api/students';
import { getSessionAttendance } from '../api/attendance';
import {
  getSessionAnalytics,
  getStudentAnalytics,
  getSessionBehaviorAnalytics,
} from '../api/analytics';
import { getSessionBehavior } from '../api/behavior';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorAlert from '../components/ui/ErrorAlert';
import EmptyState from '../components/ui/EmptyState';
import AttendanceChart from '../components/charts/AttendanceChart';
import BehaviorChart from '../components/charts/BehaviorChart';
import { exportToCSV } from '../utils/exportCsv';
import {
  formatSecondsToMinutes,
  formatPercentage,
  formatDateTime,
  formatDateShort,
} from '../utils/formatters';

const BEHAVIOR_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'];

export default function AnalyticsPage() {
  const { isDemoMode, demoState, addToast } = useApp();
  const { currentUser, isPrincipal, activeTeacherId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('ALL');

  // Computed data for charts
  const [trendData, setTrendData] = useState([]);
  const [sessionDistributionData, setSessionDistributionData] = useState([]);
  const [behaviorSummary, setBehaviorSummary] = useState([]);
  const [studentAnalyticsList, setStudentAnalyticsList] = useState([]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);

    if (isDemoMode) {
      let demoSessions = demoState.sessions;
      if (activeTeacherId) {
        demoSessions = demoSessions.filter(
          (s) => !s.teacher_id || s.teacher_id === activeTeacherId
        );
      }
      const demoStudents = demoState.students;
      setSessions(demoSessions);
      setStudents(demoStudents);

      // Trend data across sessions
      const trends = demoSessions.map((s) => {
        const sAtt = demoState.attendance.filter((a) => a.session_id === s.id);
        const pres = sAtt.filter((a) => a.status === 'PRESENT').length;
        const total = demoStudents.length || 1;
        const pct = (pres / total) * 100;
        return {
          name: s.subject ? s.subject.substring(0, 12) : `Session #${s.id}`,
          rate: Number(pct.toFixed(1)),
          present: pres,
          absent: Math.max(0, total - pres),
          duration: s.duration_minutes,
        };
      });
      setTrendData(trends);

      // Student performance table
      const studentStats = demoStudents.map((st) => {
        const stAtt = demoState.attendance.filter(
          (a) => a.student_id === st.student_id
        );
        const pres = stAtt.filter((a) => a.status === 'PRESENT').length;
        const total = demoSessions.length;
        const rate = total > 0 ? (pres / total) * 100 : 0;
        const stBeh = demoState.behavior.filter(
          (b) => b.student_id === st.student_id
        );

        return {
          student_id: st.student_id,
          name: st.name,
          total_sessions: total,
          present_sessions: pres,
          attendance_percentage: rate,
          behavior_count: stBeh.length,
        };
      });
      setStudentAnalyticsList(studentStats);

      // Behavior breakdown
      const behaviorCounts = {};
      demoState.behavior.forEach((b) => {
        behaviorCounts[b.behavior] = (behaviorCounts[b.behavior] || 0) + 1;
      });
      const behaviorData = Object.entries(behaviorCounts).map(([k, v]) => ({
        name: k.replace(/_/g, ' '),
        value: v,
      }));
      setBehaviorSummary(behaviorData);

      setLoading(false);
      return;
    }

    try {
      const [sessionsData, studentsData] = await Promise.all([
        getSessions(activeTeacherId),
        getStudents(activeTeacherId),
      ]);

      setSessions(sessionsData);
      setStudents(studentsData);

      // 1. Fetch Analytics for each session
      const trendPromises = sessionsData.slice(0, 8).reverse().map(async (s) => {
        try {
          const res = await getSessionAnalytics(s.id);
          return {
            name: s.subject ? s.subject.substring(0, 12) : `Session #${s.id}`,
            rate: Number(res.attendance_percentage.toFixed(1)),
            present: res.present_students,
            absent: res.absent_students,
            duration: s.duration_minutes,
          };
        } catch {
          return {
            name: `Session #${s.id}`,
            rate: 0,
            present: 0,
            absent: 0,
            duration: s.duration_minutes,
          };
        }
      });

      const resolvedTrends = await Promise.all(trendPromises);
      setTrendData(resolvedTrends);

      // 2. Fetch Student Analytics
      const studentPromises = studentsData.map(async (st) => {
        try {
          const stRes = await getStudentAnalytics(st.student_id);
          return {
            student_id: st.student_id,
            name: st.name,
            total_sessions: stRes.total_sessions,
            present_sessions: stRes.present_sessions,
            attendance_percentage: stRes.attendance_percentage,
            behavior_count: stRes.total_behavior_events,
          };
        } catch {
          return {
            student_id: st.student_id,
            name: st.name,
            total_sessions: sessionsData.length,
            present_sessions: 0,
            attendance_percentage: 0,
            behavior_count: 0,
          };
        }
      });

      const resolvedStudents = await Promise.all(studentPromises);
      setStudentAnalyticsList(resolvedStudents);

      // 3. Behavior summary from latest sessions
      const behaviorMap = {};
      for (const s of sessionsData.slice(0, 4)) {
        try {
          const events = await getSessionBehavior(s.id);
          events.forEach((ev) => {
            behaviorMap[ev.behavior] = (behaviorMap[ev.behavior] || 0) + 1;
          });
        } catch (_err) {
          // ignore session behavior fetch failure
        }
      }
      const bData = Object.entries(behaviorMap).map(([k, v]) => ({
        name: k.replace(/_/g, ' '),
        value: v,
      }));
      setBehaviorSummary(bData);
    } catch (err) {
      setError(err.userMessage || 'Could not load analytics metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [isDemoMode, activeTeacherId]);

  // Export Analytics Summary CSV
  const handleExportCSV = () => {
    if (!studentAnalyticsList.length) {
      addToast('warning', 'No Data', 'No student analytics data available to export.');
      return;
    }
    const filename = `classroom_analytics_report_${new Date().toISOString().slice(0, 10)}`;
    const rows = studentAnalyticsList.map((st) => ({
      student_id: st.student_id,
      name: st.name,
      total_sessions: st.total_sessions,
      present_sessions: st.present_sessions,
      attendance_percentage: st.attendance_percentage.toFixed(1),
      behavior_count: st.behavior_count,
    }));

    const headers = {
      student_id: 'Student ID',
      name: 'Student Name',
      total_sessions: 'Total Sessions',
      present_sessions: 'Present Sessions',
      attendance_percentage: 'Attendance (%)',
      behavior_count: 'Behavior Infractions',
    };

    exportToCSV(filename, rows, headers);
    addToast('success', 'Report Exported', `Saved ${filename}.csv`);
  };

  const avgAttendance =
    trendData.length > 0
      ? (
          trendData.reduce((acc, curr) => acc + curr.rate, 0) / trendData.length
        ).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Classroom Analytics & Reports
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Attendance trends, participation rates and AI behavior monitoring
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={RefreshCw}
            onClick={loadAnalytics}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={Download}
            onClick={handleExportCSV}
          >
            Export Comprehensive Report
          </Button>
        </div>
      </div>

      {error && <ErrorAlert title="Analytics Sync Error" message={error} onRetry={loadAnalytics} />}

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card bodyClassName="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Class Sessions
            </span>
            <Calendar className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {sessions.length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Class lectures tracked</p>
        </Card>

        <Card bodyClassName="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Average Attendance
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">
            {avgAttendance}%
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Across all recorded sessions</p>
        </Card>

        <Card bodyClassName="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Enrolled Students
            </span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {students.length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Face recognition profiles</p>
        </Card>

        <Card bodyClassName="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Attendance Threshold
            </span>
            <CheckCircle2 className="h-4 w-4 text-teal-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-700">
            70%
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Fixed institutional rule</p>
        </Card>
      </div>

      {/* Main Charts: Attendance Trend Line Chart & Behavior Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Rate Trend (2 Columns) */}
        <div className="lg:col-span-2">
          <Card
            title="Attendance Percentage Across Sessions"
            subtitle="Percentage of enrolled students achieving >= 70% duration"
          >
            {loading ? (
              <LoadingSpinner message="Generating trend analytics..." />
            ) : trendData.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="Insufficient data for trends"
                description="Record attendance in class sessions to populate trend graphs."
              />
            ) : (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                      unit="%"
                      domain={[0, 100]}
                    />
                    <Tooltip
                      formatter={(val) => [`${val}%`, 'Attendance Rate']}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderRadius: '8px',
                        border: 'none',
                        color: '#f8fafc',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="#4f46e5"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#4f46e5' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        {/* Behavior Distraction Breakdown (1 Column) */}
        <div>
          <Card
            title="Classroom Behavior Events"
            subtitle="Distractions detected by YOLO (e.g. phone usage)"
          >
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : behaviorSummary.length === 0 ? (
              <EmptyState
                icon={PhoneCall}
                title="No behavior infractions"
                description="No cell phone or distraction events recorded across sessions."
              />
            ) : (
              <BehaviorChart data={behaviorSummary} height={260} />
            )}
          </Card>
        </div>
      </div>

      {/* Present vs Absent Stacked/Grouped Chart */}
      <Card
        title="Session Attendance Breakdown"
        subtitle="Absolute count of present vs absent students per session"
      >
        {loading ? (
          <LoadingSpinner size="sm" />
        ) : trendData.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No session data"
            description="Start sessions to visualize attendance distribution."
          />
        ) : (
          <AttendanceChart data={trendData} height={280} />
        )}
      </Card>

      {/* Student Participation Performance Table */}
      <Card
        title="Student Attendance & Performance Roster"
        subtitle="Individual participation rates computed from all sessions"
        bodyClassName="p-0"
      >
        {loading ? (
          <LoadingSpinner message="Calculating student participation metrics..." />
        ) : studentAnalyticsList.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students enrolled"
            description="Add students to start tracking individual analytics."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Student Name</th>
                  <th className="px-5 py-3">Student ID</th>
                  <th className="px-5 py-3">Total Sessions</th>
                  <th className="px-5 py-3">Present Sessions</th>
                  <th className="px-5 py-3">Attendance Rate</th>
                  <th className="px-5 py-3">Behavior Events</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {studentAnalyticsList.map((st) => (
                  <tr key={st.student_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-slate-900 block">
                        {st.name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-900 font-medium">
                      {st.student_id}
                    </td>
                    <td className="px-5 py-3.5 font-mono">{st.total_sessions}</td>
                    <td className="px-5 py-3.5 font-mono text-emerald-700 font-semibold">
                      {st.present_sessions}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-20 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              st.attendance_percentage >= 70
                                ? 'bg-emerald-500'
                                : 'bg-rose-500'
                            }`}
                            style={{
                              width: `${Math.min(100, st.attendance_percentage)}%`,
                            }}
                          />
                        </div>
                        <span className="font-mono font-medium">
                          {formatPercentage(st.attendance_percentage)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {st.behavior_count > 0 ? (
                        <Badge variant="WARNING" size="sm">
                          {st.behavior_count} events
                        </Badge>
                      ) : (
                        <span className="text-slate-400 text-[11px]">0 infractions</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
