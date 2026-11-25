import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  GraduationCap,
  PlusCircle,
  CalendarDays,
  ExternalLink,
  BookOpen,
  Mail,
  ShieldCheck,
  Search,
  Filter,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

export default function TeachersManagementPage() {
  const navigate = useNavigate();
  const {
    teachersList,
    registerTeacher,
    setSelectedTeacherFilter,
    isPrincipal,
  } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTeacherId, setNewTeacherId] = useState('');
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherSubject, setNewTeacherSubject] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPassword, setNewTeacherPassword] = useState('');
  const [modalError, setModalError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredTeachers = teachersList.filter((t) => {
    const q = searchTerm.toLowerCase();
    return (
      t.teacher_id?.toLowerCase().includes(q) ||
      t.name?.toLowerCase().includes(q) ||
      t.subject?.toLowerCase().includes(q)
    );
  });

  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    setModalError(null);
    const cleanId = newTeacherId.trim();
    if (!/^\d{4}$/.test(cleanId)) {
      setModalError('Teacher ID must be exactly 4 digits (e.g. 1001, 2045)');
      return;
    }
    if (!newTeacherName.trim()) {
      setModalError('Teacher name is required');
      return;
    }
    if (!newTeacherPassword || newTeacherPassword.length <= 6) {
      setModalError('Password must be more than 6 characters long');
      return;
    }

    setSubmitting(true);
    try {
      await registerTeacher({
        teacher_id: cleanId,
        name: newTeacherName.trim(),
        subject: newTeacherSubject.trim() || 'General',
        email: newTeacherEmail.trim() || `${cleanId}@smartclassroom.edu`,
        password: newTeacherPassword,
      });
      setShowAddModal(false);
      setNewTeacherId('');
      setNewTeacherName('');
      setNewTeacherSubject('');
      setNewTeacherEmail('');
      setNewTeacherPassword('');
    } catch (err) {
      setModalError(err.userMessage || err.message || 'Failed to create teacher');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInspectTeacherSessions = (tId) => {
    setSelectedTeacherFilter(tId);
    navigate('/sessions');
  };

  const handleInspectTeacherStudents = (tId) => {
    setSelectedTeacherFilter(tId);
    navigate('/students');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200 text-xs font-semibold border border-purple-400/30 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Principal Administration Module
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Faculty & Teacher Management
          </h1>
          <p className="text-sm text-purple-200/80 mt-1">
            Oversee all registered teachers, their active sessions, and student allocations school-wide.
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          variant="primary"
          className="!bg-white !text-purple-900 hover:!bg-purple-50 font-semibold shadow-lg shrink-0"
        >
          <PlusCircle className="h-4 w-4 mr-2 text-purple-700" />
          Register New Teacher
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Registered Faculty</p>
            <p className="text-2xl font-bold text-slate-900">{teachersList.length}</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Academic Departments</p>
            <p className="text-2xl font-bold text-slate-900">
              {new Set(teachersList.map((t) => t.subject).filter(Boolean)).size || 3}
            </p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Class Sessions</p>
            <p className="text-2xl font-bold text-slate-900">
              {teachersList.reduce((acc, t) => acc + (t.sessions_count || 1), 0)}
            </p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Students Enrolled</p>
            <p className="text-2xl font-bold text-slate-900">5 Students</p>
          </div>
        </Card>
      </div>

      {/* Search & Table */}
      <Card className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search faculty by ID, name or subject..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <span className="text-xs text-slate-500">
            Showing {filteredTeachers.length} of {teachersList.length} faculty members
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[11px] font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Teacher ID</th>
                <th className="py-3 px-4">Faculty Member</th>
                <th className="py-3 px-4">Department / Subject</th>
                <th className="py-3 px-4">Sessions</th>
                <th className="py-3 px-4">Students</th>
                <th className="py-3 px-4 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTeachers.map((t) => (
                <tr key={t.id || t.teacher_id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                    <span className="px-2 py-1 rounded bg-indigo-50 border border-indigo-200">
                      #{t.teacher_id}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{t.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Mail className="h-3 w-3" />
                      {t.email || `${t.teacher_id}@smartclassroom.edu`}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant="INFO">{t.subject || 'General'}</Badge>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 font-medium">
                    {t.sessions_count || 1} sessions
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 font-medium">
                    {t.students_count || 5} students
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleInspectTeacherSessions(t.teacher_id)}
                        className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                        title="Filter sessions to this teacher"
                      >
                        Sessions
                      </button>
                      <button
                        onClick={() => handleInspectTeacherStudents(t.teacher_id)}
                        className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors cursor-pointer"
                        title="Filter students to this teacher"
                      >
                        Students
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal to Register New Teacher */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Register New Faculty Member"
      >
        <form onSubmit={handleCreateTeacher} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {modalError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Teacher ID <span className="text-indigo-600 font-bold">* (Exactly 4 digits)</span>
            </label>
            <input
              type="text"
              maxLength={4}
              value={newTeacherId}
              onChange={(e) => setNewTeacherId(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 3012"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name <span className="text-indigo-600 font-bold">*</span>
            </label>
            <input
              type="text"
              value={newTeacherName}
              onChange={(e) => setNewTeacherName(e.target.value)}
              placeholder="e.g. Dr. Robert Vance"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department / Subject
            </label>
            <input
              type="text"
              value={newTeacherSubject}
              onChange={(e) => setNewTeacherSubject(e.target.value)}
              placeholder="e.g. Computer Science"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={newTeacherEmail}
              onChange={(e) => setNewTeacherEmail(e.target.value)}
              placeholder="teacher@smartclassroom.edu"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Initial Password <span className="text-indigo-600 font-bold">* (Length &gt; 6 characters)</span>
            </label>
            <input
              type="password"
              value={newTeacherPassword}
              onChange={(e) => setNewTeacherPassword(e.target.value)}
              placeholder="Minimum 7 characters"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Registering...' : 'Register Teacher'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
