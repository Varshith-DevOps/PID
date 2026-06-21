'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import { createLearningCourse, getLearningCourses, getLearningEnrollments } from '@/lib/api';
import { ValidatedInput, ValidatedTextarea } from '@/components/ValidatedField';
import { validateForm, required } from '@/lib/validators';

export default function LearningPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', category: 'Compliance', description: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  const loadData = async () => {
    setCourses(await getLearningCourses());
    setEnrollments(await getLearningEnrollments());
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const { isValid, firstError } = validateForm(
      { title: form.title, description: form.description },
      { title: required('Course title'), description: required('Description') }
    );
    if (!isValid) {
      setError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    setError('');
    await createLearningCourse(form);
    setForm({ title: '', category: 'Compliance', description: '' });
    setSubmitted(false);
    loadData();
  };

  if (!user) return null;

  const canManageLearning = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(user.role);

  return (
    <div className="app-layout">
      <Sidebar activePath="/learning" />
      <main className="main-content">
        <div className="page-header"><h1>Learning</h1></div>
        <div className="grid grid-2">
          {canManageLearning && (
          <section className="card">
            <h2>Create Course</h2>
            {error && <p style={{ color: '#f87171', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>{error}</p>}
            <form onSubmit={submit} className="form-grid">
              <ValidatedInput className="form-control" placeholder="Course title" value={form.title} onChange={v => setForm({ ...form, title: v })} validator={required('Course title')} forceError={submitted} required />
              <select className="form-control" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option>Compliance</option><option>Leadership</option><option>Technical</option><option>HR Policy</option>
              </select>
              <ValidatedTextarea className="form-control" placeholder="Description" value={form.description} onChange={v => setForm({ ...form, description: v })} validator={required('Description')} forceError={submitted} />
              <button className="btn btn-primary" type="submit">Save Course</button>
            </form>
          </section>
          )}
          <section className={`card ${canManageLearning ? '' : 'full-width'}`}>
            <h2>Courses</h2>
            <div className="stack">
              {courses.map(course => (
                <div key={course.id} className="list-item">
                  <strong>{course.title}</strong>
                  <span>{course.category} &middot; {course._count?.enrollments || 0} enrollment(s)</span>
                </div>
              ))}
            </div>
          </section>
        </div>
        <section className="card">
          <h2>My Learning Assignments</h2>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Course</th><th>Status</th><th>Progress</th><th>Due Date</th></tr></thead>
              <tbody>{enrollments.map(item => (
                <tr key={item.id}><td>{item.course?.title}</td><td>{item.status}</td><td>{item.progress}%</td><td>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
