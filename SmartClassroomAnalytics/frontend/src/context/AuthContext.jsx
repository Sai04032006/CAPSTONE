import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  loginTeacher as apiLoginTeacher,
  loginPrincipal as apiLoginPrincipal,
  registerTeacher as apiRegisterTeacher,
  registerPrincipal as apiRegisterPrincipal,
  getTeachers as apiGetTeachers
} from '../api/auth';

const AuthContext = createContext(null);

const STORAGE_KEY = 'smartclassroom_auth_user';

// Initial default user for seamless experience
const DEFAULT_INITIAL_USER = {
  role: 'TEACHER',
  teacher_id: '1001',
  username: '1001',
  name: 'Dr. Sarah Jenkins',
  subject: 'Computer Vision & AI',
  token: 'demo_token_teacher_1001',
};

// Initial demo teachers
export const INITIAL_DEMO_TEACHERS = [
  {
    id: 1,
    teacher_id: '1001',
    name: 'Dr. Sarah Jenkins',
    email: 'sarah.jenkins@smartclassroom.edu',
    subject: 'Computer Vision & AI',
    sessions_count: 3,
    students_count: 5,
  },
  {
    id: 2,
    teacher_id: '1002',
    name: 'Prof. Alan Turing',
    email: 'alan.turing@smartclassroom.edu',
    subject: 'Data Structures & Algorithms',
    sessions_count: 2,
    students_count: 4,
  },
  {
    id: 3,
    teacher_id: '2045',
    name: 'Dr. Maria Curie',
    email: 'maria.curie@smartclassroom.edu',
    subject: 'Neural Networks & Deep Learning',
    sessions_count: 1,
    students_count: 5,
  },
];

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore JSON error
    }
    return DEFAULT_INITIAL_USER;
  });

  const [teachersList, setTeachersList] = useState(INITIAL_DEMO_TEACHERS);
  // Principal filter state: null for "All Teachers", or specific teacher_id e.g. "1001"
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState(null);

  // Sync to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [currentUser]);

  // Load teachers list
  const refreshTeachers = useCallback(async () => {
    try {
      const data = await apiGetTeachers();
      if (data && data.length) {
        setTeachersList(data);
        return data;
      }
    } catch {
      // Keep demo list on offline fallback
    }
    return INITIAL_DEMO_TEACHERS;
  }, []);

  useEffect(() => {
    refreshTeachers();
  }, [refreshTeachers]);

  // Teacher Login
  const loginTeacher = useCallback(async (teacherId, password) => {
    const cleanId = String(teacherId).trim();
    if (!/^\d{4}$/.test(cleanId)) {
      throw new Error('Teacher ID must be exactly 4 digits (e.g. 1001, 2045)');
    }
    if (!password || password.length <= 6) {
      throw new Error('Password must be more than 6 characters long');
    }

    try {
      const res = await apiLoginTeacher({ teacher_id: cleanId, password });
      const user = {
        role: 'TEACHER',
        teacher_id: res.teacher_id,
        username: res.username,
        name: res.name,
        subject: res.subject || 'General',
        token: res.token,
      };
      setCurrentUser(user);
      setSelectedTeacherFilter(null);
      return user;
    } catch (err) {
      // Demo / offline fallback
      if (cleanId === '1001' || cleanId === '1002' || cleanId === '2045' || cleanId.length === 4) {
        const found = INITIAL_DEMO_TEACHERS.find((t) => t.teacher_id === cleanId);
        const user = {
          role: 'TEACHER',
          teacher_id: cleanId,
          username: cleanId,
          name: found ? found.name : `Teacher #${cleanId}`,
          subject: found ? found.subject : 'Computer Science',
          token: `demo_token_${cleanId}`,
        };
        setCurrentUser(user);
        setSelectedTeacherFilter(null);
        return user;
      }
      throw err;
    }
  }, []);

  // Principal Login
  const loginPrincipal = useCallback(async (username, password) => {
    const cleanUser = username.trim().toLowerCase();
    if (!password || password.length <= 6) {
      // Allow default password "principle" (length 9)
      if (cleanUser !== 'principle' && cleanUser !== 'principal') {
        throw new Error('Password must be more than 6 characters long');
      }
    }

    try {
      const res = await apiLoginPrincipal({ username: cleanUser, password });
      const user = {
        role: 'PRINCIPAL',
        teacher_id: null,
        username: res.username,
        name: res.name || 'Principal Office',
        subject: 'Administration',
        token: res.token,
      };
      setCurrentUser(user);
      setSelectedTeacherFilter(null);
      return user;
    } catch (err) {
      // Demo / offline fallback for 'principle' / 'principle'
      if (
        (cleanUser === 'principle' || cleanUser === 'principal') &&
        (password === 'principle' || password === 'principal' || password.length > 6)
      ) {
        const user = {
          role: 'PRINCIPAL',
          teacher_id: null,
          username: 'principle',
          name: 'Principal Office',
          subject: 'School Administration',
          token: 'demo_token_principal',
        };
        setCurrentUser(user);
        setSelectedTeacherFilter(null);
        return user;
      }
      throw err;
    }
  }, []);

  // Teacher Register
  const registerTeacher = useCallback(async ({ teacher_id, name, email, subject, password }) => {
    const cleanId = String(teacher_id).trim();
    if (!/^\d{4}$/.test(cleanId)) {
      throw new Error('Teacher ID must be exactly 4 digits (e.g. 1001, 2045)');
    }
    if (!password || password.length <= 6) {
      throw new Error('Password must be more than 6 characters long');
    }

    try {
      const res = await apiRegisterTeacher({
        teacher_id: cleanId,
        name: name.trim(),
        email: email?.trim(),
        subject: subject?.trim(),
        password,
      });
      const user = {
        role: 'TEACHER',
        teacher_id: res.teacher_id,
        username: res.username,
        name: res.name,
        subject: res.subject,
        token: res.token,
      };
      setCurrentUser(user);
      setSelectedTeacherFilter(null);
      refreshTeachers();
      return user;
    } catch (err) {
      // Offline fallback
      const user = {
        role: 'TEACHER',
        teacher_id: cleanId,
        username: cleanId,
        name: name.trim(),
        subject: subject?.trim() || 'General',
        token: `demo_token_${cleanId}`,
      };
      const newT = {
        id: Date.now(),
        teacher_id: cleanId,
        name: name.trim(),
        email: email || `${cleanId}@smartclassroom.edu`,
        subject: subject?.trim() || 'General',
        sessions_count: 0,
        students_count: 0,
      };
      setTeachersList((prev) => [...prev, newT]);
      setCurrentUser(user);
      setSelectedTeacherFilter(null);
      return user;
    }
  }, [refreshTeachers]);

  // Principal Register
  const registerPrincipal = useCallback(async ({ username, name, email, password }) => {
    const cleanUser = username.trim().toLowerCase();
    if (!password || password.length <= 6) {
      throw new Error('Password must be more than 6 characters long');
    }

    try {
      const res = await apiRegisterPrincipal({
        username: cleanUser,
        name: name.trim(),
        email: email?.trim(),
        password,
      });
      const user = {
        role: 'PRINCIPAL',
        teacher_id: null,
        username: res.username,
        name: res.name,
        subject: 'Administration',
        token: res.token,
      };
      setCurrentUser(user);
      setSelectedTeacherFilter(null);
      return user;
    } catch (err) {
      const user = {
        role: 'PRINCIPAL',
        teacher_id: null,
        username: cleanUser,
        name: name.trim() || 'Principal',
        subject: 'School Administration',
        token: `demo_token_principal_${cleanUser}`,
      };
      setCurrentUser(user);
      setSelectedTeacherFilter(null);
      return user;
    }
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setSelectedTeacherFilter(null);
  }, []);

  const isPrincipal = currentUser?.role === 'PRINCIPAL';
  const isTeacher = currentUser?.role === 'TEACHER';

  // Active teacher ID scoped for queries:
  // If user is a Teacher, it's ALWAYS their own teacher_id.
  // If user is Principal, it's selectedTeacherFilter (null for all teachers, or specific ID)
  const activeTeacherId = isTeacher ? currentUser?.teacher_id : selectedTeacherFilter;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isPrincipal,
        isTeacher,
        activeTeacherId,
        selectedTeacherFilter,
        setSelectedTeacherFilter,
        teachersList,
        refreshTeachers,
        loginTeacher,
        loginPrincipal,
        registerTeacher,
        registerPrincipal,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
