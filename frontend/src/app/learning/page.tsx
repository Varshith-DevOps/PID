'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import {
  assignLearningCourse,
  createLearningCourse,
  createLearningPath,
  deleteLearningCourse,
  generateLearningCertificate,
  generateLearningCourseWithAi,
  getEmployees,
  getLearningCourses,
  getLearningDashboard,
  getLearningEnrollments,
  getLearningPaths,
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
  Toggle,
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
  estimatedHours?: number;
  instructor?: string;
  status?: string;
  thumbnailUrl?: string;
  learningObjectives?: string;
  prerequisites?: string;
  certificateAvailable?: boolean;
  _count?: { enrollments?: number; materials?: number; quizzes?: number };
};

type Enrollment = {
  id: string;
  status: string;
  progress: number;
  timeSpentMins?: number;
  dueDate?: string | null;
  completedAt?: string | null;
  course?: Course;
  employee?: { id: string; employeeId: string; firstName: string; lastName: string; department?: { name: string }; jobTitle?: string };
  certificate?: { id: string; certificateNumber: string; issuedAt?: string };
};

const tabs: TabItem[] = [
  { key: 'analytics', label: 'Analytics' },
  { key: 'courses', label: 'Courses' },
  { key: 'ai', label: 'AI Generator' },
  { key: 'paths', label: 'Learning Paths' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'progress', label: 'Progress' },
  { key: 'certificates', label: 'Certificates' },
  { key: 'reports', label: 'Reports' },
];

const difficultyOptions = [
  { value: '', label: 'All difficulties' },
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
];

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const fullName = (employee: any) => `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
const extractEmployeeArray = (response: any): any[] => Array.isArray(response) ? response : response?.employees || response?.data || [];

export default function LearningPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('analytics');
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [paths, setPaths] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [status, setStatus] = useState('');
  const [courseForm, setCourseForm] = useState({
    title: '',
    courseCode: '',
    category: 'Compliance',
    department: '',
    difficulty: 'BEGINNER',
    durationMinutes: '60',
    estimatedHours: '1',
    instructor: '',
    passingScore: '70',
    thumbnailUrl: '',
    prerequisites: '',
    learningObjectives: '',
    certificateAvailable: true,
    status: 'DRAFT',
    description: '',
  });
  const [assignmentForm, setAssignmentForm] = useState({ courseId: '', employeeId: '', department: '', designation: '', dueDate: '', priority: 'MEDIUM' });
  const [aiForm, setAiForm] = useState({ title: '', category: 'AI Generated', difficulty: 'BEGINNER', text: '' });
  const [aiFile, setAiFile] = useState<File>();
  const [pathForm, setPathForm] = useState({ name: '', description: '', courseIds: [] as string[], pathType: 'SEQUENTIAL', targetType: 'COMPANY', targetValue: '' });

  const canCreateCourse = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '');
  const canAuthor = ['SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'].includes(user?.role || '');
  const canReport = ['SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'].includes(user?.role || '');

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [courseData, enrollmentData, dashboardData, pathData] = await Promise.all([
        getLearningCourses(),
        getLearningEnrollments(),
        getLearningDashboard(),
        getLearningPaths().catch(() => []),
      ]);
      setCourses(courseData);
      setEnrollments(enrollmentData);
      setDashboard(dashboardData);
      setPaths(Array.isArray(pathData) ? pathData : []);
      if (canAuthor) getEmployees({ status: 'active', limit: 500 }).then((response) => setEmployees(extractEmployeeArray(response))).catch(() => setEmployees([]));
      if (canReport) getLearningReports().then(setReports).catch(() => setReports(null));
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
      const matchesStatus = !status || course.status === status;
      const haystack = [course.title, course.courseCode, course.category, course.department, course.instructor].filter(Boolean).join(' ').toLowerCase();
      return matchesDifficulty && matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [courses, difficulty, query, status]);

  const completed = enrollments.filter((row) => row.status === 'COMPLETED');
  const certificateRows = enrollments.filter((row) => row.certificate || row.course?.certificateAvailable);
  const avgProgress = enrollments.length ? Math.round(enrollments.reduce((sum, row) => sum + (row.progress || 0), 0) / enrollments.length) : 0;
  const avgScore = reports?.courseCompletion?.length ? Math.round((reports.courseCompletion.reduce((sum: number, row: any) => sum + (row.averageScore || 0), 0) / reports.courseCompletion.length) || 0) : dashboard?.averageScore || 0;

  const handleCreateCourse = async () => {
    if (!courseForm.title.trim()) return setError('Course name is required.');
    setSaving(true);
    setError('');
    try {
      await createLearningCourse({
        ...courseForm,
        durationMinutes: Number(courseForm.durationMinutes),
        estimatedHours: Number(courseForm.estimatedHours),
        passingScore: Number(courseForm.passingScore),
      });
      setCourseForm({ title: '', courseCode: '', category: 'Compliance', department: '', difficulty: 'BEGINNER', durationMinutes: '60', estimatedHours: '1', instructor: '', passingScore: '70', thumbnailUrl: '', prerequisites: '', learningObjectives: '', certificateAvailable: true, status: 'DRAFT', description: '' });
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Course creation failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateAiCourse = async () => {
    if (!aiForm.text.trim() && !aiFile) return setError('Provide source text or upload a file for AI generation.');
    setSaving(true);
    setError('');
    try {
      const payload = aiFile ? new FormData() : null;
      if (payload) {
        payload.append('file', aiFile);
        payload.append('title', aiForm.title);
        payload.append('category', aiForm.category);
        payload.append('difficulty', aiForm.difficulty);
        payload.append('text', aiForm.text);
      }
      await generateLearningCourseWithAi(payload || aiForm);
      setAiForm({ title: '', category: 'AI Generated', difficulty: 'BEGINNER', text: '' });
      setAiFile(undefined);
      await loadData();
      setActiveTab('courses');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'AI course generation failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePath = async () => {
    if (!pathForm.name.trim() || !pathForm.courseIds.length) return setError('Add a path name and at least one course.');
    setSaving(true);
    setError('');
    try {
      await createLearningPath(pathForm);
      setPathForm({ name: '', description: '', courseIds: [], pathType: 'SEQUENTIAL', targetType: 'COMPANY', targetValue: '' });
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Learning path creation failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    if (!assignmentForm.courseId || (!assignmentForm.employeeId && !assignmentForm.department && !assignmentForm.designation)) return setError('Select a course and assignment target.');
    setSaving(true);
    setError('');
    try {
      await assignLearningCourse({
        ...assignmentForm,
        assignmentType: assignmentForm.employeeId ? 'EMPLOYEE' : assignmentForm.department ? 'DEPARTMENT' : 'DESIGNATION',
        notifyEmployees: true,
      });
      setAssignmentForm({ courseId: '', employeeId: '', department: '', designation: '', dueDate: '', priority: 'MEDIUM' });
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Assignment failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;
  if (loading && !dashboard) {
    return <div className="app-layout"><Sidebar activePath="/learning" /><main className="main-content"><LoadingBlock label="Loading enterprise learning..." /></main></div>;
  }

  const courseColumns: Column<Course>[] = [
    { key: 'title', header: 'Course', render: (course) => <div><strong>{course.title}</strong><div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{course.courseCode || 'No code'} | {course.instructor || 'No instructor'}</div></div> },
    { key: 'category', header: 'Category', render: (course) => <Badge tone="info">{course.category || 'GENERAL'}</Badge> },
    { key: 'difficulty', header: 'Difficulty', render: (course) => <StatusChip status={course.difficulty || 'BEGINNER'} /> },
    { key: 'status', header: 'Status', render: (course) => <StatusChip status={course.status || 'DRAFT'} /> },
    { key: 'durationMinutes', header: 'Duration', render: (course) => `${course.durationMinutes || 0} min` },
    { key: 'assets', header: 'Assets', render: (course) => `${course._count?.materials || 0} files | ${course._count?.quizzes || 0} quizzes` },
    { key: 'assigned', header: 'Assigned', render: (course) => course._count?.enrollments || 0 },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (course) => (
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {canCreateCourse && course.status !== 'PUBLISHED' && <Button size="sm" variant="success" onClick={async () => { await publishLearningCourse(course.id); loadData(); }}>Publish</Button>}
          <Button size="sm" variant="ghost" href={`/learning/courses/${course.id}`}>Workspace</Button>
          {canCreateCourse && <Button size="sm" variant="danger" onClick={async () => { await deleteLearningCourse(course.id); loadData(); }}>Archive</Button>}
        </div>
      ),
    },
  ];

  const progressColumns: Column<Enrollment>[] = [
    { key: 'course', header: 'Course', render: (row) => <strong>{row.course?.title || '-'}</strong> },
    { key: 'employee', header: 'Employee', render: (row) => row.employee ? fullName(row.employee) : 'Me' },
    { key: 'status', header: 'Status', render: (row) => <StatusChip status={row.status} /> },
    { key: 'progress', header: 'Progress', render: (row) => <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 160 }}><ProgressBar value={row.progress || 0} height={6} /><span style={{ minWidth: 36 }}>{row.progress || 0}%</span></div> },
    { key: 'hours', header: 'Hours', render: (row) => ((row.timeSpentMins || 0) / 60).toFixed(1) },
    { key: 'dueDate', header: 'Due Date', render: (row) => row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '-' },
    { key: 'actions', header: '', align: 'right', render: (row) => <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}><Button size="sm" variant="ghost" href={row.course?.id ? `/learning/courses/${row.course.id}` : '/learning'}>Learn</Button>{row.status !== 'COMPLETED' && <Button size="sm" onClick={async () => { await updateLearningEnrollment(row.id, { status: 'IN_PROGRESS', progress: Math.max(row.progress || 0, 25) }); loadData(); }}>Start</Button>}</div> },
  ];

  return (
    <div className="app-layout">
      <Sidebar activePath="/learning" />
      <main className="main-content">
        <PageHeader
          title="Enterprise Learning Management"
          subtitle="AI course generation, learning paths, gated progress, approvals, certificates, skills, and analytics"
          icon={<div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #0f766e, #2563eb)' }}>LM</div>}
        />

        {error && <Banner tone="danger" title={error} action={<Button size="sm" variant="ghost" onClick={() => setError('')}>Dismiss</Button>} />}
        <Tabs items={tabs.filter((tab) => canReport || tab.key !== 'reports')} value={activeTab} onChange={setActiveTab} style={{ margin: '1rem 0 1.25rem' }} />

        {activeTab === 'analytics' && (
          <>
            <div className="stat-grid">
              <StatCard label="Total Courses" value={dashboard?.totalCourses || courses.length} />
              <StatCard label="Assigned Courses" value={dashboard?.assignedCourses || enrollments.length} />
              <StatCard label="Completed Courses" value={dashboard?.completedCourses || completed.length} />
              <StatCard label="Average Progress" value={`${avgProgress}%`} />
              <StatCard label="Learning Hours" value={dashboard?.learningHours || Math.round(enrollments.reduce((sum, row) => sum + (row.timeSpentMins || 0), 0) / 60)} />
              <StatCard label="Certificates" value={dashboard?.certificatesEarned || certificateRows.filter((row) => row.certificate).length} />
            </div>
            <div className="grid grid-2" style={{ marginTop: '1.5rem' }}>
              <Card title="Learning Portfolio">
                <ProgressBar label="Completion rate" value={enrollments.length ? Math.round((completed.length / enrollments.length) * 100) : 0} />
                <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
                  <div><strong>{courses.filter((course) => course.status === 'PUBLISHED').length}</strong> published courses</div>
                  <div><strong>{paths.length}</strong> learning paths configured</div>
                  <div><strong>{avgScore || 0}%</strong> average assessment score</div>
                </div>
              </Card>
              <Card title="Recent Learning Activity">
                {(dashboard?.recentLearningActivity || enrollments.slice(0, 5)).length ? (dashboard?.recentLearningActivity || enrollments.slice(0, 5)).map((item: Enrollment) => (
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
              <Card title="Create Enterprise Course">
                <div className="form-grid">
                  <TextField label="Course Name" value={courseForm.title} required onChange={(v) => setCourseForm({ ...courseForm, title: v })} />
                  <TextField label="Course Code" value={courseForm.courseCode} onChange={(v) => setCourseForm({ ...courseForm, courseCode: v })} />
                  <TextField label="Category" value={courseForm.category} onChange={(v) => setCourseForm({ ...courseForm, category: v })} />
                  <TextField label="Department" value={courseForm.department} onChange={(v) => setCourseForm({ ...courseForm, department: v })} />
                  <Select label="Difficulty" value={courseForm.difficulty} onChange={(v) => setCourseForm({ ...courseForm, difficulty: v })} options={difficultyOptions.slice(1)} />
                  <Select label="Status" value={courseForm.status} onChange={(v) => setCourseForm({ ...courseForm, status: v })} options={statusOptions.slice(1)} />
                  <TextField label="Duration Minutes" value={courseForm.durationMinutes} restrict="digits" onChange={(v) => setCourseForm({ ...courseForm, durationMinutes: v })} />
                  <TextField label="Estimated Hours" value={courseForm.estimatedHours} restrict="decimal" onChange={(v) => setCourseForm({ ...courseForm, estimatedHours: v })} />
                  <TextField label="Instructor" value={courseForm.instructor} onChange={(v) => setCourseForm({ ...courseForm, instructor: v })} />
                  <TextField label="Passing Score" value={courseForm.passingScore} restrict="digits" onChange={(v) => setCourseForm({ ...courseForm, passingScore: v })} />
                  <TextField label="Thumbnail URL" value={courseForm.thumbnailUrl} onChange={(v) => setCourseForm({ ...courseForm, thumbnailUrl: v })} />
                  <Toggle label="Certificate available" checked={courseForm.certificateAvailable} onChange={(v) => setCourseForm({ ...courseForm, certificateAvailable: v })} />
                  <div style={{ gridColumn: '1 / -1' }}><Textarea label="Learning Objectives" value={courseForm.learningObjectives} onChange={(v) => setCourseForm({ ...courseForm, learningObjectives: v })} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><Textarea label="Prerequisites" value={courseForm.prerequisites} onChange={(v) => setCourseForm({ ...courseForm, prerequisites: v })} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><Textarea label="Description" value={courseForm.description} onChange={(v) => setCourseForm({ ...courseForm, description: v })} /></div>
                </div>
                <Button style={{ marginTop: '1rem' }} loading={saving} onClick={handleCreateCourse}>Create Course</Button>
              </Card>
            )}
            <Card title="Course Catalogue" padded={false} style={{ gridColumn: canCreateCourse ? undefined : '1 / -1' }}>
              <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem 1.25rem', flexWrap: 'wrap' }}>
                <SearchInput value={query} onChange={setQuery} placeholder="Search courses, instructors, departments..." />
                <FilterSelect value={difficulty} onChange={setDifficulty} options={difficultyOptions} />
                <FilterSelect value={status} onChange={setStatus} options={statusOptions} />
              </div>
              <DataTable columns={courseColumns} rows={filteredCourses} rowKey={(course) => course.id} emptyTitle="No courses found" />
            </Card>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="grid grid-2">
            <Card title="AI Course Generator">
              {canAuthor ? (
                <>
                  <div className="form-grid">
                    <TextField label="Draft Title" value={aiForm.title} onChange={(v) => setAiForm({ ...aiForm, title: v })} />
                    <TextField label="Category" value={aiForm.category} onChange={(v) => setAiForm({ ...aiForm, category: v })} />
                    <Select label="Difficulty" value={aiForm.difficulty} onChange={(v) => setAiForm({ ...aiForm, difficulty: v })} options={difficultyOptions.slice(1)} />
                    <input type="file" accept=".pdf,.docx,.ppt,.pptx,.txt" onChange={(event) => setAiFile(event.target.files?.[0])} />
                    <div style={{ gridColumn: '1 / -1' }}><Textarea label="Source Text" value={aiForm.text} onChange={(v) => setAiForm({ ...aiForm, text: v })} /></div>
                  </div>
                  <Button style={{ marginTop: '1rem' }} loading={saving} onClick={handleGenerateAiCourse}>Generate Draft Course</Button>
                </>
              ) : <EmptyState title="AI generation is restricted" />}
            </Card>
            <Card title="Generated Drafts">
              {courses.filter((course) => course.category === 'AI Generated' || course.category === 'AI GENERATED').length ? courses.filter((course) => course.category === 'AI Generated' || course.category === 'AI GENERATED').map((course) => (
                <div key={course.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <div><strong>{course.title}</strong><div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{course.status}</div></div>
                  <Button size="sm" href={`/learning/courses/${course.id}`}>Edit</Button>
                </div>
              )) : <EmptyState title="No AI drafts yet" />}
            </Card>
          </div>
        )}

        {activeTab === 'paths' && (
          <div className="grid grid-2">
            <Card title="Create Learning Path">
              {canAuthor ? (
                <>
                  <div className="form-grid">
                    <TextField label="Path Name" value={pathForm.name} onChange={(v) => setPathForm({ ...pathForm, name: v })} />
                    <Select label="Path Type" value={pathForm.pathType} onChange={(v) => setPathForm({ ...pathForm, pathType: v })} options={[{ value: 'SEQUENTIAL', label: 'Sequential' }, { value: 'OPTIONAL', label: 'Optional' }, { value: 'MANDATORY', label: 'Mandatory' }]} />
                    <Select label="Target Type" value={pathForm.targetType} onChange={(v) => setPathForm({ ...pathForm, targetType: v })} options={[{ value: 'COMPANY', label: 'Organization' }, { value: 'DEPARTMENT', label: 'Department' }, { value: 'DESIGNATION', label: 'Designation' }]} />
                    <TextField label="Target Value" value={pathForm.targetValue} onChange={(v) => setPathForm({ ...pathForm, targetValue: v })} />
                    <div style={{ gridColumn: '1 / -1' }}><Textarea label="Description" value={pathForm.description} onChange={(v) => setPathForm({ ...pathForm, description: v })} /></div>
                  </div>
                  <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
                    {courses.map((course) => (
                      <label key={course.id} className="checkbox-label">
                        <input type="checkbox" checked={pathForm.courseIds.includes(course.id)} onChange={(event) => setPathForm({ ...pathForm, courseIds: event.target.checked ? [...pathForm.courseIds, course.id] : pathForm.courseIds.filter((id) => id !== course.id) })} />
                        {course.title}
                      </label>
                    ))}
                  </div>
                  <Button style={{ marginTop: '1rem' }} loading={saving} onClick={handleCreatePath}>Create Path</Button>
                </>
              ) : <EmptyState title="Learning paths are restricted" />}
            </Card>
            <Card title="Active Paths">
              {paths.length ? paths.map((path) => (
                <div key={path.id} style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}><strong>{path.name}</strong><StatusChip status={path.status || 'ACTIVE'} /></div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>{(path.courses || []).map((item: any) => item.course?.title).filter(Boolean).join(' -> ') || 'No courses linked'}</div>
                </div>
              )) : <EmptyState title="No learning paths" />}
            </Card>
          </div>
        )}

        {activeTab === 'assignments' && (
          <Card title="Assign Course">
            {canAuthor ? (
              <>
                <div className="form-grid">
                  <Select label="Course" value={assignmentForm.courseId} onChange={(v) => setAssignmentForm({ ...assignmentForm, courseId: v })} placeholder="Select course" options={courses.map((course) => ({ value: course.id, label: course.title }))} />
                  <Select label="Employee" value={assignmentForm.employeeId} onChange={(v) => setAssignmentForm({ ...assignmentForm, employeeId: v, department: '', designation: '' })} placeholder="Optional employee" options={employees.map((employee) => ({ value: employee.id, label: fullName(employee) }))} />
                  <TextField label="Department" value={assignmentForm.department} onChange={(v) => setAssignmentForm({ ...assignmentForm, department: v, employeeId: '', designation: '' })} />
                  <TextField label="Designation" value={assignmentForm.designation} onChange={(v) => setAssignmentForm({ ...assignmentForm, designation: v, employeeId: '', department: '' })} />
                  <DateField label="Due Date" value={assignmentForm.dueDate} onChange={(v) => setAssignmentForm({ ...assignmentForm, dueDate: v })} />
                  <Select label="Priority" value={assignmentForm.priority} onChange={(v) => setAssignmentForm({ ...assignmentForm, priority: v })} options={[{ value: 'HIGH', label: 'High' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'LOW', label: 'Low' }]} />
                </div>
                <Button style={{ marginTop: '1rem' }} loading={saving} onClick={handleAssign}>Assign Course</Button>
              </>
            ) : <EmptyState title="Assignments are restricted" />}
          </Card>
        )}

        {activeTab === 'progress' && <Card title="Time-Gated Learning Progress" padded={false}><DataTable columns={progressColumns} rows={enrollments} rowKey={(row) => row.id} emptyTitle="No learning assignments" /></Card>}

        {activeTab === 'certificates' && (
          <Card title="Certificates" padded={false}>
            <DataTable
              columns={[
                { key: 'course', header: 'Course', render: (row: Enrollment) => row.course?.title || '-' },
                { key: 'employee', header: 'Employee', render: (row: Enrollment) => row.employee ? fullName(row.employee) : 'Me' },
                { key: 'number', header: 'Certificate Number', render: (row: Enrollment) => row.certificate?.certificateNumber || 'Not issued' },
                { key: 'status', header: 'Status', render: (row: Enrollment) => row.certificate ? <StatusChip status="ISSUED" /> : <StatusChip status="PENDING" /> },
                { key: 'actions', header: '', align: 'right', render: (row: Enrollment) => row.certificate ? <Button size="sm" variant="ghost" href={`/api/learning/certificates/${row.certificate.id}/download`}>Download</Button> : <Button size="sm" onClick={async () => { await generateLearningCertificate(row.id); loadData(); }}>Generate</Button> },
              ]}
              rows={certificateRows}
              rowKey={(row: Enrollment) => row.id}
              emptyTitle="No certificate-enabled learning records"
            />
          </Card>
        )}

        {activeTab === 'reports' && canReport && (
          <div className="grid grid-2">
            <Card title="Department Completion" padded={false}>
              <DataTable columns={[{ key: 'department', header: 'Department' }, { key: 'assigned', header: 'Assigned' }, { key: 'completed', header: 'Completed' }]} rows={reports?.departmentCompletion || []} rowKey={(row: any) => row.department} emptyTitle="No department report data" />
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
