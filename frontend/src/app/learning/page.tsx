'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import {
  assignLearningCourse,
  createLearningCourse,
  deleteLearningCourse,
  generateLearningCertificate,
  getEmployees,
  getLearningCourses,
  getLearningDashboard,
  getLearningEnrollments,
  getLearningReports,
  publishLearningCourse,
  updateLearningEnrollment,
} from '@/lib/api';
import {
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  DateField,
  EmptyState,
  FilterSelect,
  LoadingBlock,
  PageHeader,
  ProgressBar,
  SearchInput,
  Select,
  StatCard,
  StatusChip,
  Tabs,
  TextField,
  Textarea,
} from '@/components/ui';
import type { Column, TabItem } from '@/components/ui';

type Course = {
  id: string;
  title: string;
  courseCode?: string;
  category?: string;
  department?: string;
  difficulty?: string;
  durationMinutes?: number;
  instructor?: string;
  status?: string;
  certificateAvailable?: boolean;
  _count?: { enrollments?: number; materials?: number; quizzes?: number };
};

type Enrollment = {
  id: string;
  status: string;
  progress: number;
  timeSpentMins?: number;
  dueDate?: string | null;
  course?: Course;
  employee?: { id: string; employeeId: string; firstName: string; lastName: string; department?: { name: string }; jobTitle?: string };
  certificate?: { id: string; certificateNumber: string };
};

const tabs: TabItem[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'courses', label: 'Courses' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'progress', label: 'Progress' },
  { key: 'reports', label: 'Reports' },
];

const difficultyOptions = [
  { value: '', label: 'All difficulties' },
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
];

const extractEmployeeArray = (response: any): any[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.employees)) return response.employees;
  return [];
};

export default function LearningPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState('');
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [saving, setSaving] = useState(false);
  const [courseForm, setCourseForm] = useState({
    title: '',
    courseCode: '',
    category: 'Compliance',
    department: '',
    difficulty: 'BEGINNER',
    durationMinutes: '60',
    instructor: '',
    passingScore: '70',
    certificateAvailable: true,
    description: '',
  });
  const [assignmentForm, setAssignmentForm] = useState({ courseId: '', employeeId: '', department: '', dueDate: '', priority: 'MEDIUM' });

  const canCreateCourse = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '');
  const canAssign = ['SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'].includes(user?.role || '');
  const canReport = ['SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'].includes(user?.role || '');

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [courseData, enrollmentData, dashboardData] = await Promise.all([
        getLearningCourses(),
        getLearningEnrollments(),
        getLearningDashboard(),
      ]);
      setCourses(courseData);
      setEnrollments(enrollmentData);
      setDashboard(dashboardData);
      if (canAssign) {
        setEmployeesLoading(true);
        setEmployeesError('');
        getEmployees({ status: 'active', limit: 500 })
          .then((response) => setEmployees(extractEmployeeArray(response)))
          .catch(() => {
            setEmployees([]);
            setEmployeesError('Failed to load employees for assignment.');
          })
          .finally(() => setEmployeesLoading(false));
      }
      if (canReport) {
        getLearningReports().then(setReports).catch(() => setReports(null));
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load learning data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const filteredCourses = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesDifficulty = !difficulty || course.difficulty === difficulty;
      const haystack = [course.title, course.courseCode, course.category, course.department, course.instructor].filter(Boolean).join(' ').toLowerCase();
      return matchesDifficulty && (!needle || haystack.includes(needle));
    });
  }, [courses, difficulty, query]);

  const safeEmployees = Array.isArray(employees) ? employees : [];

  const handleCreateCourse = async () => {
    if (!courseForm.title.trim()) {
      setError('Course name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createLearningCourse({
        ...courseForm,
        durationMinutes: Number(courseForm.durationMinutes),
        passingScore: Number(courseForm.passingScore),
      });
      setCourseForm({ title: '', courseCode: '', category: 'Compliance', department: '', difficulty: 'BEGINNER', durationMinutes: '60', instructor: '', passingScore: '70', certificateAvailable: true, description: '' });
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Course creation failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    if (!assignmentForm.courseId || (!assignmentForm.employeeId && !assignmentForm.department)) {
      setError('Select a course and an employee or department.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await assignLearningCourse({
        ...assignmentForm,
        assignmentType: assignmentForm.employeeId ? 'EMPLOYEE' : 'DEPARTMENT',
        notifyEmployees: true,
      });
      setAssignmentForm({ courseId: '', employeeId: '', department: '', dueDate: '', priority: 'MEDIUM' });
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Assignment failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;
  if (loading && !dashboard) {
    return (
      <div className="app-layout">
        <Sidebar activePath="/learning" />
        <main className="main-content"><LoadingBlock label="Loading learning management..." /></main>
      </div>
    );
  }

  const courseColumns: Column<Course>[] = [
    { key: 'title', header: 'Course', render: (course) => <div><strong>{course.title}</strong><div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{course.courseCode || 'No code'} · {course.instructor || 'No instructor'}</div></div> },
    { key: 'category', header: 'Category', render: (course) => <Badge tone="info">{course.category || 'GENERAL'}</Badge> },
    { key: 'difficulty', header: 'Difficulty', render: (course) => <StatusChip status={course.difficulty || 'BEGINNER'} /> },
    { key: 'status', header: 'Status', render: (course) => <StatusChip status={course.status || 'DRAFT'} /> },
    { key: 'durationMinutes', header: 'Duration', render: (course) => `${course.durationMinutes || 0} min` },
    { key: 'enrollments', header: 'Assigned', render: (course) => course._count?.enrollments || 0 },
    ...(canCreateCourse ? [{
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (course: Course) => (
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
          {course.status !== 'PUBLISHED' && <Button size="sm" variant="success" onClick={async () => { await publishLearningCourse(course.id); loadData(); }}>Publish</Button>}
          <Button size="sm" variant="danger" onClick={async () => { await deleteLearningCourse(course.id); loadData(); }}>Archive</Button>
        </div>
      ),
    }] : []),
  ];

  const progressColumns: Column<Enrollment>[] = [
    { key: 'course', header: 'Course', render: (row) => <strong>{row.course?.title || '-'}</strong> },
    { key: 'employee', header: 'Employee', render: (row) => row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : 'Me' },
    { key: 'status', header: 'Status', render: (row) => <StatusChip status={row.status} /> },
    { key: 'progress', header: 'Progress', render: (row) => <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ProgressBar value={row.progress} height={6} /><span style={{ minWidth: 36 }}>{row.progress}%</span></div> },
    { key: 'timeSpentMins', header: 'Hours', render: (row) => ((row.timeSpentMins || 0) / 60).toFixed(1) },
    { key: 'dueDate', header: 'Due Date', render: (row) => row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '-' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
          {row.status !== 'COMPLETED' && <Button size="sm" onClick={async () => { await updateLearningEnrollment(row.id, { status: 'IN_PROGRESS', progress: Math.max(row.progress || 0, 25) }); loadData(); }}>Continue</Button>}
          {row.status !== 'COMPLETED' && <Button size="sm" variant="success" onClick={async () => { await updateLearningEnrollment(row.id, { status: 'COMPLETED', progress: 100 }); loadData(); }}>Complete</Button>}
          {row.course?.certificateAvailable && <Button size="sm" variant="ghost" onClick={async () => { await generateLearningCertificate(row.id); loadData(); }}>Certificate</Button>}
        </div>
      ),
    },
  ];

  return (
    <div className="app-layout">
      <Sidebar activePath="/learning" />
      <main className="main-content">
        <PageHeader
          title="Learning Management"
          subtitle="Courses, assignments, progress, quizzes, certificates, and reports"
          icon={<div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #0f766e, #2563eb)' }}>LM</div>}
        />

        {error && <Banner tone="danger" title={error} action={<Button size="sm" variant="ghost" onClick={() => setError('')}>Dismiss</Button>} />}

        <Tabs items={tabs.filter((tab) => canReport || tab.key !== 'reports')} value={activeTab} onChange={setActiveTab} style={{ margin: '1rem 0 1.25rem' }} />

        {activeTab === 'dashboard' && (
          <>
            <div className="stat-grid">
              <StatCard label="Total Courses" value={dashboard?.totalCourses || 0} />
              <StatCard label="Assigned Courses" value={dashboard?.assignedCourses || 0} />
              <StatCard label="Completed Courses" value={dashboard?.completedCourses || 0} />
              <StatCard label="In Progress" value={dashboard?.inProgress || 0} />
              <StatCard label="Certificates Earned" value={dashboard?.certificatesEarned || 0} />
              <StatCard label="Learning Hours" value={dashboard?.learningHours || 0} />
            </div>
            <div className="grid grid-2" style={{ marginTop: '1.5rem' }}>
              <Card title="Upcoming Training">
                {(dashboard?.upcomingTraining || []).length ? dashboard.upcomingTraining.map((item: Enrollment) => (
                  <div key={item.id} style={{ padding: '0.65rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <strong>{item.course?.title}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'No due date'}</div>
                  </div>
                )) : <EmptyState title="No upcoming training" />}
              </Card>
              <Card title="Recent Learning Activity">
                {(dashboard?.recentLearningActivity || []).length ? dashboard.recentLearningActivity.map((item: Enrollment) => (
                  <div key={item.id} style={{ padding: '0.65rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <strong>{item.course?.title}</strong>
                    <ProgressBar value={item.progress || 0} height={5} />
                  </div>
                )) : <EmptyState title="No recent activity" />}
              </Card>
            </div>
          </>
        )}

        {activeTab === 'courses' && (
          <div className="grid grid-2">
            {canCreateCourse && (
              <Card title="Create Course">
                <div className="form-grid">
                  <TextField label="Course Name" value={courseForm.title} required onChange={(v) => setCourseForm({ ...courseForm, title: v })} />
                  <TextField label="Course Code" value={courseForm.courseCode} onChange={(v) => setCourseForm({ ...courseForm, courseCode: v })} />
                  <TextField label="Category" value={courseForm.category} onChange={(v) => setCourseForm({ ...courseForm, category: v })} />
                  <TextField label="Department" value={courseForm.department} onChange={(v) => setCourseForm({ ...courseForm, department: v })} />
                  <Select label="Difficulty" value={courseForm.difficulty} onChange={(v) => setCourseForm({ ...courseForm, difficulty: v })} options={difficultyOptions.slice(1)} />
                  <TextField label="Duration Minutes" value={courseForm.durationMinutes} restrict="digits" onChange={(v) => setCourseForm({ ...courseForm, durationMinutes: v })} />
                  <TextField label="Instructor" value={courseForm.instructor} onChange={(v) => setCourseForm({ ...courseForm, instructor: v })} />
                  <TextField label="Passing Score" value={courseForm.passingScore} restrict="digits" onChange={(v) => setCourseForm({ ...courseForm, passingScore: v })} />
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Textarea label="Description" value={courseForm.description} onChange={(v) => setCourseForm({ ...courseForm, description: v })} />
                  </div>
                </div>
                <Button style={{ marginTop: '1rem' }} loading={saving} onClick={handleCreateCourse}>Create Course</Button>
              </Card>
            )}
            <Card title="Course Catalogue" padded={false} style={{ gridColumn: canCreateCourse ? undefined : '1 / -1' }}>
              <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem 1.25rem', flexWrap: 'wrap' }}>
                <SearchInput value={query} onChange={setQuery} placeholder="Search courses, instructors, departments..." />
                <FilterSelect value={difficulty} onChange={setDifficulty} options={difficultyOptions} />
              </div>
              <DataTable columns={courseColumns} rows={filteredCourses} rowKey={(course) => course.id} emptyTitle="No courses found" />
            </Card>
          </div>
        )}

        {activeTab === 'assignments' && (
          <Card title="Assign Course">
            {canAssign ? (
              <>
                <div className="form-grid">
                  <Select label="Course" value={assignmentForm.courseId} onChange={(v) => setAssignmentForm({ ...assignmentForm, courseId: v })} placeholder="Select course" options={courses.map((course) => ({ value: course.id, label: course.title }))} />
                  <Select label="Employee" value={assignmentForm.employeeId} onChange={(v) => setAssignmentForm({ ...assignmentForm, employeeId: v, department: '' })} placeholder={employeesLoading ? 'Loading employees...' : 'Optional employee'} options={safeEmployees.map((employee) => ({ value: employee.id, label: `${employee.firstName} ${employee.lastName}` }))} />
                  <TextField label="Department" value={assignmentForm.department} onChange={(v) => setAssignmentForm({ ...assignmentForm, department: v, employeeId: '' })} placeholder="Or department name" />
                  <DateField label="Due Date" value={assignmentForm.dueDate} onChange={(v) => setAssignmentForm({ ...assignmentForm, dueDate: v })} />
                  <Select label="Priority" value={assignmentForm.priority} onChange={(v) => setAssignmentForm({ ...assignmentForm, priority: v })} options={[{ value: 'HIGH', label: 'High' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'LOW', label: 'Low' }]} />
                </div>
                {employeesError && <Banner tone="warning" title={employeesError} action={<Button size="sm" variant="ghost" onClick={loadData}>Retry</Button>} />}
                <Button style={{ marginTop: '1rem' }} loading={saving} onClick={handleAssign}>Assign Course</Button>
              </>
            ) : <EmptyState title="Assignments are restricted" message="Your role can view and complete assigned learning." />}
          </Card>
        )}

        {activeTab === 'progress' && (
          <Card title="Learning Progress" padded={false}>
            <DataTable columns={progressColumns} rows={enrollments} rowKey={(row) => row.id} emptyTitle="No learning assignments" />
          </Card>
        )}

        {activeTab === 'reports' && canReport && (
          <div className="grid grid-2">
            <Card title="Department Completion" padded={false}>
              <DataTable
                columns={[
                  { key: 'department', header: 'Department' },
                  { key: 'assigned', header: 'Assigned' },
                  { key: 'completed', header: 'Completed' },
                ]}
                rows={reports?.departmentCompletion || []}
                rowKey={(row: any) => row.department}
                emptyTitle="No department report data"
              />
            </Card>
            <Card title="Pending Courses" padded={false}>
              <DataTable columns={progressColumns.slice(0, 4)} rows={reports?.pendingCourses || []} rowKey={(row: Enrollment) => row.id} emptyTitle="No pending courses" />
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
