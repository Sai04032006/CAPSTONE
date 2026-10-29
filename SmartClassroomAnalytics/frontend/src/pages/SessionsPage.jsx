import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Plus,
  Play,
  Square,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  ChevronRight,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getSessions, createSession, endSession } from '../api/sessions';
import { getSessionAttendance } from '../api/attendance';
import { getSessionAnalytics } from '../api/analytics';
import { getStudents } from '../api/students';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorAlert from '../components/ui/ErrorAlert';
import EmptyState from '../components/ui/EmptyState';
import {
  formatDateTime,
  formatPercentage,
  formatSecondsToMinutes,
} from '../utils/formatters';

export default function SessionsPage() {
  const { isDemoMode, demoState, addToast, refreshActiveSession } = useApp();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected session details
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionAttendance, setSessionAttendance] = useState([]);
  const [sessionAnalytics, setSessionAnalytics] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Create Session Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [duration, setDuration] = useState(50);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);

  // End Session Confirmation Modal
  const [endingSession, setEndingSession] = useState(null);
  const [endLoading, setEndLoading] = useState(false);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);

    if (isDemoMode) {
      setSessions(demoState.sessions);
      if (demoState.sessions.length > 0 && !selectedSession) {
        handleSelectSession(demoState.sessions[0]);
      }
      setLoading(false);
      return;
    }

    try {
      const data = await getSessions();
      setSessions(data);
      if (data.length > 0 && !selectedSession) {
        handleSelectSession(data[0]);
      }
    } catch (err) {
      setError(err.userMessage || 'Failed to load class sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [isDemoMode]);

  // Handle select session to inspect details
  const handleSelectSession = async (session) => {
    setSelectedSession(session);
    setDetailsLoading(true);

    if (isDemoMode) {
      const att = demoState.attendance.filter((a) => a.session_id === session.id);
      setSessionAttendance(att);
      const pres = att.filter((a) => a.status === 'PRESENT').length;
      const total = demoState.students.length;
      setSessionAnalytics({
        total_students: total,
        present_students: pres,
        absent_students: Math.max(0, total - pres),
        attendance_percentage: total > 0 ? (pres / total) * 100 : 0,
      });
      setDetailsLoading(false);
      return;
    }

    try {
      const [att, analytics] = await Promise.all([
        getSessionAttendance(session.id).catch(() => []),
        getSessionAnalytics(session.id).catch(() => null),
      ]);
      setSessionAttendance(att);
      setSessionAnalytics(analytics);
    } catch {
      setSessionAttendance([]);
      setSessionAnalytics(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Submit Create Session
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);

    const dur = Number(duration);
    if (dur <= 0) {
      setCreateError('Duration must be greater than 0 minutes.');
      setCreateLoading(false);
      return;
    }

    if (isDemoMode) {
      const hasActive = demoState.sessions.some((s) => s.status === 'ACTIVE');
      if (hasActive) {
        setCreateError('An active session already exists. Complete it before starting a new one.');
        setCreateLoading(false);
        return;
      }

      const newId = (demoState.sessions[0]?.id || 0) + 1;
      const newSession = {
        id: newId,
        subject: subject.trim() || 'Untitled Class',
        duration_minutes: dur,
        attendance_threshold: 0.70,
        started_at: new Date().toISOString(),
        ended_at: null,
        status: 'ACTIVE',
      };

      const updated = [newSession, ...demoState.sessions];
      demoState.setSessions(updated);
      setSessions(updated);
      setIsCreateModalOpen(false);
      setSubject('');
      setDuration(50);
      setCreateLoading(false);
      refreshActiveSession();
      addToast('success', 'Session Created', `Class session #${newId} is now active.`);
      handleSelectSession(newSession);
      return;
    }

    try {
      const created = await createSession({
        subject: subject.trim(),
        duration_minutes: dur,
      });

      addToast('success', 'Session Created', `Started session #${created.id}.`);
      setIsCreateModalOpen(false);
      setSubject('');
      setDuration(50);
      await refreshActiveSession();
      loadSessions();
      handleSelectSession(created);
    } catch (err) {
      setCreateError(err.userMessage || 'Failed to create session');
    } finally {
      setCreateLoading(false);
    }
  };

  // Confirm End Session
  const handleEndSubmit = async () => {
    if (!endingSession) return;
    setEndLoading(true);

    if (isDemoMode) {
      const updated = demoState.sessions.map((s) =>
        s.id === endingSession.id
          ? { ...s, status: 'COMPLETED', ended_at: new Date().toISOString() }
          : s
      );
      demoState.setSessions(updated);
      setSessions(updated);
      setEndingSession(null);
      setEndLoading(false);
      refreshActiveSession();
      addToast('success', 'Session Ended', `Session #${endingSession.id} is now completed.`);
      if (selectedSession?.id === endingSession.id) {
        handleSelectSession({ ...endingSession, status: 'COMPLETED', ended_at: new Date().toISOString() });
      }
      return;
    }

    try {
      const ended = await endSession(endingSession.id);
      addToast('success', 'Session Completed', `Session #${ended.id} marked as completed.`);
      setEndingSession(null);
      await refreshActiveSession();
      loadSessions();
      if (selectedSession?.id === ended.id) {
        handleSelectSession(ended);
      }
    } catch (err) {
      addToast('error', 'End Session Error', err.userMessage || err.message);
    } finally {
      setEndLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Class Sessions Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage lecture sessions, track durations and review attendance logs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={RefreshCw}
            onClick={loadSessions}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={Plus}
            onClick={() => {
              setCreateError(null);
              setIsCreateModalOpen(true);
            }}
          >
            Create New Session
          </Button>
        </div>
      </div>

      {error && <ErrorAlert title="Sessions Error" message={error} onRetry={loadSessions} />}

      {/* Main Grid: Sessions List (Left) and Session Details (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions List (2 Columns) */}
        <div className="lg:col-span-2 space-y-4">
          <Card
            title="All Class Sessions"
            subtitle={`${sessions.length} total sessions recorded`}
            bodyClassName="p-0"
          >
            {loading ? (
              <LoadingSpinner message="Loading sessions..." />
            ) : sessions.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No class sessions created"
                description="Start your first class session to begin tracking student attendance."
                actionLabel="Create Session"
                onAction={() => setIsCreateModalOpen(true)}
              />
            ) : (
              <div className="divide-y divide-slate-100 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3">Subject / ID</th>
                      <th className="px-5 py-3">Duration</th>
                      <th className="px-5 py-3">Started</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {sessions.map((session) => {
                      const isSelected = selectedSession?.id === session.id;
                      const isActive = session.status === 'ACTIVE';

                      return (
                        <tr
                          key={session.id}
                          onClick={() => handleSelectSession(session)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-50/60 font-medium'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-slate-900 block">
                              {session.subject || 'Class Session'}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              ID: #{session.id} • Threshold: 70%
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-mono">
                            {session.duration_minutes} min
                          </td>
                          <td className="px-5 py-3.5 text-slate-500">
                            {formatDateTime(session.started_at)}
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge
                              variant={session.status}
                              dot={isActive}
                              size="sm"
                            >
                              {session.status}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            {isActive ? (
                              <Button
                                size="sm"
                                variant="danger"
                                icon={Square}
                                onClick={() => setEndingSession(session)}
                              >
                                End
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSelectSession(session)}
                              >
                                View
                              </Button>
                            )}
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

        {/* Selected Session Details Panel (1 Column) */}
        <div className="space-y-4">
          <Card
            title={
              selectedSession
                ? selectedSession.subject || `Session #${selectedSession.id}`
                : 'Session Details'
            }
            subtitle={
              selectedSession
                ? `Session ID: #${selectedSession.id}`
                : 'Select a session to view details'
            }
          >
            {detailsLoading ? (
              <LoadingSpinner size="sm" message="Loading details..." />
            ) : !selectedSession ? (
              <p className="text-xs text-slate-400 italic text-center py-6">
                Click any session row to inspect attendance and timings.
              </p>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Status and Timestamps */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Status:</span>
                    <Badge variant={selectedSession.status} size="sm">
                      {selectedSession.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Duration:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedSession.duration_minutes} minutes
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Attendance Threshold:</span>
                    <span className="font-mono font-semibold text-indigo-700">
                      70% ({Math.round(selectedSession.duration_minutes * 0.7)}m required)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Started:</span>
                    <span className="text-slate-700">
                      {formatDateTime(selectedSession.started_at)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Ended:</span>
                    <span className="text-slate-700">
                      {formatDateTime(selectedSession.ended_at)}
                    </span>
                  </div>
                </div>

                {/* Session Attendance Summary */}
                {sessionAnalytics && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-center">
                      <span className="text-[11px] text-emerald-800 uppercase font-semibold block">
                        Present
                      </span>
                      <span className="text-xl font-bold text-emerald-700 mt-1 block">
                        {sessionAnalytics.present_students}
                      </span>
                    </div>

                    <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-center">
                      <span className="text-[11px] text-rose-800 uppercase font-semibold block">
                        Absent
                      </span>
                      <span className="text-xl font-bold text-rose-700 mt-1 block">
                        {sessionAnalytics.absent_students}
                      </span>
                    </div>
                  </div>
                )}

                {/* Session Attendance Preview List */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Recorded Students ({sessionAttendance.length})
                  </h4>
                  {sessionAttendance.length === 0 ? (
                    <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200">
                      No attendance logged for this session.
                    </p>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-52 overflow-y-auto">
                      {sessionAttendance.map((rec) => (
                        <div
                          key={rec.id}
                          className="px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50"
                        >
                          <div>
                            <span className="font-semibold text-slate-800 font-mono block">
                              {rec.student_id}
                            </span>
                            <span className="text-[11px] text-slate-400">
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

                {/* Active Session Ending Action */}
                {selectedSession.status === 'ACTIVE' && (
                  <div className="pt-2">
                    <Button
                      variant="danger"
                      className="w-full"
                      icon={Square}
                      onClick={() => setEndingSession(selectedSession)}
                    >
                      End This Session
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Create Session Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Class Session"
        subtitle="Initialize session in PostgreSQL database"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {createError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {createError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Subject Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Distributed Operating Systems"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
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
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Backend validates duration &gt; 0.
            </p>
          </div>

          <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 text-xs text-indigo-900">
            <strong>Attendance Rule:</strong> Threshold is permanently set to <strong>70%</strong> by the FastAPI backend model.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={createLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={createLoading}
              icon={Plus}
            >
              Start Session
            </Button>
          </div>
        </form>
      </Modal>

      {/* End Session Confirmation Modal */}
      <Modal
        isOpen={!!endingSession}
        onClose={() => setEndingSession(null)}
        title="End Class Session"
        subtitle={`Session #${endingSession?.id}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to end session{' '}
            <strong className="text-slate-900">
              #{endingSession?.id} ({endingSession?.subject || 'Class'})
            </strong>
            ? This action cannot be reversed once finalized.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setEndingSession(null)}
              disabled={endLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleEndSubmit}
              loading={endLoading}
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
