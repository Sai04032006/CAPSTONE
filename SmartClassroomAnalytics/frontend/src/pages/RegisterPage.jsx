import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  GraduationCap,
  Shield,
  UserPlus,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { registerTeacher, registerPrincipal } = useAuth();

  const [activeTab, setActiveTab] = useState('teacher'); // 'teacher' | 'principal'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Teacher Form State
  const [teacherId, setTeacherId] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherSubject, setTeacherSubject] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');

  // Principal Form State
  const [principalUsername, setPrincipalUsername] = useState('');
  const [principalName, setPrincipalName] = useState('');
  const [principalEmail, setPrincipalEmail] = useState('');
  const [principalPassword, setPrincipalPassword] = useState('');

  const handleTeacherRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanId = teacherId.trim();
    if (!/^\d{4}$/.test(cleanId)) {
      setError('Teacher ID must be exactly 4 digits (e.g. 1001, 2045)');
      return;
    }

    if (!teacherName.trim()) {
      setError('Teacher name is required');
      return;
    }

    if (!teacherPassword || teacherPassword.length <= 6) {
      setError('Password must be more than 6 characters long');
      return;
    }

    setLoading(true);
    try {
      await registerTeacher({
        teacher_id: cleanId,
        name: teacherName.trim(),
        email: teacherEmail.trim() || `${cleanId}@smartclassroom.edu`,
        subject: teacherSubject.trim() || 'Computer Science',
        password: teacherPassword,
      });
      setSuccessMsg(`Teacher #${cleanId} registered successfully! Redirecting...`);
      setTimeout(() => navigate('/'), 1200);
    } catch (err) {
      setError(err.userMessage || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePrincipalRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanUser = principalUsername.trim().toLowerCase();
    if (!cleanUser || cleanUser.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (!principalPassword || principalPassword.length <= 6) {
      setError('Password must be more than 6 characters long');
      return;
    }

    setLoading(true);
    try {
      await registerPrincipal({
        username: cleanUser,
        name: principalName.trim() || 'Principal Office',
        email: principalEmail.trim() || `${cleanUser}@smartclassroom.edu`,
        password: principalPassword,
      });
      setSuccessMsg(`Principal account registered successfully! Redirecting...`);
      setTimeout(() => navigate('/'), 1200);
    } catch (err) {
      setError(err.userMessage || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Brand */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10 mb-6">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white shadow-xl shadow-indigo-500/25 mb-4">
          <GraduationCap className="h-9 w-9" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Create an Account
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Register as Teacher or School Administrator / Principal
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8">
          {/* Tabs */}
          <div className="flex rounded-xl bg-slate-800/80 p-1 mb-6 border border-slate-700/50">
            <button
              type="button"
              onClick={() => {
                setActiveTab('teacher');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'teacher'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              <span>Teacher Register</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('principal');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'principal'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="h-4 w-4" />
              <span>Principal Register</span>
            </button>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Teacher Form */}
          {activeTab === 'teacher' ? (
            <form onSubmit={handleTeacherRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Teacher ID <span className="text-indigo-400 font-bold">* (Must be exactly 4 digits)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={4}
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 2045"
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono tracking-wider"
                    required
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-mono">
                    {teacherId.length}/4
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Full Name <span className="text-indigo-400 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="e.g. Dr. Alan Turing"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Subject / Department
                </label>
                <input
                  type="text"
                  value={teacherSubject}
                  onChange={(e) => setTeacherSubject(e.target.value)}
                  placeholder="e.g. Deep Learning, Computer Vision"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  placeholder="teacher@smartclassroom.edu"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password <span className="text-indigo-400 font-bold">* (Length &gt; 6 characters)</span>
                </label>
                <input
                  type="password"
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value)}
                  placeholder="Minimum 7 characters"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center py-2.5 text-sm font-semibold mt-2"
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Register Teacher'}
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </form>
          ) : (
            /* Principal Form */
            <form onSubmit={handlePrincipalRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Username <span className="text-purple-400 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={principalUsername}
                  onChange={(e) => setPrincipalUsername(e.target.value)}
                  placeholder="e.g. principal_admin"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Full Name / Office Title
                </label>
                <input
                  type="text"
                  value={principalName}
                  onChange={(e) => setPrincipalName(e.target.value)}
                  placeholder="e.g. Principal Dr. Watson"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={principalEmail}
                  onChange={(e) => setPrincipalEmail(e.target.value)}
                  placeholder="principal@smartclassroom.edu"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password <span className="text-purple-400 font-bold">* (Length &gt; 6 characters)</span>
                </label>
                <input
                  type="password"
                  value={principalPassword}
                  onChange={(e) => setPrincipalPassword(e.target.value)}
                  placeholder="Minimum 7 characters"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center py-2.5 text-sm font-semibold mt-2 !bg-purple-600 hover:!bg-purple-500"
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Register Principal'}
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-indigo-400 hover:text-indigo-300 font-semibold underline"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
