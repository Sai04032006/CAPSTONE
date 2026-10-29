import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getStudents, createStudent, getStudent } from '../api/students';
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
  const { isDemoMode, demoState, addToast } = useApp();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'student_id'

  // Register Modal
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [formData, setFormData] = useState({
    student_id: '',
    name: '',
    email: '',
  });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [formError, setFormError] = useState(null);

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
      setStudents(demoState.students);
      setLoading(false);
      return;
    }

    try {
      const data = await getStudents();
      setStudents(data);
    } catch (err) {
      setError(err.userMessage || 'Could not fetch student records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [isDemoMode]);

  // Open Student Details
  const handleOpenDetails = async (student) => {
    setSelectedStudent(student);
    setDetailLoading(true);

    if (isDemoMode) {
      // Compute analytics from demoState
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
      // Fallback
      setStudentAnalytics(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Submit Register Form
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setRegisterLoading(true);

    const studentIdClean = formData.student_id.trim();
    const nameClean = formData.name.trim();

    if (!studentIdClean || !nameClean) {
      setFormError('Student ID and Student Name are required.');
      setRegisterLoading(false);
      return;
    }

    if (isDemoMode) {
      const exists = demoState.students.some(
        (s) => s.student_id === studentIdClean
      );
      if (exists) {
        setFormError(`Student ID ${studentIdClean} is already registered.`);
        setRegisterLoading(false);
        return;
      }

      const newStudent = {
        id: Date.now(),
        student_id: studentIdClean,
        name: nameClean,
        email: formData.email.trim() || null,
      };

      demoState.setStudents([...demoState.students, newStudent]);
      setStudents([...demoState.students, newStudent]);
      addToast(
        'success',
        'Student Registered',
        `${nameClean} (${studentIdClean}) was added to demo database.`
      );
      setIsRegisterOpen(false);
      setFormData({ student_id: '', name: '', email: '' });
      setRegisterLoading(false);
      return;
    }

    try {
      const created = await createStudent({
        student_id: studentIdClean,
        name: nameClean,
        email: formData.email,
      });

      addToast(
        'success',
        'Student Registered',
        `${created.name} (${created.student_id}) registered successfully.`
      );
      setIsRegisterOpen(false);
      setFormData({ student_id: '', name: '', email: '' });
      loadStudents();
    } catch (err) {
      setFormError(err.userMessage || 'Failed to register student.');
    } finally {
      setRegisterLoading(false);
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
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Enrolled Student Records
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Synchronized with the 512-dimensional face embeddings stored in PostgreSQL
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={RefreshCw}
            onClick={loadStudents}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={Plus}
            onClick={() => setIsRegisterOpen(true)}
          >
            Register Student
          </Button>
        </div>
      </div>

      {/* Info notice about AI Face Embeddings */}
      <div className="bg-indigo-50/60 rounded-xl border border-indigo-100 p-4 text-xs text-indigo-950 flex items-start gap-3">
        <Shield className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-indigo-900 block mb-0.5">
            Face Recognition Biometrics Architecture
          </span>
          <p className="text-indigo-800 leading-relaxed">
            The database currently maintains five enrolled student biometric records. Creating a student here establishes their authoritative academic record in the{' '}
            <code className="bg-indigo-100 px-1 py-0.5 rounded font-mono text-[11px]">
              students
            </code>{' '}
            table. Biometric 512-d embeddings are securely captured and enrolled via the offline AI script (
            <code className="bg-indigo-100 px-1 py-0.5 rounded font-mono text-[11px]">
              ai/enroll_student.py
            </code>
            ) and never transmitted in raw form to the browser.
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
          <LoadingSpinner message="Fetching enrolled students..." />
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            icon={Users}
            title={searchQuery ? 'No matching students found' : 'No students enrolled'}
            description={
              searchQuery
                ? `No student matching "${searchQuery}" was found.`
                : 'Click Register Student to enroll a new student in the classroom database.'
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
                  <th className="px-5 py-3">Status</th>
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
                            Enrolled Student
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
                      <Badge variant="ONLINE" size="sm">
                        Enrolled
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDetails(student)}
                      >
                        View Profile
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Register Student Modal */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Register New Student"
        subtitle="Add a new student to the PostgreSQL classroom database"
      >
        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Student ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 2300033018"
              value={formData.student_id}
              onChange={(e) =>
                setFormData({ ...formData, student_id: e.target.value })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. John Doe"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Email Address (Optional)
            </label>
            <input
              type="email"
              placeholder="e.g. student@smartclassroom.edu"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
            <strong>Note:</strong> Facial embeddings for this student should be registered separately using{' '}
            <code className="text-indigo-600 font-mono">ai/enroll_student.py</code>.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsRegisterOpen(false)}
              disabled={registerLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={registerLoading}
              icon={Plus}
            >
              Register Student
            </Button>
          </div>
        </form>
      </Modal>

      {/* Student Detail Modal */}
      <Modal
        isOpen={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        title={selectedStudent ? selectedStudent.name : 'Student Details'}
        subtitle={
          selectedStudent ? `ID: ${selectedStudent.student_id}` : ''
        }
        maxWidth="max-w-xl"
      >
        {selectedStudent && (
          <div className="space-y-5">
            {detailLoading ? (
              <LoadingSpinner message="Loading attendance analytics..." />
            ) : (
              <>
                {/* Profile Summary Cards */}
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
                  <Button
                    variant="outline"
                    onClick={() => setSelectedStudent(null)}
                  >
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
