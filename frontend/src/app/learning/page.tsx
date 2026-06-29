'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import { createLearningCourse, getLearningCourses, getLearningEnrollments } from '@/lib/api';
import { required } from '@/lib/validators';
import {
  Button,
  Card,
  DataTable,
  Banner,
  EmptyState,
  PageHeader,
  ProgressBar,
  Select,
  StatusChip,
  TextField,
  Textarea,
} from '@/components/ui';
import type { Column } from '@/components/ui';

interface EnrollmentRow extends Record<string, unknown> {
  id: string;
  status: string;
  progress: number;
  dueDate?: string | null;
  course?: { title: string };
}

const LEARNING_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
);

export default function LearningPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [form, setForm] = useState({ title: '', category: 'Compliance', description: '' });
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      setCourses(await getLearningCourses());
      setEnrollments(await getLearningEnrollments());
    } catch (err) {
      console.error(err);
      setError('Failed to load learning data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!form.title.trim()) { setFormError('Course title is required.'); return; }
    if (!form.description.trim()) { setFormError('Description is required.'); return; }
    setFormError('');
    setSaving(true);
    try {
      await createLearningCourse(form);
      setForm({ title: '', category: 'Compliance', description: '' });
      setSubmitted(false);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const canManageLearning = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(user.role);

  const enrollmentColumns: Column<EnrollmentRow>[] = [
    { key: 'course', header: 'Course', render: (e) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.course?.title || '—'}</span> },
    { key: 'status', header: 'Status', align: 'center', render: (e) => <StatusChip status={e.status} /> },
    {
      key: 'progress',
      header: 'Progress',
      width: 180,
      render: (e) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ flex: 1 }}>
            <ProgressBar value={e.progress} tone={e.progress >= 100 ? 'success' : 'accent'} height={6} />
          </div>
          <span style={{ fontWeight: 700, minWidth: 38, textAlign: 'right', color: 'var(--text-secondary)' }}>{e.progress}%</span>
        </div>
      ),
    },
    { key: 'dueDate', header: 'Due Date', render: (e) => (e.dueDate ? new Date(e.dueDate).toLocaleDateString() : '—') },
  ];

  return (
    <div className="app-layout">
      <Sidebar activePath="/learning" />
      <main className="main-content">
        <PageHeader
          title="Learning"
          subtitle="Courses and learning assignments"
          icon={<div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #14b8a6, #0ea5e9)' }}>{LEARNING_ICON}</div>}
        />
        <div className="grid grid-2">
          {canManageLearning && (
            <Card title="Create Course">
              {formError && <Banner tone="danger" title={formError} />}
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: formError ? '0.75rem' : 0 }}>
                <TextField
                  label="Course Title"
                  placeholder="Course title"
                  value={form.title}
                  onChange={(v) => setForm({ ...form, title: v })}
                  validator={required('Course title')}
                  forceError={submitted}
                  required
                />
                <Select
                  label="Category"
                  value={form.category}
                  onChange={(v) => setForm({ ...form, category: v })}
                  options={[
                    { value: 'Compliance', label: 'Compliance' },
                    { value: 'Leadership', label: 'Leadership' },
                    { value: 'Technical', label: 'Technical' },
                    { value: 'HR Policy', label: 'HR Policy' },
                  ]}
                />
                <Textarea
                  label="Description"
                  placeholder="Description"
                  value={form.description}
                  onChange={(v) => setForm({ ...form, description: v })}
                  validator={required('Description')}
                  forceError={submitted}
                  required
                />
                <div>
                  <Button type="submit" variant="primary" loading={saving}>Save Course</Button>
                </div>
              </form>
            </Card>
          )}
          <div className={canManageLearning ? '' : 'full-width'}>
            <Card title="Courses">
              {error ? (
                <Banner tone="danger" title={error} action={<Button size="sm" variant="ghost" onClick={loadData}>Retry</Button>} />
              ) : loading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading…</p>
              ) : courses.length === 0 ? (
                <EmptyState title="No courses" message="Created courses will appear here." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {courses.map((course) => (
                    <div key={course.id} style={{ padding: '0.75rem 0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{course.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {course.category} &middot; {course._count?.enrollments || 0} enrollment(s)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
        <Card title="My Learning Assignments" padded={false} style={{ marginTop: '1.5rem' }}>
          <DataTable
            columns={enrollmentColumns}
            rows={enrollments}
            loading={loading}
            rowKey={(e) => e.id}
            emptyTitle="No assignments"
            emptyMessage="Your assigned courses will appear here."
          />
        </Card>
      </main>
    </div>
  );
}
