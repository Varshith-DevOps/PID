'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import {
  assignLearningCourse,
  createLearningAssessment,
  createLearningCourse,
  createLearningPath,
  deleteLearningCourse,
  generateLearningCertificate,
  getDepartments,
  getEmployeeDesignations,
  getEmployees,
  getLearningCourses,
  getLearningDashboard,
  getLearningEnrollments,
  getLearningAssessments,
  getLearningKpiDashboard,
  getLearningKpas,
  getLearningSkills,
  getLearningPaths,
  getLearningReports,
  publishLearningCourse,
  createLearningKpi,
  createLearningKpa,
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

type LearningAssessment = {
  id: string;
  title: string;
  courseId: string;
  course?: { id: string; title: string; courseCode?: string };
  instructions?: string;
  maxMarks?: number;
  attemptLimit?: number;
  rubricJson?: string;
  submissions?: any[];
};

type LookupOption = { id: string; name: string };
type AssignmentTarget = 'EMPLOYEE' | 'MULTIPLE_EMPLOYEES' | 'DEPARTMENT' | 'DESIGNATION' | 'ORGANIZATION';

const tabs: TabItem[] = [
  { key: 'analytics', label: 'Analytics' },
  { key: 'courses', label: 'Courses' },
  { key: 'assessments', label: 'Assessments' },
  { key: 'kpi', label: 'KPI & KPA' },
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
const parseAssessmentConfig = (value?: string) => {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

function SearchableSelect({ label, value, onChange, options, placeholder, disabled, help }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  help?: string;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label || '';
  const [text, setText] = useState(selectedLabel);
  const listId = useMemo(() => `lookup-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, [label]);

  useEffect(() => {
    setText(selectedLabel);
  }, [selectedLabel]);

  return (
    <div className="form-group">
      <label className="form-label" htmlFor={listId}>{label}</label>
      <input
        id={listId}
        className="input-field"
        list={`${listId}-options`}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          const exact = options.find((option) => option.label === next);
          onChange(exact?.value || '');
        }}
      />
      <datalist id={`${listId}-options`}>
        {options.map((option) => <option key={option.value} value={option.label} />)}
      </datalist>
      {help && <span style={{ display: 'block', marginTop: 4, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{help}</span>}
    </div>
  );
}

export default function LearningPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('analytics');
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [assessments, setAssessments] = useState<LearningAssessment[]>([]);
  const [kpiDashboard, setKpiDashboard] = useState<any>({ kpis: [], assignments: [], summary: {} });
  const [kpas, setKpas] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [paths, setPaths] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<LookupOption[]>([]);
  const [designations, setDesignations] = useState<LookupOption[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [status, setStatus] = useState('');
  const [assessmentForm, setAssessmentForm] = useState({ courseId: '', title: '', instructions: '', passingScore: '70', durationMinutes: '30', maxAttempts: '1', maxMarks: '100' });
  const [assessmentQuestions, setAssessmentQuestions] = useState<any[]>([]);
  const [assessmentQuestion, setAssessmentQuestion] = useState({ question: '', questionType: 'MCQ', options: ['', '', '', ''], correctAnswer: 'A', marks: '1' });
  const [kpiForm, setKpiForm] = useState({ name: '', description: '', departmentId: '', designation: '', targetValue: '100', weightage: '0', kpaIds: [] as string[] });
  const [kpaForm, setKpaForm] = useState({ name: '', description: '', skillIds: [] as string[], courseIds: [] as string[] });
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
  const [assignmentForm, setAssignmentForm] = useState({
    courseId: '',
    targetType: 'EMPLOYEE' as AssignmentTarget,
    employeeId: '',
    employeeIds: [] as string[],
    departmentId: '',
    designationId: '',
    dueDate: '',
    priority: 'MEDIUM',
  });
  const [pathForm, setPathForm] = useState({ name: '', description: '', courseIds: [] as string[], pathType: 'SEQUENTIAL', targetType: 'COMPANY', targetValue: '' });

  const canCreateCourse = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '');
  const canAuthor = ['SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'].includes(user?.role || '');
  const canReport = ['SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'].includes(user?.role || '');
  const canManageKpi = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(user?.role || '');

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    if (canAuthor) setLookupsLoading(true);
    try {
      const [courseData, enrollmentData, dashboardData, pathData, assessmentData, kpiData, kpaData, skillData] = await Promise.all([
        getLearningCourses(),
        getLearningEnrollments(),
        getLearningDashboard(),
        getLearningPaths().catch(() => []),
        getLearningAssessments().catch(() => []),
        getLearningKpiDashboard().catch(() => ({ kpis: [], assignments: [], summary: {} })),
        getLearningKpas().catch(() => []),
        getLearningSkills().catch(() => []),
      ]);
      setCourses(courseData);
      setEnrollments(enrollmentData);
      setDashboard(dashboardData);
      setPaths(Array.isArray(pathData) ? pathData : []);
      setAssessments(Array.isArray(assessmentData) ? assessmentData : []);
      setKpiDashboard(kpiData || { kpis: [], assignments: [], summary: {} });
      setKpas(Array.isArray(kpaData) ? kpaData : []);
      setSkills(Array.isArray(skillData) ? skillData : []);
      if (canAuthor) {
        const [employeeData, departmentData, designationData] = await Promise.all([
          getEmployees({ status: 'active', limit: 500 }).catch(() => ({ employees: [] })),
          getDepartments().catch(() => []),
          getEmployeeDesignations().catch(() => []),
        ]);
        setEmployees(extractEmployeeArray(employeeData));
        setDepartments(Array.isArray(departmentData) ? departmentData : []);
        setDesignations(Array.isArray(designationData) ? designationData : []);
      }
      if (canReport) getLearningReports().then(setReports).catch(() => setReports(null));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load learning data.');
    } finally {
      setLoading(false);
      setLookupsLoading(false);
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
  const assessmentAvailable = enrollments.filter((row) => (row.progress || 0) >= 100 && !row.certificate).length;
  const publishedCourses = courses.filter((course) => course.status === 'PUBLISHED');
  const courseOptions = publishedCourses.map((course) => ({ value: course.id, label: `${course.title}${course.courseCode ? ` (${course.courseCode})` : ''}` }));
  const employeeOptions = employees.map((employee) => ({ value: employee.id, label: `${fullName(employee)}${employee.employeeId ? ` (${employee.employeeId})` : ''}` }));
  const departmentOptions = departments.map((department) => ({ value: department.id, label: department.name }));
  const designationOptions = designations.map((designation) => ({ value: designation.id, label: designation.name }));
  const filteredEmployees = employeeQuery.trim()
    ? employees.filter((employee) => [fullName(employee), employee.employeeId, employee.email, employee.department?.name, employee.jobTitle].filter(Boolean).join(' ').toLowerCase().includes(employeeQuery.trim().toLowerCase()))
    : employees;

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

  const handleAddAssessmentQuestion = () => {
    if (!assessmentQuestion.question.trim()) return setError('Question text is required.');
    const type = assessmentQuestion.questionType;
    const options = type === 'TRUE_FALSE' ? ['true', 'false'] : assessmentQuestion.options.filter(Boolean);
    if (['MCQ', 'MULTIPLE_ANSWER'].includes(type) && options.length < 2) return setError('Add at least two answer options.');
    if (!assessmentQuestion.correctAnswer.trim()) return setError('Correct answer is required.');
    setAssessmentQuestions([...assessmentQuestions, { ...assessmentQuestion, options, marks: Number(assessmentQuestion.marks) || 1, sortOrder: assessmentQuestions.length }]);
    setAssessmentQuestion({ question: '', questionType: 'MCQ', options: ['', '', '', ''], correctAnswer: 'A', marks: '1' });
  };

  const handleCreateAssessment = async () => {
    if (!assessmentForm.courseId || !assessmentForm.title.trim()) return setError('Select a course and enter an assessment title.');
    if (!assessmentQuestions.length) return setError('Add at least one assessment question.');
    setSaving(true);
    setError('');
    try {
      await createLearningAssessment(assessmentForm.courseId, {
        title: assessmentForm.title,
        instructions: assessmentForm.instructions,
        maxMarks: Number(assessmentForm.maxMarks) || 100,
        passingScore: Number(assessmentForm.passingScore) || 70,
        durationMinutes: Number(assessmentForm.durationMinutes) || 30,
        attemptLimit: Number(assessmentForm.maxAttempts) || 1,
        questions: assessmentQuestions.map((question) => ({
          ...question,
          correctAnswer: question.questionType === 'MULTIPLE_ANSWER'
            ? question.correctAnswer.split(',').map((answer: string) => answer.trim()).filter(Boolean)
            : question.correctAnswer,
        })),
      });
      setAssessmentForm({ courseId: '', title: '', instructions: '', passingScore: '70', durationMinutes: '30', maxAttempts: '1', maxMarks: '100' });
      setAssessmentQuestions([]);
      setSuccess('Assessment created successfully.');
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Assessment creation failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateKpa = async () => {
    if (!kpaForm.name.trim()) return setError('KPA name is required.');
    setSaving(true);
    try {
      await createLearningKpa(kpaForm);
      setKpaForm({ name: '', description: '', skillIds: [], courseIds: [] });
      setSuccess('KPA configured successfully.');
      await loadData();
    } catch (err: any) { setError(err?.response?.data?.error || 'KPA creation failed.'); }
    finally { setSaving(false); }
  };

  const handleCreateKpi = async () => {
    if (!kpiForm.name.trim()) return setError('KPI name is required.');
    setSaving(true);
    try {
      await createLearningKpi({ ...kpiForm, targetValue: Number(kpiForm.targetValue), weightage: Number(kpiForm.weightage) });
      setKpiForm({ name: '', description: '', departmentId: '', designation: '', targetValue: '100', weightage: '0', kpaIds: [] });
      setSuccess('KPI configured successfully.');
      await loadData();
    } catch (err: any) { setError(err?.response?.data?.error || 'KPI creation failed.'); }
    finally { setSaving(false); }
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
    const needsTarget = assignmentForm.targetType !== 'ORGANIZATION';
    const hasTarget = assignmentForm.targetType === 'EMPLOYEE'
      ? Boolean(assignmentForm.employeeId)
      : assignmentForm.targetType === 'MULTIPLE_EMPLOYEES'
        ? assignmentForm.employeeIds.length > 0
        : assignmentForm.targetType === 'DEPARTMENT'
          ? Boolean(assignmentForm.departmentId)
          : assignmentForm.targetType === 'DESIGNATION'
            ? Boolean(assignmentForm.designationId)
            : true;
    if (!assignmentForm.courseId || (needsTarget && !hasTarget)) return setError('Select a published course and assignment target.');
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        courseId: assignmentForm.courseId,
        dueDate: assignmentForm.dueDate || undefined,
        priority: assignmentForm.priority,
        assignmentType: assignmentForm.targetType === 'ORGANIZATION' ? 'COMPANY' : assignmentForm.targetType,
        notifyEmployees: true,
      };
      if (assignmentForm.targetType === 'EMPLOYEE') payload.employeeId = assignmentForm.employeeId;
      if (assignmentForm.targetType === 'MULTIPLE_EMPLOYEES') payload.employeeIds = assignmentForm.employeeIds;
      if (assignmentForm.targetType === 'DEPARTMENT') payload.departmentId = assignmentForm.departmentId;
      if (assignmentForm.targetType === 'DESIGNATION') payload.designationId = assignmentForm.designationId;
      await assignLearningCourse(payload);
      setAssignmentForm({ courseId: '', targetType: 'EMPLOYEE', employeeId: '', employeeIds: [], departmentId: '', designationId: '', dueDate: '', priority: 'MEDIUM' });
      setEmployeeQuery('');
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
          subtitle="Courses, learning paths, gated progress, approvals, certificates, skills, and analytics"
          icon={<div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #0f766e, #2563eb)' }}>LM</div>}
        />

        {error && <Banner tone="danger" title={error} action={<Button size="sm" variant="ghost" onClick={() => setError('')}>Dismiss</Button>} />}
        {success && <Banner tone="success" title={success} action={<Button size="sm" variant="ghost" onClick={() => setSuccess('')}>Dismiss</Button>} />}
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
              <StatCard label="Assessment Available" value={assessmentAvailable} />
              <StatCard label="Pass Rate" value={`${dashboard?.passRate || reports?.passRate || 0}%`} />
            </div>
            <div className="grid grid-2" style={{ marginTop: '1.5rem' }}>
              <Card title="Learning Portfolio">
                <ProgressBar label="Completion rate" value={enrollments.length ? Math.round((completed.length / enrollments.length) * 100) : 0} />
                <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
                  <div><strong>{courses.filter((course) => course.status === 'PUBLISHED').length}</strong> published courses</div>
                  <div><strong>{paths.length}</strong> learning paths configured</div>
                  <div><strong>{avgScore || 0}%</strong> average assessment score</div>
                  <div><strong>{dashboard?.pendingCertificates || 0}</strong> pending certificates</div>
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

        {activeTab === 'assessments' && (
          <div className="grid grid-2">
            {canCreateCourse && (
              <Card title="Create Assessment">
                <div className="form-grid">
                  <Select label="Course" value={assessmentForm.courseId} onChange={(v) => setAssessmentForm({ ...assessmentForm, courseId: v })} options={publishedCourses.map((course) => ({ value: course.id, label: course.title }))} />
                  <TextField label="Assessment Title" value={assessmentForm.title} onChange={(v) => setAssessmentForm({ ...assessmentForm, title: v })} />
                  <TextField label="Passing Percentage" value={assessmentForm.passingScore} restrict="digits" onChange={(v) => setAssessmentForm({ ...assessmentForm, passingScore: v })} />
                  <TextField label="Duration (minutes)" value={assessmentForm.durationMinutes} restrict="digits" onChange={(v) => setAssessmentForm({ ...assessmentForm, durationMinutes: v })} />
                  <TextField label="Maximum Attempts" value={assessmentForm.maxAttempts} restrict="digits" onChange={(v) => setAssessmentForm({ ...assessmentForm, maxAttempts: v })} />
                  <TextField label="Maximum Marks" value={assessmentForm.maxMarks} restrict="digits" onChange={(v) => setAssessmentForm({ ...assessmentForm, maxMarks: v })} />
                  <div style={{ gridColumn: '1 / -1' }}><Textarea label="Instructions" value={assessmentForm.instructions} onChange={(v) => setAssessmentForm({ ...assessmentForm, instructions: v })} /></div>
                </div>
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <h4>Add Question</h4>
                  <div className="form-grid">
                    <div style={{ gridColumn: '1 / -1' }}><Textarea label="Question" value={assessmentQuestion.question} onChange={(v) => setAssessmentQuestion({ ...assessmentQuestion, question: v })} /></div>
                    <Select label="Question Type" value={assessmentQuestion.questionType} onChange={(v) => setAssessmentQuestion({ ...assessmentQuestion, questionType: v, correctAnswer: v === 'TRUE_FALSE' ? 'true' : 'A' })} options={[{ value: 'MCQ', label: 'MCQ' }, { value: 'TRUE_FALSE', label: 'True/False' }, { value: 'MULTIPLE_ANSWER', label: 'Multiple Select' }, { value: 'SHORT_ANSWER', label: 'Short Answer' }]} />
                    <TextField label="Marks" value={assessmentQuestion.marks} restrict="digits" onChange={(v) => setAssessmentQuestion({ ...assessmentQuestion, marks: v })} />
                    {['MCQ', 'MULTIPLE_ANSWER'].includes(assessmentQuestion.questionType) && assessmentQuestion.options.map((option, index) => (
                      <TextField key={index} label={`Option ${String.fromCharCode(65 + index)}`} value={option} onChange={(v) => setAssessmentQuestion({ ...assessmentQuestion, options: assessmentQuestion.options.map((item, itemIndex) => itemIndex === index ? v : item) })} />
                    ))}
                    {assessmentQuestion.questionType === 'TRUE_FALSE' && <Select label="Correct Answer" value={assessmentQuestion.correctAnswer} onChange={(v) => setAssessmentQuestion({ ...assessmentQuestion, correctAnswer: v })} options={[{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }]} />}
                    {assessmentQuestion.questionType !== 'TRUE_FALSE' && <TextField label="Correct Answer" value={assessmentQuestion.correctAnswer} onChange={(v) => setAssessmentQuestion({ ...assessmentQuestion, correctAnswer: v })} help={assessmentQuestion.questionType === 'MULTIPLE_ANSWER' ? 'Use comma-separated option letters, for example A,B.' : undefined} />}
                  </div>
                  <Button size="sm" variant="ghost" style={{ marginTop: '0.75rem' }} onClick={handleAddAssessmentQuestion}>Add Question ({assessmentQuestions.length})</Button>
                  {assessmentQuestions.length > 0 && <div style={{ marginTop: '0.75rem' }}>{assessmentQuestions.map((question, index) => <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}><span>Q{index + 1}: {question.question}</span><Button size="sm" variant="danger" onClick={() => setAssessmentQuestions(assessmentQuestions.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button></div>)}</div>}
                </div>
                <Button style={{ marginTop: '1rem' }} loading={saving} onClick={handleCreateAssessment}>Create Assessment</Button>
              </Card>
            )}
            <Card title="Assessment History" padded={false} style={{ gridColumn: canCreateCourse ? undefined : '1 / -1' }}>
              <DataTable
                columns={[
                  { key: 'assessment', header: 'Assessment', render: (row: LearningAssessment) => <div><strong>{row.title}</strong><div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{row.course?.title || '-'}</div></div> },
                  { key: 'settings', header: 'Settings', render: (row: LearningAssessment) => { const config = parseAssessmentConfig(row.rubricJson); return `${config.passingScore || 70}% | ${config.timeLimitMins || 0} min | ${row.attemptLimit || 1} attempts`; } },
                  { key: 'attempts', header: 'Attempts', render: (row: LearningAssessment) => row.submissions?.length || 0 },
                  { key: 'action', header: '', align: 'right', render: (row: LearningAssessment) => <Button size="sm" variant="ghost" href={`/learning/courses/${row.courseId}?tab=assessments`}>Open Assessment</Button> },
                ]}
                rows={assessments}
                rowKey={(row: LearningAssessment) => row.id}
                emptyTitle="No assessments configured"
              />
              {assessments.some((assessment) => assessment.submissions?.length) && <div style={{ padding: '1rem 1.25rem' }}><h4>Recent Attempts</h4>{assessments.flatMap((assessment) => (assessment.submissions || []).slice(0, 10).map((submission: any) => <div key={submission.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}><span>{assessment.title} | {submission.employee ? `${submission.employee.firstName} ${submission.employee.lastName}` : 'Employee'}</span><span><StatusChip status={submission.status} /> {submission.marks ?? 'Pending'}</span></div>))}</div>}
            </Card>
          </div>
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

                    {activeTab === 'kpi' && (
                      <div className="grid grid-2">
                        {canManageKpi && (
                          <>
                            <Card title="Configure KPI">
                              <div className="form-grid">
                                <TextField label="KPI Name" value={kpiForm.name} onChange={(v) => setKpiForm({ ...kpiForm, name: v })} />
                                <Select label="Department" value={kpiForm.departmentId} onChange={(v) => setKpiForm({ ...kpiForm, departmentId: v })} options={[{ value: '', label: 'All departments' }, ...departments.map((item) => ({ value: item.id, label: item.name }))]} />
                                <TextField label="Designation" value={kpiForm.designation} onChange={(v) => setKpiForm({ ...kpiForm, designation: v })} />
                                <TextField label="Target Value" value={kpiForm.targetValue} restrict="decimal" onChange={(v) => setKpiForm({ ...kpiForm, targetValue: v })} />
                                <TextField label="Weightage" value={kpiForm.weightage} restrict="decimal" onChange={(v) => setKpiForm({ ...kpiForm, weightage: v })} />
                                <div style={{ gridColumn: '1 / -1' }}><Textarea label="Description" value={kpiForm.description} onChange={(v) => setKpiForm({ ...kpiForm, description: v })} /></div>
                              </div>
                              <div style={{ marginTop: '0.75rem' }}><strong>Map to KPAs</strong>{kpas.length ? kpas.map((kpa) => <label key={kpa.id} className="checkbox-label"><input type="checkbox" checked={kpiForm.kpaIds.includes(kpa.id)} onChange={(event) => setKpiForm({ ...kpiForm, kpaIds: event.target.checked ? [...kpiForm.kpaIds, kpa.id] : kpiForm.kpaIds.filter((id) => id !== kpa.id) })} />{kpa.name}</label>) : <p style={{ color: 'var(--text-muted)' }}>Create a KPA first.</p>}</div>
                              <Button style={{ marginTop: '1rem' }} loading={saving} onClick={handleCreateKpi}>Save KPI</Button>
                            </Card>
                            <Card title="Configure KPA">
                              <div className="form-grid">
                                <TextField label="KPA Name" value={kpaForm.name} onChange={(v) => setKpaForm({ ...kpaForm, name: v })} />
                                <div style={{ gridColumn: '1 / -1' }}><Textarea label="Description" value={kpaForm.description} onChange={(v) => setKpaForm({ ...kpaForm, description: v })} /></div>
                              </div>
                              <strong>Map to Courses</strong>
                              {courses.map((course) => <label key={course.id} className="checkbox-label"><input type="checkbox" checked={kpaForm.courseIds.includes(course.id)} onChange={(event) => setKpaForm({ ...kpaForm, courseIds: event.target.checked ? [...kpaForm.courseIds, course.id] : kpaForm.courseIds.filter((id) => id !== course.id) })} />{course.title}</label>)}
                              <strong style={{ display: 'block', marginTop: '0.75rem' }}>Map to Skills</strong>
                              {skills.length ? skills.map((skill) => <label key={skill.id} className="checkbox-label"><input type="checkbox" checked={kpaForm.skillIds.includes(skill.id)} onChange={(event) => setKpaForm({ ...kpaForm, skillIds: event.target.checked ? [...kpaForm.skillIds, skill.id] : kpaForm.skillIds.filter((id) => id !== skill.id) })} />{skill.name}</label>) : <p style={{ color: 'var(--text-muted)' }}>No Learning skills configured yet.</p>}
                              <Button style={{ marginTop: '1rem' }} loading={saving} onClick={handleCreateKpa}>Save KPA</Button>
                            </Card>
                          </>
                        )}
                        <Card title="KPI Performance Dashboard" style={{ gridColumn: canManageKpi ? '1 / -1' : undefined }}>
                          <div className="stat-grid">
                            <StatCard label="Configured KPIs" value={kpiDashboard.summary?.totalKpis || 0} />
                            <StatCard label="Employees Inherited" value={kpiDashboard.summary?.assignedEmployees || 0} />
                            <StatCard label="Average KPI Score" value={`${kpiDashboard.summary?.averageScore || 0}%`} />
                            <StatCard label="KPI Completion" value={`${kpiDashboard.summary?.averageCompletion || 0}%`} />
                          </div>
                          {kpiDashboard.assignments?.length ? <DataTable columns={[{ key: 'employee', header: 'Employee', render: (row: any) => row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : '-' }, { key: 'kpi', header: 'KPI', render: (row: any) => row.kpi?.name || '-' }, { key: 'department', header: 'Department', render: (row: any) => row.employee?.department?.name || row.kpi?.department?.name || 'All' }, { key: 'completion', header: 'Completion', render: (row: any) => <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ProgressBar value={row.completionPct || 0} height={6} /><span>{Math.round(row.completionPct || 0)}%</span></div> }, { key: 'score', header: 'Score', render: (row: any) => `${Math.round(row.score || 0)}%` }]} rows={kpiDashboard.assignments} rowKey={(row: any) => row.id} emptyTitle="No KPI assignments" /> : <EmptyState title="No KPI performance data" />}
                        </Card>
                        <Card title="KPA Catalogue" style={{ gridColumn: canManageKpi ? '1 / -1' : undefined }}>
                          {kpas.length ? kpas.map((kpa) => <div key={kpa.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border-subtle)' }}><strong>{kpa.name}</strong><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{(kpa.courses || []).map((item: any) => item.course?.title).filter(Boolean).join(', ') || 'No courses mapped'}{(kpa.skills || []).length ? ` | ${(kpa.skills || []).map((item: any) => item.skill?.name).filter(Boolean).join(', ')}` : ''}</div><div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Version {kpa.version || 1}</div></div>) : <EmptyState title="No KPAs configured" />}
                        </Card>
                      </div>
                    )}
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
                  <SearchableSelect label="Course" value={assignmentForm.courseId} onChange={(v) => setAssignmentForm({ ...assignmentForm, courseId: v })} placeholder={lookupsLoading ? 'Loading courses...' : 'Search published courses'} disabled={lookupsLoading || !publishedCourses.length} options={courseOptions} help={!lookupsLoading && !publishedCourses.length ? 'No published courses found.' : undefined} />
                  <Select
                    label="Assign To"
                    value={assignmentForm.targetType}
                    onChange={(v) => setAssignmentForm({ ...assignmentForm, targetType: v as AssignmentTarget, employeeId: '', employeeIds: [], departmentId: '', designationId: '' })}
                    options={[
                      { value: 'EMPLOYEE', label: 'One employee' },
                      { value: 'MULTIPLE_EMPLOYEES', label: 'Multiple employees' },
                      { value: 'DEPARTMENT', label: 'Department' },
                      { value: 'DESIGNATION', label: 'Designation' },
                      { value: 'ORGANIZATION', label: 'Entire organization' },
                    ]}
                  />
                  {assignmentForm.targetType === 'EMPLOYEE' && (
                    <SearchableSelect label="Employee" value={assignmentForm.employeeId} onChange={(v) => setAssignmentForm({ ...assignmentForm, employeeId: v })} placeholder={lookupsLoading ? 'Loading employees...' : 'Search active employees'} disabled={lookupsLoading || !employees.length} options={employeeOptions} help={!lookupsLoading && !employees.length ? 'No active employees found.' : undefined} />
                  )}
                  {assignmentForm.targetType === 'DEPARTMENT' && (
                    <SearchableSelect label="Department" value={assignmentForm.departmentId} onChange={(v) => setAssignmentForm({ ...assignmentForm, departmentId: v })} placeholder={lookupsLoading ? 'Loading departments...' : 'Search departments'} disabled={lookupsLoading || !departments.length} options={departmentOptions} help={!lookupsLoading && !departments.length ? 'No departments found.' : undefined} />
                  )}
                  {assignmentForm.targetType === 'DESIGNATION' && (
                    <SearchableSelect label="Designation" value={assignmentForm.designationId} onChange={(v) => setAssignmentForm({ ...assignmentForm, designationId: v })} placeholder={lookupsLoading ? 'Loading designations...' : 'Search designations'} disabled={lookupsLoading || !designations.length} options={designationOptions} help={!lookupsLoading && !designations.length ? 'No designations found.' : undefined} />
                  )}
                  <DateField label="Due Date" value={assignmentForm.dueDate} onChange={(v) => setAssignmentForm({ ...assignmentForm, dueDate: v })} />
                  <Select label="Priority" value={assignmentForm.priority} onChange={(v) => setAssignmentForm({ ...assignmentForm, priority: v })} options={[{ value: 'HIGH', label: 'High' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'LOW', label: 'Low' }]} />
                </div>
                {assignmentForm.targetType === 'MULTIPLE_EMPLOYEES' && (
                  <div style={{ marginTop: '1rem' }}>
                    <SearchInput value={employeeQuery} onChange={setEmployeeQuery} placeholder="Search active employees..." />
                    <div style={{ marginTop: '0.75rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', maxHeight: 260, overflowY: 'auto', padding: '0.35rem 0.75rem' }}>
                      {lookupsLoading ? <LoadingBlock label="Loading employees..." /> : filteredEmployees.length ? filteredEmployees.map((employee) => (
                        <label key={employee.id} className="checkbox-label" style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                          <input
                            type="checkbox"
                            checked={assignmentForm.employeeIds.includes(employee.id)}
                            onChange={(event) => setAssignmentForm({
                              ...assignmentForm,
                              employeeIds: event.target.checked
                                ? [...assignmentForm.employeeIds, employee.id]
                                : assignmentForm.employeeIds.filter((id) => id !== employee.id),
                            })}
                          />
                          <span>{fullName(employee)} <span style={{ color: 'var(--text-muted)' }}>{employee.employeeId ? `(${employee.employeeId})` : ''} {employee.department?.name || ''} {employee.jobTitle || ''}</span></span>
                        </label>
                      )) : <EmptyState title="No active employees found." />}
                    </div>
                  </div>
                )}
                {assignmentForm.targetType === 'ORGANIZATION' && (
                  <Banner tone="info" style={{ marginTop: '1rem' }}>This will assign the selected published course to every active employee.</Banner>
                )}
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
                { key: 'actions', header: '', align: 'right', render: (row: Enrollment) => row.certificate ? <Button size="sm" variant="ghost" href={`/api/learning/certificates/${row.certificate.id}/download`}>Download</Button> : <Button size="sm" onClick={async () => { try { await generateLearningCertificate(row.id); await loadData(); } catch (err: any) { setError(err?.response?.data?.error || 'Certificate generation failed.'); } }}>Generate</Button> },
              ]}
              rows={certificateRows}
              rowKey={(row: Enrollment) => row.id}
              emptyTitle="No certificate-enabled learning records"
            />
          </Card>
        )}

        {activeTab === 'reports' && canReport && (
          <div className="grid grid-2">
            <Card title="Assessment & Certificate KPIs">
              <div className="stat-grid">
                <StatCard label="Average Score" value={`${reports?.averageScore || dashboard?.averageScore || 0}%`} />
                <StatCard label="Pass Rate" value={`${reports?.passRate || dashboard?.passRate || 0}%`} />
                <StatCard label="Certificates Issued" value={reports?.certificatesIssued || dashboard?.certificatesIssued || 0} />
                <StatCard label="Pending Certificates" value={reports?.pendingCertificates || dashboard?.pendingCertificates || 0} />
              </div>
            </Card>
            <Card title="Assessment Results" padded={false}>
              <DataTable
                columns={[
                  { key: 'employee', header: 'Employee', render: (row: any) => row.employee ? `${row.employee.firstName || ''} ${row.employee.lastName || ''}`.trim() : row.employeeId },
                  { key: 'course', header: 'Course', render: (row: any) => row.assessment?.course?.title || '-' },
                  { key: 'score', header: 'Score', render: (row: any) => row.marks ?? 'Review' },
                  { key: 'attempt', header: 'Attempt', render: (row: any) => row.attemptNumber || 1 },
                  { key: 'status', header: 'Result', render: (row: any) => <StatusChip status={row.status || 'SUBMITTED'} /> },
                ]}
                rows={reports?.assessmentResults || dashboard?.assessmentResults || []}
                rowKey={(row: any) => row.id}
                emptyTitle="No assessment results"
              />
            </Card>
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
