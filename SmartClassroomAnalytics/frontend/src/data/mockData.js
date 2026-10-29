// Realistic fallback/demo data matching PostgreSQL database records and backend schemas

export const INITIAL_STUDENTS = [
  {
    id: 1,
    student_id: '2300033017',
    name: 'P.Sai Lokesh',
    email: '2300033017@smartclassroom.edu',
  },
  {
    id: 2,
    student_id: '2300032314',
    name: 'Guna Vardhan Reddy',
    email: '2300032314@smartclassroom.edu',
  },
  {
    id: 3,
    student_id: '2300030028',
    name: 'Dinesh Karthik',
    email: '2300030028@smartclassroom.edu',
  },
  {
    id: 4,
    student_id: '2300031189',
    name: 'Jairaj reddy',
    email: '2300031189@smartclassroom.edu',
  },
  {
    id: 5,
    student_id: '230005678',
    name: 'sdi',
    email: '230005678@smartclassroom.edu',
  },
];

export const INITIAL_SESSIONS = [
  {
    id: 1,
    subject: 'Computer Vision & AI',
    duration_minutes: 50,
    attendance_threshold: 0.70,
    started_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    ended_at: new Date(Date.now() - 3600000).toISOString(),
    status: 'COMPLETED',
  },
  {
    id: 2,
    subject: 'Data Structures & Algorithms',
    duration_minutes: 50,
    attendance_threshold: 0.70,
    started_at: new Date(Date.now() - 1800000).toISOString(),
    ended_at: null,
    status: 'ACTIVE',
  },
];

export const INITIAL_ATTENDANCE = [
  {
    id: 1,
    session_id: 1,
    student_id: '2300033017',
    presence_seconds: 2400.0,
    presence_percentage: 80.0,
    status: 'PRESENT',
  },
  {
    id: 2,
    session_id: 1,
    student_id: '2300032314',
    presence_seconds: 2250.0,
    presence_percentage: 75.0,
    status: 'PRESENT',
  },
  {
    id: 3,
    session_id: 1,
    student_id: '2300030028',
    presence_seconds: 2310.0,
    presence_percentage: 77.0,
    status: 'PRESENT',
  },
  {
    id: 4,
    session_id: 1,
    student_id: '2300031189',
    presence_seconds: 1200.0,
    presence_percentage: 40.0,
    status: 'ABSENT',
  },
  {
    id: 5,
    session_id: 1,
    student_id: '230005678',
    presence_seconds: 2150.0,
    presence_percentage: 71.67,
    status: 'PRESENT',
  },
  // Active session 2
  {
    id: 6,
    session_id: 2,
    student_id: '2300033017',
    presence_seconds: 1500.0,
    presence_percentage: 50.0,
    status: 'ABSENT', // will become PRESENT at 70% (2100s)
  },
  {
    id: 7,
    session_id: 2,
    student_id: '2300032314',
    presence_seconds: 1620.0,
    presence_percentage: 54.0,
    status: 'ABSENT',
  },
  {
    id: 8,
    session_id: 2,
    student_id: '2300030028',
    presence_seconds: 2200.0,
    presence_percentage: 73.33,
    status: 'PRESENT',
  },
];

export const INITIAL_BEHAVIOR = [
  {
    id: 1,
    session_id: 1,
    student_id: '2300031189',
    behavior: 'CELL_PHONE_USAGE',
    start_time: new Date(Date.now() - 3600000 * 1.8).toISOString(),
    end_time: new Date(Date.now() - 3600000 * 1.7).toISOString(),
    duration_seconds: 360.0,
    severity: 'WARNING',
    status: 'RESOLVED',
    created_at: new Date(Date.now() - 3600000 * 1.8).toISOString(),
  },
  {
    id: 2,
    session_id: 2,
    student_id: '2300033017',
    behavior: 'CELL_PHONE_USAGE',
    start_time: new Date(Date.now() - 600000).toISOString(),
    end_time: null,
    duration_seconds: 45.0,
    severity: 'WARNING',
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 600000).toISOString(),
  },
];
