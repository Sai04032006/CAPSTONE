import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  GraduationCap,
  Shield,
  UserCheck,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginTeacher, loginPrincipal } = useAuth();

  const [activeTab, setActiveTab] = useState('teacher'); // 'teacher' | 'principal'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Teacher fields
  const [teacherId, setTeacherId] = useState('1001');
  const [teacherPassword, setTeacherPassword] = useState('teacher123');

  // Principal fields
  const [principalUsername, setPrincipalUsername] = useState('principle');
  const [principalPassword, setPrincipalPassword] = useState('principle');

  const handleTeacherLogin = async (e) => {
    e.preventDefault();
    setError(null);
    if (!teacherId || teacherId.trim().length !== 4 || !/^\d{4}$/.test(teacherId.trim())) {
      setError('Teacher ID must be exactly 4 digits (e.g. 1001, 2045)');
      return;
    }
    if (!teacherPassword || teacherPassword.length <= 6) {
      setError('Password must be more than 6 characters long');
      return;
    }

    setLoading(true);
    try {
      await loginTeacher(teacherId.trim(), teacherPassword);
      navigate('/');
    } catch (err) {
      setError(err.userMessage || err.message || 'Invalid teacher credentials');
    } finally {
      setLoading(false);
    }
  };

  const handlePrincipalLogin = async (e) => {
    e.preventDefault();
    setError(null);
    if (!principalUsername.trim()) {
      setError('Username cannot be empty');
      return;
    }

    setLoading(true);
    try {
      await loginPrincipal(principalUsername.trim(), principalPassword);
      navigate('/');
    } catch (err) {
      setError(err.userMessage || err.message || 'Invalid principal credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[300px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10 mb-6">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white shadow-xl shadow-indigo-500/25 mb-4">
          <GraduationCap className="h-9 w-9" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          SmartClassroom <span className="text-indigo-400">AI</span>
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Intelligent Classroom Analytics & Attendance Platform
        </p>
      </div>

      {/* Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8">
          {/* Tabs */}
          <div className="flex rounded-xl bg-slate-800/80 p-1 mb-6 border border-slate-700/50">
            <button
              type="button"
              onClick={() => {
                setActiveTab('teacher');
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'teacher'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck className="h-4 w-4" />
              <span>Teacher Login</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('principal');
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'principal'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="h-4 w-4" />
              <span>Principal (Admin)</span>
            </button>
          </div>

          {/* Error notice */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Tab 1: Teacher Login Form */}
          {activeTab === 'teacher' ? (
            <form onSubmit={handleTeacherLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Teacher ID <span className="text-indigo-400">(Exactly 4 Digits)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={4}
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 1001"
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono tracking-wider"
                    required
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-mono">
                    {teacherId.length}/4
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Teachers only have access to their own sessions and their own students.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password <span className="text-slate-500 font-normal">(&gt; 6 characters)</span>
                </label>
                <input
                  type="password"
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center py-2.5 text-sm font-semibold mt-2"
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Sign in as Teacher'}
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>

              {/* Quick Preset Buttons */}
              <div className="pt-2 border-t border-slate-800">
                <p className="text-[11px] font-medium text-slate-400 mb-2">Quick test credentials:</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherId('1001');
                      setTeacherPassword('teacher123');
                    }}
                    className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-[11px] text-indigo-300 text-center"
                  >
                    Teacher 1001 (CV & AI)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherId('1002');
                      setTeacherPassword('teacher123');
                    }}
                    className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-[11px] text-indigo-300 text-center"
                  >
                    Teacher 1002 (DSA)
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Tab 2: Principal Login Form */
            <form onSubmit={handlePrincipalLogin} className="space-y-4">
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-purple-400" />
                <span>
                  Default Credentials: <strong>username: principle</strong> / <strong>password: principle</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Principal Username
                </label>
                <input
                  type="text"
                  value={principalUsername}
                  onChange={(e) => setPrincipalUsername(e.target.value)}
                  placeholder="principle"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={principalPassword}
                  onChange={(e) => setPrincipalPassword(e.target.value)}
                  placeholder="principle"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center py-2.5 text-sm font-semibold mt-2 !bg-purple-600 hover:!bg-purple-500 !shadow-purple-600/30"
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Sign in as Principal'}
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setPrincipalUsername('principle');
                    setPrincipalPassword('principle');
                  }}
                  className="text-xs text-purple-400 hover:text-purple-300 underline cursor-pointer"
                >
                  Click to fill default credentials (principle / principle)
                </button>
              </div>
            </form>
          )}

          {/* Switch to Register */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Need a new teacher or principal account?{' '}
              <Link
                to="/register"
                className="text-indigo-400 hover:text-indigo-300 font-semibold underline"
              >
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
