import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Search,
  Download,
  Filter,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { getSessions } from '../api/sessions';
import { getStudents } from '../api/students';
import { getSessionAttendance, recordAttendance } from '../api/attendance';
import { getSessionAnalytics } from '../api/analytics';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorAlert from '../components/ui/ErrorAlert';
import EmptyState from '../components/ui/EmptyState';
import { exportToCSV } from '../utils/exportCsv';
import {
  formatSecondsToMinutes,
  formatPercentage,
  formatDateTime,
} from '../utils/formatters';

export default function AttendancePage() {
  const { isDemoMode, demoState, addToast } = useApp();
  const { currentUser, isPrincipal, activeTeacherId } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PRESENT' | 'ABSENT' | 'UNRECORDED'

  // Manual Record Modal
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [manualStudentId, setManualStudentId] = useState('');
  const [manualMinutes, setManualMinutes] = useState(35);
  const [recordSubmitting, setRecordSubmitting] = useState(false);
  const [recordError, setRecordError] = useState(null);

  // Load Initial Sessions and Students
  const loadInitialData = async () => {
    setLoading(true);
    setError(null);

    if (isDemoMode) {
      let sList = demoState.sessions;
      if (activeTeacherId) {
        sList = sList.filter((s) => !s.teacher_id || s.teacher_id === activeTeacherId);
      }
      setSessions(sList);
      setStudents(demoState.students);
      if (sList.length > 0) {
        const firstId = sList[0].id;
        setSelectedSessionId(String(firstId));
        loadSessionData(firstId, sList, demoState.students);
      }
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

      if (sessionsData.length > 0) {
        const firstId = sessionsData[0].id;
        setSelectedSessionId(String(firstId));
        await loadSessionData(firstId, sessionsData, studentsData);
      }
    } catch (err) {
      setError(err.userMessage || 'Could not load sessions');
    } finally {
      setLoading(false);
    }
  };

  // Load Session-Specific Attendance Records
  const loadSessionData = async (
    sessionId,
    currentSessions = sessions,
    currentStudents = students
  ) => {
    if (!sessionId) return;
    setSessionLoading(true);

    if (isDemoMode) {
      const records = demoState.attendance.filter(
        (a) => a.session_id === Number(sessionId)
      );
      setAttendanceRecords(records);

      const presentCount = records.filter((r) => r.status === 'PRESENT').length;
      const absentCount = records.filter((r) => r.status === 'ABSENT').length;
      const totalStudents = currentStudents.length;
      const unrecordedCount = Math.max(0, totalStudents - records.length);
      const totalAbsent = absentCount + unrecordedCount;
      const rate = totalStudents > 0 ? (presentCount / totalStudents) * 100 : 0;

      setAnalytics({
        total_students: totalStudents,
        present_students: presentCount,
        absent_students: totalAbsent,
        attendance_percentage: rate,
      });
      setSessionLoading(false);
      return;
    }

    try {
      const [records, analyticsData] = await Promise.all([
        getSessionAttendance(sessionId),
        getSessionAnalytics(sessionId).catch(() => null),
      ]);

      setAttendanceRecords(records);
      if (analyticsData) {
        setAnalytics(analyticsData);
      } else {
        const pres = records.filter((r) => r.status === 'PRESENT').length;
        const total = currentStudents.length;
        setAnalytics({
          total_students: total,
          present_students: pres,
          absent_students: Math.max(0, total - pres),
          attendance_percentage: total > 0 ? (pres / total) * 100 : 0,
        });
      }
    } catch (err) {
      addToast('error', 'Attendance Fetch Failed', err.userMessage || err.message);
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [isDemoMode, activeTeacherId]);

  const handleSessionChange = (newId) => {
    setSelectedSessionId(newId);
    loadSessionData(newId);
  };

  // Manual Attendance Record Submit
  const handleRecordSubmit = async (e) => {
    e.preventDefault();
    setRecordError(null);
    setRecordSubmitting(true);

    const sId = Number(selectedSessionId);
    const presSeconds = Number(manualMinutes) * 60;

    if (!manualStudentId) {
      setRecordError('Please select a student.');
      setRecordSubmitting(false);
      return;
    }

    if (isDemoMode) {
      const curSession = demoState.sessions.find((s) => s.id === sId);
      const totalSec = (curSession?.duration_minutes || 50) * 60;
      const capped = Math.min(totalSec, presSeconds);
      const pct = (capped / totalSec) * 100;
      const status = pct >= 70 ? 'PRESENT' : 'ABSENT';

      const existingIndex = demoState.attendance.findIndex(
        (a) => a.session_id === sId && a.student_id === manualStudentId
      );

      let updated;
      if (existingIndex >= 0) {
        updated = [...demoState.attendance];
        updated[existingIndex] = {
          ...updated[existingIndex],
          presence_seconds: capped,
          presence_percentage: pct,
          status,
        };
      } else {
        const newRecord = {
          id: Date.now(),
          session_id: sId,
          student_id: manualStudentId,
          presence_seconds: capped,
          presence_percentage: pct,
          status,
        };
        updated = [newRecord, ...demoState.attendance];
      }

      demoState.setAttendance(updated);
      setAttendanceRecords(updated.filter((a) => a.session_id === sId));
      setIsRecordModalOpen(false);
      setRecordSubmitting(false);
      addToast(
        'success',
        'Attendance Recorded',
        `Attendance for student ${manualStudentId} updated.`
      );
      loadSessionData(sId);
      return;
    }

    try {
      const res = await recordAttendance({
        session_id: sId,
        student_id: manualStudentId,
        presence_seconds: presSeconds,
      });

      addToast(
        'success',
        'Attendance Recorded',
        `Recorded ${manualStudentId}: ${res.status} (${res.presence_percentage.toFixed(1)}%)`
      );
      setIsRecordModalOpen(false);
      loadSessionData(sId);
    } catch (err) {
      setRecordError(err.userMessage || 'Failed to record attendance');
    } finally {
      setRecordSubmitting(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!attendanceRecords.length) {
      addToast('warning', 'No Records', 'There are no attendance records to export.');
      return;
    }
    const currentSession = sessions.find((s) => s.id === Number(selectedSessionId));
    const filename = `attendance_session_${selectedSessionId}_${
      currentSession?.subject ? currentSession.subject.replace(/\s+/g, '_') : 'class'
    }`;

    const rows = students.map((st) => {
      const record = attendanceRecords.find((r) => r.student_id === st.student_id);
      return {
        session_id: selectedSessionId,
        student_id: st.student_id,
        student_name: st.name,
        presence_seconds: record ? record.presence_seconds : 0,
        presence_percentage: record ? record.presence_percentage.toFixed(2) : 0,
        status: record ? record.status : 'UNRECORDED',
      };
    });

    const headers = {
      session_id: 'Session ID',
      student_id: 'Student ID',
      student_name: 'Student Name',
      presence_seconds: 'Presence (Seconds)',
      presence_percentage: 'Presence (%)',
      status: 'Status',
    };

    exportToCSV(filename, rows, headers);
    addToast('success', 'CSV Exported', `Saved ${filename}.csv`);
  };

  const currentSession = sessions.find((s) => s.id === Number(selectedSessionId));

  // Merge enrolled students with attendance records
  // We explicitly distinguish between PRESENT, confirmed ABSENT, and UNRECORDED (not detected in frame yet)
  const fullAttendanceRows = students
    .map((student) => {
      const rec = attendanceRecords.find((r) => r.student_id === student.student_id);
      return {
        student,
        record: rec || null,
        status: rec ? rec.status : 'UNRECORDED',
      };
    })
    .filter((row) => {
      // Query filter
      const q = searchQuery.toLowerCase();
      const matchQuery =
        row.student.name.toLowerCase().includes(q) ||
        row.student.student_id.toLowerCase().includes(q);
      if (!matchQuery) return false;

      // Status filter
      if (statusFilter === 'ALL') return true;
      return row.status === statusFilter;
    });

  return (
    <div className="space-y-6">
      {/* Top Banner and Session Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Class Attendance Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select a class session to review authoritative attendance statuses
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={Download}
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>
          {selectedSessionId && (
            <Button
              size="sm"
              variant="primary"
              icon={Plus}
              onClick={() => setIsRecordModalOpen(true)}
            >
              Record Attendance
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorAlert title="Attendance Error" message={error} onRetry={loadInitialData} />}

      {/* Session Selector Card */}
      <Card bodyClassName="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider shrink-0">
              Active Session:
            </span>
            <select
              value={selectedSessionId}
              onChange={(e) => handleSessionChange(e.target.value)}
              className="text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-72 cursor-pointer"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.id} — {s.subject || 'Class'} ({s.status})
                </option>
              ))}
            </select>
          </div>

          {currentSession && (
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>
                Duration: <strong>{currentSession.duration_minutes} min</strong>
              </span>
              <span>•</span>
              <span>
                Threshold: <strong>70%</strong>
              </span>
              <span>•</span>
              <Badge variant={currentSession.status} size="sm">
                {currentSession.status}
              </Badge>
            </div>
          )}
        </div>
      </Card>

      {/* Summary KPI Cards for Selected Session */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card bodyClassName="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Enrolled
            </span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {students.length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Class roster size</p>
        </Card>

        <Card bodyClassName="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Confirmed Present
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">
            {analytics?.present_students ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">&ge; 70% class duration</p>
        </Card>

        <Card bodyClassName="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Confirmed Absent
            </span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-700">
            {analytics?.absent_students ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Below threshold or absent</p>
        </Card>

        <Card bodyClassName="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Session Attendance
            </span>
            <CheckSquare className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {analytics ? formatPercentage(analytics.attendance_percentage) : '0%'}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Calculated by FastAPI backend</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search student by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-500">Status Filter:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">All Students ({students.length})</option>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
            <option value="UNRECORDED">Unrecorded</option>
          </select>
        </div>
      </div>

      {/* Attendance Table */}
      <Card bodyClassName="p-0">
        {sessionLoading ? (
          <LoadingSpinner message="Calculating session presence records..." />
        ) : fullAttendanceRows.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No records found"
            description="No student records match the active filter criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Student Name</th>
                  <th className="px-5 py-3">Student ID</th>
                  <th className="px-5 py-3">Presence Time</th>
                  <th className="px-5 py-3">Percentage (Req: 70%)</th>
                  <th className="px-5 py-3">Official Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {fullAttendanceRows.map(({ student, record, status }) => (
                  <tr
                    key={student.student_id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-slate-900 block">
                        {student.name}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {student.email || 'Enrolled'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-900 font-medium">
                      {student.student_id}
                    </td>
                    <td className="px-5 py-3.5 font-mono">
                      {record
                        ? formatSecondsToMinutes(record.presence_seconds)
                        : '0s (Not seen)'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${
                              status === 'PRESENT'
                                ? 'bg-emerald-500'
                                : status === 'ABSENT'
                                ? 'bg-rose-500'
                                : 'bg-slate-300'
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                record ? record.presence_percentage : 0
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="font-mono text-xs font-semibold">
                          {record
                            ? formatPercentage(record.presence_percentage, 1)
                            : '0.0%'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {status === 'PRESENT' ? (
                        <Badge variant="PRESENT" dot size="sm">
                          PRESENT
                        </Badge>
                      ) : status === 'ABSENT' ? (
                        <Badge variant="ABSENT" size="sm">
                          ABSENT
                        </Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 italic">
                          <HelpCircle className="h-3 w-3" />
                          Unrecorded
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Manual Record Attendance Modal */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title="Record / Update Attendance"
        subtitle={`Session #${selectedSessionId} (${currentSession?.subject || 'Class'})`}
      >
        <form onSubmit={handleRecordSubmit} className="space-y-4">
          {recordError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {recordError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Select Student
            </label>
            <select
              value={manualStudentId}
              onChange={(e) => setManualStudentId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">-- Choose Student --</option>
              {students.map((st) => (
                <option key={st.student_id} value={st.student_id}>
                  {st.name} ({st.student_id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Presence Duration (Minutes)
            </label>
            <input
              type="number"
              min="0"
              max={currentSession?.duration_minutes || 50}
              value={manualMinutes}
              onChange={(e) => setManualMinutes(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Session duration is {currentSession?.duration_minutes || 50} minutes. 70% threshold is{' '}
              {Math.round(((currentSession?.duration_minutes || 50) * 0.7))} minutes.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
            <strong>Backend Authority Rule:</strong> Status will be automatically calculated as PRESENT or ABSENT based on the 70% attendance threshold.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsRecordModalOpen(false)}
              disabled={recordSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={recordSubmitting}
              icon={CheckSquare}
            >
              Submit Attendance
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
