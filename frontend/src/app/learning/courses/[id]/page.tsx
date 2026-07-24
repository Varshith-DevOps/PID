'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import {
  addLearningMaterial,
  archiveLearningChapter,
  archiveLearningLesson,
  createLearningAssessment,
  createLearningChapter,
  createLearningLesson,
  createLearningQuiz,
  evaluateLearningAssessment,
  generateLearningCertificate,
  getLearningCourse,
  getLearningEnrollments,
  publishLearningCourse,
  requestLearningApproval,
  restoreLearningVersion,
  reviewLearningApproval,
  submitLearningAssessment,
  submitLearningFeedback,
  submitQuizAttempt,
  toggleCourseBookmark,
  updateLearningCourse,
  updateLearningLessonProgress,
  uploadLearningMaterial,
  upsertLearningSkill,
} from '@/lib/api';
import {
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  DateField,
  EmptyState,
  LoadingBlock,
  PageHeader,
  ProgressBar,
  Select,
  StatusChip,
  Tabs,
  TextField,
  Textarea,
} from '@/components/ui';
import type { TabItem } from '@/components/ui';

type Lesson = {
  id: string;
  title: string;
  lessonType?: string;
  contentType?: string;
  contentUrl?: string;
  embedUrl?: string;
  richText?: string;
  contentBody?: string;
  durationMinutes?: number;
  isMandatory?: boolean;
  sortOrder?: number;
  progress?: { status?: string; percentComplete?: number };
};

type Chapter = {
  id: string;
  title: string;
  description?: string;
  sortOrder?: number;
  lessons?: Lesson[];
};

type QuizQuestion = {
  id?: string;
  question: string;
  questionType?: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  points?: number;
};

type Quiz = {
  id: string;
  title: string;
  description?: string;
  passingScore?: number;
  passingMarks?: number;
  durationMinutes?: number;
  timeLimitMins?: number;
  questions?: QuizQuestion[];
};

type LearningAssessment = {
  id: string;
  title: string;
  instructions?: string;
  maxMarks?: number;
  rubricJson?: string;
  attemptLimit?: number;
  submissions?: any[];
};

type Material = {
  id: string;
  title: string;
  materialType?: string;
  fileUrl?: string;
  fileSizeBytes?: number;
  downloadCount?: number;
};

type Feedback = {
  id: string;
  rating: number;
  comment?: string;
  createdAt?: string;
  employee?: { firstName?: string; lastName?: string };
};

type Version = {
  id: string;
  versionNumber: number;
  changeSummary?: string;
  createdAt?: string;
};

type Approval = {
  id: string;
  status: string;
  requestedAt?: string;
  reviewedAt?: string;
  comment?: string;
  requester?: { firstName?: string; lastName?: string };
};

const workspaceTabs: TabItem[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'curriculum', label: 'Curriculum & Player' },
  { key: 'quizzes', label: 'Quizzes' },
  { key: 'assessments', label: 'Assessments' },
  { key: 'materials', label: 'Materials & Files' },
  { key: 'skills', label: 'Skills & Mapping' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'versions', label: 'Version History' },
  { key: 'feedback', label: 'Feedback & Reviews' },
  { key: 'certificate', label: 'Certificate' },
  { key: 'settings', label: 'Settings' },
];

export default function CourseWorkspacePage() {
  const { id: courseId } = useParams() as { id: string };
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [course, setCourse] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview');
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Selected Lesson state
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  // Authoring forms (Admin/Manager)
  const [chapterForm, setChapterForm] = useState({ title: '', description: '', sortOrder: '1' });
  const [lessonForm, setLessonForm] = useState({ chapterId: '', title: '', contentType: 'TEXT', contentUrl: '', contentBody: '', durationMinutes: '15', isMandatory: true });
  const [quizForm, setQuizForm] = useState({ title: '', description: '', passingScore: '70', durationMinutes: '20' });
  const [quizQuestion, setQuizQuestion] = useState({ question: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: 'A' });
  const [quizQuestionsList, setQuizQuestionsList] = useState<QuizQuestion[]>([]);
  const [assessmentForm, setAssessmentForm] = useState({ title: '', instructions: '', maxScore: '100', dueDate: '' });
  const [materialForm, setMaterialForm] = useState<{ title: string; materialType: string; file?: File }>({ title: '', materialType: 'PDF' });
  const [skillForm, setSkillForm] = useState({ name: '', targetProficiency: 'INTERMEDIATE', category: 'Technical' });
  const [approvalComment, setApprovalComment] = useState('');

  // Course Edit Settings Form
  const [courseSettings, setCourseSettings] = useState({
    title: '',
    courseCode: '',
    category: 'Compliance',
    department: '',
    difficulty: 'BEGINNER',
    durationMinutes: '60',
    estimatedHours: '1',
    instructor: '',
    passingScore: '70',
    learningObjectives: '',
    prerequisites: '',
    description: '',
  });

  // Quiz Taking state
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<any>(null);
  const [activeAssessment, setActiveAssessment] = useState<LearningAssessment | null>(null);
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, any>>({});
  const [assessmentResult, setAssessmentResult] = useState<any>(null);

  // Student Assessment Submission
  const [submissionText, setSubmissionText] = useState('');

  // Course Feedback Form
  const [feedbackForm, setFeedbackForm] = useState({ rating: '5', comment: '' });

  const canAuthor = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role || '');
  const canPublish = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '');

  const loadCourseData = async () => {
    setLoading(true);
    setError('');
    try {
      const courseData = await getLearningCourse(courseId);
      setCourse(courseData);

      if (courseData) {
        setCourseSettings({
          title: courseData.title || '',
          courseCode: courseData.courseCode || '',
          category: courseData.category || 'Compliance',
          department: courseData.department || '',
          difficulty: courseData.difficulty || 'BEGINNER',
          durationMinutes: String(courseData.durationMinutes || 60),
          estimatedHours: String(courseData.estimatedHours || 1),
          instructor: courseData.instructor || '',
          passingScore: String(courseData.passingScore || 70),
          learningObjectives: courseData.learningObjectives || '',
          prerequisites: courseData.prerequisites || '',
          description: courseData.description || '',
        });
      }

      // Select first available lesson by default if none selected
      const chapters: Chapter[] = courseData?.chapters || courseData?.enterprise?.chapters || [];
      const topLessons: Lesson[] = courseData?.lessons || courseData?.enterprise?.lessons || [];
      let firstLesson: Lesson | null = null;
      if (chapters.length && chapters[0].lessons?.length) {
        firstLesson = chapters[0].lessons[0];
      } else if (topLessons.length) {
        firstLesson = topLessons[0];
      }
      if (firstLesson) setSelectedLesson(firstLesson);

      // Fetch student's enrollment
      try {
        const enrollments = await getLearningEnrollments();
        const userEnrollment = Array.isArray(enrollments)
          ? enrollments.find((e: any) => e.courseId === courseId || e.course?.id === courseId)
          : null;
        setEnrollment(userEnrollment);
      } catch {
        setEnrollment(null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load course details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && courseId) loadCourseData();
  }, [user, courseId]);

  const handleToggleBookmark = async () => {
    try {
      await toggleCourseBookmark(courseId);
      setIsBookmarked((prev) => !prev);
      setSuccess(isBookmarked ? 'Bookmark removed.' : 'Course bookmarked!');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to bookmark course.');
    }
  };

  const handlePublish = async () => {
    try {
      await publishLearningCourse(courseId);
      setSuccess('Course published successfully!');
      loadCourseData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to publish course.');
    }
  };

  const handleRequestApproval = async () => {
    try {
      await requestLearningApproval(courseId);
      setSuccess('Course approval request submitted!');
      loadCourseData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Approval request failed.');
    }
  };

  const handleReviewApproval = async (approvalId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await reviewLearningApproval(approvalId, { status, comment: approvalComment });
      setApprovalComment('');
      setSuccess(`Approval request ${status.toLowerCase()}!`);
      loadCourseData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Review failed.');
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    setSaving(true);
    setError('');
    try {
      await restoreLearningVersion(courseId, versionId);
      setSuccess('Course version restored successfully!');
      loadCourseData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to restore version.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpsertSkill = async () => {
    if (!skillForm.name.trim()) return setError('Skill name is required.');
    setSaving(true);
    setError('');
    try {
      await upsertLearningSkill(courseId, skillForm);
      setSkillForm({ name: '', targetProficiency: 'INTERMEDIATE', category: 'Technical' });
      setSuccess('Skill mapped to course!');
      loadCourseData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to map skill.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCourseSettings = async () => {
    setSaving(true);
    setError('');
    try {
      await updateLearningCourse(courseId, {
        ...courseSettings,
        durationMinutes: Number(courseSettings.durationMinutes),
        estimatedHours: Number(courseSettings.estimatedHours),
        passingScore: Number(courseSettings.passingScore),
      });
      setSuccess('Course settings updated successfully!');
      loadCourseData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update course settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateChapter = async () => {
    if (!chapterForm.title.trim()) return setError('Chapter title is required.');
    setSaving(true);
    setError('');
    try {
      await createLearningChapter(courseId, {
        title: chapterForm.title,
        description: chapterForm.description,
        sortOrder: Number(chapterForm.sortOrder) || 1,
      });
      setChapterForm({ title: '', description: '', sortOrder: '1' });
      setSuccess('Chapter added successfully!');
      await loadCourseData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to add chapter.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLesson = async () => {
    if (!lessonForm.title.trim()) return setError('Lesson title is required.');
    setSaving(true);
    setError('');
    try {
      await createLearningLesson(courseId, {
        chapterId: lessonForm.chapterId || undefined,
        title: lessonForm.title,
        lessonType: lessonForm.contentType === 'TEXT' ? 'RICH_TEXT' : lessonForm.contentType === 'DOCUMENT' ? 'ATTACHMENT' : lessonForm.contentType,
        contentUrl: lessonForm.contentUrl || undefined,
        embedUrl: lessonForm.contentType === 'VIDEO' ? lessonForm.contentUrl || undefined : undefined,
        richText: lessonForm.contentBody || undefined,
        isMandatory: lessonForm.isMandatory,
        durationMinutes: Number(lessonForm.durationMinutes) || 15,
      });
      setLessonForm({ chapterId: '', title: '', contentType: 'TEXT', contentUrl: '', contentBody: '', durationMinutes: '15', isMandatory: true });
      setSuccess('Lesson created successfully!');
      await loadCourseData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create lesson.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkLessonComplete = async (lessonId: string) => {
    if (!enrollment?.id) return setError('Enrollment required to update lesson progress.');
    try {
      await updateLearningLessonProgress(lessonId, { enrollmentId: enrollment.id, status: 'COMPLETED', progress: 100, completionPercentage: 100 });
      setSuccess('Lesson marked as completed!');
      await loadCourseData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update lesson progress.');
    }
  };

  const handleAddQuestionToQuiz = () => {
    if (!quizQuestion.question.trim() || !quizQuestion.optionA.trim() || !quizQuestion.optionB.trim()) {
      return setError('Provide a question and at least 2 options.');
    }
    const options = [quizQuestion.optionA, quizQuestion.optionB];
    if (quizQuestion.optionC.trim()) options.push(quizQuestion.optionC);
    if (quizQuestion.optionD.trim()) options.push(quizQuestion.optionD);

    const newQuestion: QuizQuestion = {
      question: quizQuestion.question,
      options,
      correctAnswer: quizQuestion.correctAnswer,
      points: 1,
    };
    setQuizQuestionsList([...quizQuestionsList, newQuestion]);
    setQuizQuestion({ question: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: 'A' });
  };

  const handleCreateQuiz = async () => {
    if (!quizForm.title.trim()) return setError('Quiz title is required.');
    if (!quizQuestionsList.length) return setError('Add at least 1 question to the quiz.');
    setSaving(true);
    setError('');
    try {
      await createLearningQuiz(courseId, {
        title: quizForm.title,
        description: quizForm.description,
        passingScore: Number(quizForm.passingScore) || 70,
        durationMinutes: Number(quizForm.durationMinutes) || 20,
        questions: quizQuestionsList,
      });
      setQuizForm({ title: '', description: '', passingScore: '70', durationMinutes: '20' });
      setQuizQuestionsList([]);
      setSuccess('Quiz created successfully!');
      await loadCourseData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create quiz.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitQuizAttempt = async () => {
    if (!activeQuiz) return;
    if (!enrollment?.id) return setError('Enrollment required to submit quiz.');
    setSaving(true);
    setError('');
    try {
      const result = await submitQuizAttempt(activeQuiz.id, { enrollmentId: enrollment.id, courseId, answers: quizAnswers });
      setQuizResult(result);
      setSuccess('Quiz submitted successfully!');
      await loadCourseData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to submit quiz attempt.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAssessment = async () => {
    if (!assessmentForm.title.trim()) return setError('Assessment title is required.');
    setSaving(true);
    setError('');
    try {
      await createLearningAssessment(courseId, {
        title: assessmentForm.title,
        instructions: assessmentForm.instructions,
        maxMarks: Number(assessmentForm.maxScore) || 100,
        passingScore: Number(courseSettings.passingScore) || 70,
        dueDate: assessmentForm.dueDate || undefined,
      });
      setAssessmentForm({ title: '', instructions: '', maxScore: '100', dueDate: '' });
      setSuccess('Assessment created successfully!');
      await loadCourseData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create assessment.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadMaterial = async () => {
    if (!materialForm.title.trim()) return setError('Material title is required.');
    setSaving(true);
    setError('');
    try {
      if (materialForm.file) {
        await uploadLearningMaterial(courseId, {
          title: materialForm.title,
          materialType: materialForm.materialType,
          file: materialForm.file,
        });
      } else {
        await addLearningMaterial(courseId, {
          title: materialForm.title,
          materialType: materialForm.materialType,
        });
      }
      setMaterialForm({ title: '', materialType: 'PDF' });
      setSuccess('Material added successfully!');
      await loadCourseData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to upload material.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackForm.comment.trim()) return setError('Feedback comment is required.');
    setSaving(true);
    setError('');
    try {
      await submitLearningFeedback(courseId, {
        rating: Number(feedbackForm.rating) || 5,
        comment: feedbackForm.comment,
      });
      setFeedbackForm({ rating: '5', comment: '' });
      setSuccess('Feedback submitted!');
      await loadCourseData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to submit feedback.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateCertificate = async () => {
    if (!enrollment?.id) return setError('Enrollment required to generate certificate.');
    setSaving(true);
    setError('');
    try {
      await generateLearningCertificate(enrollment.id);
      setSuccess('Certificate generated successfully!');
      await loadCourseData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to generate certificate.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !course) {
    return (
      <div className="app-layout">
        <Sidebar activePath="/learning" />
        <main className="main-content">
          <LoadingBlock label="Loading Course Workspace..." />
        </main>
      </div>
    );
  }

  const chapters: Chapter[] = course?.chapters || course?.enterprise?.chapters || [];
  const topLessons: Lesson[] = course?.lessons || course?.enterprise?.lessons || [];
  const quizzes: Quiz[] = course?.quizzes || course?.enterprise?.quizzes || [];
  const assessments: LearningAssessment[] = course?.assessments || course?.enterprise?.assessments || [];
  const materials: Material[] = course?.materials || course?.enterprise?.materials || [];
  const feedbackList: Feedback[] = course?.feedback || course?.enterprise?.feedback || [];
  const versions: Version[] = course?.versions || course?.enterprise?.versions || [];
  const approvals: Approval[] = course?.approvals || course?.enterprise?.approvals || [];
  const skillsList: any[] = course?.courseSkills || course?.enterprise?.skills || [];
  const assessmentUnlocked = (enrollment?.progress || 0) >= 100;
  const getAssessmentQuestions = (assessment: LearningAssessment | null) => {
    if (!assessment?.rubricJson) return [];
    try {
      const parsed = JSON.parse(assessment.rubricJson);
      return Array.isArray(parsed.questions) ? parsed.questions : [];
    } catch {
      return [];
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activePath="/learning" />
      <main className="main-content">
        <div style={{ marginBottom: '1rem' }}>
          <Button size="sm" variant="ghost" onClick={() => router.push('/learning')}>
            ← Back to Learning Catalogue
          </Button>
        </div>

        {/* Hero Banner Header */}
        <Card style={{ background: 'linear-gradient(135deg, var(--bg-surface-2, #1e293b), var(--bg-surface, #0f172a))', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <StatusChip status={course?.status || 'DRAFT'} />
                <Badge tone="info">{course?.category || 'General'}</Badge>
                {course?.difficulty && <Badge tone="neutral">{course.difficulty}</Badge>}
              </div>
              <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>{course?.title}</h1>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>
                {course?.courseCode ? `[${course.courseCode}] ` : ''}
                Instructor: {course?.instructor || 'Internal Training'} | {course?.durationMinutes || 60} mins ({course?.estimatedHours || 1} hrs)
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button size="sm" variant={isBookmarked ? 'primary' : 'ghost'} onClick={handleToggleBookmark}>
                {isBookmarked ? '★ Bookmarked' : '☆ Bookmark'}
              </Button>
              {canAuthor && course?.status === 'DRAFT' && (
                <Button size="sm" variant="warning" onClick={handleRequestApproval}>
                  Request Approval
                </Button>
              )}
              {canPublish && course?.status !== 'PUBLISHED' && (
                <Button size="sm" variant="success" onClick={handlePublish}>
                  Publish Course
                </Button>
              )}
            </div>
          </div>
          {enrollment && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <span>Your Course Progress</span>
                <strong>{enrollment.progress || 0}%</strong>
              </div>
              <ProgressBar value={enrollment.progress || 0} height={8} />
            </div>
          )}
        </Card>

        {error && <Banner tone="danger" title={error} action={<Button size="sm" variant="ghost" onClick={() => setError('')}>Dismiss</Button>} />}
        {success && <Banner tone="success" title={success} action={<Button size="sm" variant="ghost" onClick={() => setSuccess('')}>Dismiss</Button>} />}

        <Tabs items={workspaceTabs} value={activeTab} onChange={setActiveTab} style={{ marginBottom: '1.25rem' }} />

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-2">
            <Card title="Course Description & Objectives">
              <p style={{ lineHeight: '1.6', fontSize: '0.95rem' }}>{course?.description || 'No detailed description available.'}</p>
              <h4 style={{ marginTop: '1.25rem' }}>Learning Objectives</h4>
              <p style={{ lineHeight: '1.6', color: 'var(--text-muted)' }}>{course?.learningObjectives || 'Gain foundational and practical expertise in this domain.'}</p>
              <h4 style={{ marginTop: '1.25rem' }}>Prerequisites</h4>
              <p style={{ lineHeight: '1.6', color: 'var(--text-muted)' }}>{course?.prerequisites || 'None specified.'}</p>
            </Card>
            <Card title="Course Quick Stats">
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div><strong>Category:</strong> {course?.category || 'Compliance'}</div>
                <div><strong>Department:</strong> {course?.department || 'All Departments'}</div>
                <div><strong>Difficulty:</strong> {course?.difficulty || 'BEGINNER'}</div>
                <div><strong>Duration:</strong> {course?.durationMinutes || 60} minutes ({course?.estimatedHours || 1} hrs)</div>
                <div><strong>Passing Score:</strong> {course?.passingScore || 70}%</div>
                <div><strong>Certificate Available:</strong> {course?.certificateAvailable ? 'Yes' : 'No'}</div>
                <div><strong>Assigned Learners:</strong> {course?._count?.enrollments || 0}</div>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: CURRICULUM & LESSON PLAYER */}
        {activeTab === 'curriculum' && (
          <div className="grid grid-3" style={{ gridTemplateColumns: '1fr 2fr', gap: '1.25rem' }}>
            {/* Sidebar List of Chapters & Lessons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Card title="Course Outline">
                {chapters.length > 0 ? (
                  chapters.map((ch, idx) => (
                    <div key={ch.id} style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <strong>Ch {idx + 1}: {ch.title}</strong>
                        {canAuthor && (
                          <Button size="sm" variant="danger" onClick={async () => { await archiveLearningChapter(ch.id); loadCourseData(); }}>
                            Del
                          </Button>
                        )}
                      </div>
                      <div style={{ paddingLeft: '0.5rem', marginTop: '0.4rem' }}>
                        {(ch.lessons || []).map((les) => (
                          <div
                            key={les.id}
                            onClick={() => setSelectedLesson(les)}
                            style={{
                              padding: '0.45rem 0.6rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              marginBottom: '0.2rem',
                              fontSize: '0.85rem',
                              background: selectedLesson?.id === les.id ? 'var(--bg-active, rgba(37,99,235,0.15))' : 'transparent',
                              borderLeft: selectedLesson?.id === les.id ? '3px solid var(--brand-primary, #2563eb)' : '3px solid transparent',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span>{les.title}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{les.durationMinutes || 10}m</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : topLessons.length > 0 ? (
                  topLessons.map((les) => (
                    <div
                      key={les.id}
                      onClick={() => setSelectedLesson(les)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginBottom: '0.3rem',
                        background: selectedLesson?.id === les.id ? 'var(--bg-active, rgba(37,99,235,0.15))' : 'transparent',
                        borderLeft: selectedLesson?.id === les.id ? '3px solid var(--brand-primary, #2563eb)' : '3px solid transparent',
                      }}
                    >
                      <strong>{les.title}</strong>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No curriculum uploaded yet" />
                )}
              </Card>

              {/* Admin Chapter & Lesson Authoring */}
              {canAuthor && (
                <Card title="Add Chapter / Lesson">
                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>New Chapter</h4>
                    <TextField label="Chapter Title" value={chapterForm.title} onChange={(v) => setChapterForm({ ...chapterForm, title: v })} />
                    <Button size="sm" style={{ marginTop: '0.5rem' }} loading={saving} onClick={handleCreateChapter}>
                      Add Chapter
                    </Button>
                  </div>
                  <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>New Lesson</h4>
                    <Select
                      label="Select Chapter"
                      value={lessonForm.chapterId}
                      onChange={(v) => setLessonForm({ ...lessonForm, chapterId: v })}
                      options={[{ value: '', label: 'No Chapter (Top-level)' }, ...chapters.map((c) => ({ value: c.id, label: c.title }))]}
                    />
                    <TextField label="Lesson Title" value={lessonForm.title} onChange={(v) => setLessonForm({ ...lessonForm, title: v })} />
                    <Select
                      label="Content Type"
                      value={lessonForm.contentType}
                      onChange={(v) => setLessonForm({ ...lessonForm, contentType: v })}
                      options={[
                        { value: 'TEXT', label: 'Formatted Text / HTML' },
                        { value: 'VIDEO', label: 'Video URL' },
                        { value: 'DOCUMENT', label: 'Document / File Link' },
                      ]}
                    />
                    {lessonForm.contentType !== 'TEXT' ? (
                      <TextField label="Media / Document URL" value={lessonForm.contentUrl} onChange={(v) => setLessonForm({ ...lessonForm, contentUrl: v })} />
                    ) : (
                      <Textarea label="Lesson Content / Body" value={lessonForm.contentBody} onChange={(v) => setLessonForm({ ...lessonForm, contentBody: v })} />
                    )}
                    <Button size="sm" style={{ marginTop: '0.5rem' }} loading={saving} onClick={handleCreateLesson}>
                      Add Lesson
                    </Button>
                  </div>
                </Card>
              )}
            </div>

            {/* Main Interactive Player Area */}
            <Card title={selectedLesson ? `Lesson: ${selectedLesson.title}` : 'Select a Lesson'}>
              {selectedLesson ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <Badge tone="info">{selectedLesson.contentType || selectedLesson.lessonType || 'TEXT'}</Badge>
                    <Button size="sm" variant="success" onClick={() => handleMarkLessonComplete(selectedLesson.id)}>
                      ✓ Mark Complete
                    </Button>
                  </div>

                  {(selectedLesson.contentType === 'VIDEO' || selectedLesson.lessonType === 'VIDEO') && (selectedLesson.contentUrl || selectedLesson.embedUrl) ? (
                    <div style={{ marginBottom: '1.5rem', background: '#000', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                      <p style={{ color: '#fff', margin: '0 0 0.5rem 0' }}>Video Media Player</p>
                      <a href={selectedLesson.contentUrl || selectedLesson.embedUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>
                        Open External Video Link ({selectedLesson.contentUrl || selectedLesson.embedUrl})
                      </a>
                    </div>
                  ) : selectedLesson.contentUrl ? (
                    <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
                      <p style={{ margin: '0 0 0.5rem 0' }}>External Attachment / Document</p>
                      <a href={selectedLesson.contentUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)' }}>
                        Download / View Document Source
                      </a>
                    </div>
                  ) : null}

                  <div style={{ lineHeight: '1.6', fontSize: '0.95rem', whiteSpace: 'pre-wrap', minHeight: '180px' }}>
                    {selectedLesson.contentBody || selectedLesson.richText || 'No text content provided for this lesson.'}
                  </div>
                </div>
              ) : (
                <EmptyState title="No lesson selected" />
              )}
            </Card>
          </div>
        )}

        {/* TAB 3: QUIZZES */}
        {activeTab === 'quizzes' && (
          <div className="grid grid-2">
            {/* List & Quiz Taking Interface */}
            <Card title={activeQuiz ? `Taking Quiz: ${activeQuiz.title}` : 'Course Quizzes'}>
              {activeQuiz ? (
                <div>
                  <Button size="sm" variant="ghost" onClick={() => setActiveQuiz(null)} style={{ marginBottom: '1rem' }}>
                    ← Back to Quiz List
                  </Button>
                  {(activeQuiz.questions || []).map((q, qIdx) => (
                    <div key={qIdx} style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
                      <strong style={{ display: 'block', marginBottom: '0.5rem' }}>
                        Q{qIdx + 1}: {q.question}
                      </strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {(Array.isArray(q.options) ? q.options : (() => { try { return JSON.parse(q.options as any); } catch { return []; } })()).map((opt: string, optIdx: number) => {
                          const optionKey = String.fromCharCode(65 + optIdx); // A, B, C, D
                          const answerKey = q.id || String(qIdx);
                          return (
                            <label key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name={`question_${qIdx}`}
                                checked={quizAnswers[answerKey] === optionKey}
                                onChange={() => setQuizAnswers({ ...quizAnswers, [answerKey]: optionKey })}
                              />
                              <span>
                                <strong>{optionKey}.</strong> {opt}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <Button loading={saving} onClick={handleSubmitQuizAttempt}>
                    Submit Quiz Attempt
                  </Button>

                  {quizResult && (
                    <Card title="Quiz Result" style={{ marginTop: '1rem', background: 'var(--bg-subtle)' }}>
                      <p>
                        Score: <strong>{quizResult.percentage ?? quizResult.score ?? 0}%</strong>
                      </p>
                      <StatusChip status={quizResult.passed ? 'PASSED' : 'FAILED'} />
                    </Card>
                  )}
                </div>
              ) : quizzes.length > 0 ? (
                quizzes.map((quiz) => (
                  <div key={quiz.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{quiz.title}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        Passing score: {quiz.passingScore || quiz.passingMarks || 70}% | Duration: {quiz.durationMinutes || quiz.timeLimitMins || 20}m
                      </div>
                    </div>
                    <Button size="sm" onClick={() => { setActiveQuiz(quiz); setQuizAnswers({}); setQuizResult(null); }}>
                      Start Quiz
                    </Button>
                  </div>
                ))
              ) : (
                <EmptyState title="No quizzes created for this course" />
              )}
            </Card>

            {/* Quiz Creator Form for Admins */}
            {canAuthor && (
              <Card title="Create Course Quiz">
                <div className="form-grid">
                  <TextField label="Quiz Title" value={quizForm.title} onChange={(v) => setQuizForm({ ...quizForm, title: v })} />
                  <TextField label="Passing Score (%)" value={quizForm.passingScore} restrict="digits" onChange={(v) => setQuizForm({ ...quizForm, passingScore: v })} />
                  <TextField label="Time Limit (Mins)" value={quizForm.durationMinutes} restrict="digits" onChange={(v) => setQuizForm({ ...quizForm, durationMinutes: v })} />
                </div>

                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <h4>Add Question</h4>
                  <TextField label="Question" value={quizQuestion.question} onChange={(v) => setQuizQuestion({ ...quizQuestion, question: v })} />
                  <div className="form-grid" style={{ marginTop: '0.5rem' }}>
                    <TextField label="Option A" value={quizQuestion.optionA} onChange={(v) => setQuizQuestion({ ...quizQuestion, optionA: v })} />
                    <TextField label="Option B" value={quizQuestion.optionB} onChange={(v) => setQuizQuestion({ ...quizQuestion, optionB: v })} />
                    <TextField label="Option C" value={quizQuestion.optionC} onChange={(v) => setQuizQuestion({ ...quizQuestion, optionC: v })} />
                    <TextField label="Option D" value={quizQuestion.optionD} onChange={(v) => setQuizQuestion({ ...quizQuestion, optionD: v })} />
                    <Select
                      label="Correct Answer"
                      value={quizQuestion.correctAnswer}
                      onChange={(v) => setQuizQuestion({ ...quizQuestion, correctAnswer: v })}
                      options={[
                        { value: 'A', label: 'Option A' },
                        { value: 'B', label: 'Option B' },
                        { value: 'C', label: 'Option C' },
                        { value: 'D', label: 'Option D' },
                      ]}
                    />
                  </div>
                  <Button size="sm" variant="ghost" style={{ marginTop: '0.5rem' }} onClick={handleAddQuestionToQuiz}>
                    + Add Question to Quiz ({quizQuestionsList.length} added)
                  </Button>
                </div>

                <Button style={{ marginTop: '1rem' }} loading={saving} onClick={handleCreateQuiz}>
                  Create Quiz
                </Button>
              </Card>
            )}
          </div>
        )}

        {/* TAB 4: ASSESSMENTS */}
        {activeTab === 'assessments' && (
          <div className="grid grid-2">
            <Card title="Course Assignments & Assessments">
              {canAuthor && (
                <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
                  <h4>Create New Assessment</h4>
                  <div className="form-grid">
                    <TextField label="Assessment Title" value={assessmentForm.title} onChange={(v) => setAssessmentForm({ ...assessmentForm, title: v })} />
                    <TextField label="Max Score" value={assessmentForm.maxScore} restrict="digits" onChange={(v) => setAssessmentForm({ ...assessmentForm, maxScore: v })} />
                    <DateField label="Due Date" value={assessmentForm.dueDate} onChange={(v) => setAssessmentForm({ ...assessmentForm, dueDate: v })} />
                    <div style={{ gridColumn: '1 / -1' }}>
                      <Textarea label="Instructions" value={assessmentForm.instructions} onChange={(v) => setAssessmentForm({ ...assessmentForm, instructions: v })} />
                    </div>
                  </div>
                  <Button size="sm" style={{ marginTop: '0.75rem' }} loading={saving} onClick={handleCreateAssessment}>
                    Create Assessment
                  </Button>
                </div>
              )}

              <div>
                <h4>{assessmentUnlocked ? 'Assessment Available' : 'Assessment Locked'}</h4>
                {!assessmentUnlocked && <Banner tone="warning" style={{ marginBottom: '1rem' }}>Complete every lesson to unlock the course assessment.</Banner>}
                {!activeAssessment ? (
                  assessments.length ? assessments.map((assessment) => (
                    <div key={assessment.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                      <div>
                        <strong>{assessment.title}</strong>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          Max score: {assessment.maxMarks || 100} | Attempts: {assessment.attemptLimit || 1}
                        </div>
                      </div>
                      <Button size="sm" disabled={!assessmentUnlocked} onClick={() => { setActiveAssessment(assessment); setAssessmentAnswers({}); setAssessmentResult(null); }}>
                        Start Assessment
                      </Button>
                    </div>
                  )) : <EmptyState title="No assessment configured for this course" />
                ) : (
                  <div>
                    <Button size="sm" variant="ghost" onClick={() => setActiveAssessment(null)} style={{ marginBottom: '1rem' }}>
                      Back to Assessments
                    </Button>
                    {getAssessmentQuestions(activeAssessment).length ? getAssessmentQuestions(activeAssessment).map((question: any, index: number) => {
                      const answerKey = question.id || `q${index + 1}`;
                      const type = String(question.questionType || 'MCQ').toUpperCase();
                      const options = Array.isArray(question.options) ? question.options : [];
                      return (
                        <div key={answerKey} style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
                          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Q{index + 1}: {question.question}</strong>
                          {['MCQ', 'TRUE_FALSE'].includes(type) ? (
                            (type === 'TRUE_FALSE' ? ['true', 'false'] : options).map((option: string, optionIndex: number) => {
                              const value = type === 'TRUE_FALSE' ? option : String.fromCharCode(65 + optionIndex);
                              return (
                                <label key={value} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                  <input type="radio" checked={assessmentAnswers[answerKey] === value} onChange={() => setAssessmentAnswers({ ...assessmentAnswers, [answerKey]: value })} />
                                  <span>{type === 'TRUE_FALSE' ? option : `${value}. ${option}`}</span>
                                </label>
                              );
                            })
                          ) : type === 'MULTIPLE_ANSWER' ? (
                            options.map((option: string, optionIndex: number) => {
                              const value = String.fromCharCode(65 + optionIndex);
                              const selected = Array.isArray(assessmentAnswers[answerKey]) ? assessmentAnswers[answerKey] : [];
                              return (
                                <label key={value} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                  <input
                                    type="checkbox"
                                    checked={selected.includes(value)}
                                    onChange={(event) => setAssessmentAnswers({
                                      ...assessmentAnswers,
                                      [answerKey]: event.target.checked ? [...selected, value] : selected.filter((item: string) => item !== value),
                                    })}
                                  />
                                  <span>{value}. {option}</span>
                                </label>
                              );
                            })
                          ) : (
                            <Textarea label="Answer" value={assessmentAnswers[answerKey] || ''} onChange={(value) => setAssessmentAnswers({ ...assessmentAnswers, [answerKey]: value })} />
                          )}
                        </div>
                      );
                    }) : (
                      <Textarea label="Your Answer / Project Summary" value={submissionText} onChange={setSubmissionText} />
                    )}
                    <Button
                      size="sm"
                      loading={saving}
                      onClick={async () => {
                        if (!enrollment?.id) return setError('Enrollment required to submit assessment.');
                        const hasQuestions = getAssessmentQuestions(activeAssessment).length > 0;
                        if (!hasQuestions && !submissionText.trim()) return setError('Provide submission text.');
                        setSaving(true);
                        try {
                          const result = await submitLearningAssessment(activeAssessment.id, { enrollmentId: enrollment.id, answers: assessmentAnswers, submissionText: hasQuestions ? undefined : submissionText });
                          setAssessmentResult(result);
                          setSubmissionText('');
                          setSuccess(result.requiresManualReview ? 'Assessment submitted for manual review.' : 'Assessment evaluated.');
                          await loadCourseData();
                        } catch (err: any) {
                          setError(err?.response?.data?.error || 'Failed to submit assessment.');
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      Submit Assessment
                    </Button>
                    {assessmentResult && (
                      <Card title="Assessment Result" style={{ marginTop: '1rem', background: 'var(--bg-subtle)' }}>
                        <p>Score: <strong>{assessmentResult.percentage ?? 0}%</strong></p>
                        <StatusChip status={assessmentResult.requiresManualReview ? 'PENDING_REVIEW' : assessmentResult.passed ? 'PASSED' : 'FAILED'} />
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </Card>

            <Card title="Assessment Guidance">
              <p>Objective questions are scored automatically. Short answer and essay responses are routed to manager or HR review before certificate eligibility is granted.</p>
            </Card>
          </div>
        )}

        {/* TAB 5: MATERIALS */}
        {activeTab === 'materials' && (
          <div className="grid grid-2">
            <Card title="Course Materials & Files" padded={false}>
              <DataTable
                columns={[
                  { key: 'title', header: 'Material Title', render: (row: Material) => <strong>{row.title}</strong> },
                  { key: 'type', header: 'Type', render: (row: Material) => <Badge tone="info">{row.materialType || 'PDF'}</Badge> },
                  {
                    key: 'actions',
                    header: '',
                    align: 'right',
                    render: (row: Material) => (
                      <Button size="sm" variant="ghost" href={`/api/learning/materials/${row.id}/download`}>
                        Download
                      </Button>
                    ),
                  },
                ]}
                rows={materials}
                rowKey={(row: Material) => row.id}
                emptyTitle="No materials uploaded"
              />
            </Card>

            {canAuthor && (
              <Card title="Upload New Material">
                <div className="form-grid">
                  <TextField label="Title" value={materialForm.title} onChange={(v) => setMaterialForm({ ...materialForm, title: v })} />
                  <Select
                    label="Type"
                    value={materialForm.materialType}
                    onChange={(v) => setMaterialForm({ ...materialForm, materialType: v })}
                    options={[
                      { value: 'PDF', label: 'PDF Document' },
                      { value: 'PRESENTATION', label: 'PPT Slide' },
                      { value: 'CODE', label: 'Code Sample' },
                      { value: 'AUDIO', label: 'Audio File' },
                    ]}
                  />
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Select File</label>
                    <input type="file" onChange={(e) => setMaterialForm({ ...materialForm, file: e.target.files?.[0] })} />
                  </div>
                </div>
                <Button style={{ marginTop: '1rem' }} loading={saving} onClick={handleUploadMaterial}>
                  Upload File
                </Button>
              </Card>
            )}
          </div>
        )}

        {/* TAB 6: SKILLS */}
        {activeTab === 'skills' && (
          <div className="grid grid-2">
            {canAuthor && (
              <Card title="Map Competency Skill">
                <div className="form-grid">
                  <TextField label="Skill Name" value={skillForm.name} onChange={(v) => setSkillForm({ ...skillForm, name: v })} />
                  <Select
                    label="Target Proficiency"
                    value={skillForm.targetProficiency}
                    onChange={(v) => setSkillForm({ ...skillForm, targetProficiency: v })}
                    options={[
                      { value: 'BEGINNER', label: 'Beginner' },
                      { value: 'INTERMEDIATE', label: 'Intermediate' },
                      { value: 'ADVANCED', label: 'Advanced' },
                      { value: 'EXPERT', label: 'Expert' },
                    ]}
                  />
                  <TextField label="Skill Category" value={skillForm.category} onChange={(v) => setSkillForm({ ...skillForm, category: v })} />
                </div>
                <Button style={{ marginTop: '1rem' }} loading={saving} onClick={handleUpsertSkill}>
                  Map Skill to Course
                </Button>
              </Card>
            )}
            <Card title="Course Skills & Competencies" padded={false}>
              <DataTable
                columns={[
                  { key: 'name', header: 'Skill Name', render: (row: any) => <strong>{row.skill?.name || row.name || 'Skill'}</strong> },
                  { key: 'proficiency', header: 'Target Level', render: (row: any) => <StatusChip status={row.targetProficiency || 'INTERMEDIATE'} /> },
                ]}
                rows={skillsList}
                rowKey={(row: any) => row.id || row.name}
                emptyTitle="No skills mapped to this course"
              />
            </Card>
          </div>
        )}

        {/* TAB 7: APPROVALS */}
        {activeTab === 'approvals' && (
          <div className="grid grid-2">
            <Card title="Course Approval Workflow">
              <div style={{ marginBottom: '1rem' }}>
                <p>Status: <StatusChip status={course?.status || 'DRAFT'} /></p>
                {canAuthor && course?.status === 'DRAFT' && (
                  <Button loading={saving} onClick={handleRequestApproval}>
                    Submit Request for Publication Approval
                  </Button>
                )}
              </div>
              {canPublish && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <h4>Admin Review & Decision</h4>
                  <Textarea label="Approval / Rejection Comments" value={approvalComment} onChange={setApprovalComment} />
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                    <Button variant="success" onClick={() => handleReviewApproval(approvals[0]?.id || courseId, 'APPROVED')}>
                      Approve & Publish
                    </Button>
                    <Button variant="danger" onClick={() => handleReviewApproval(approvals[0]?.id || courseId, 'REJECTED')}>
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Approval Request Logs" padded={false}>
              <DataTable
                columns={[
                  { key: 'date', header: 'Requested At', render: (row: Approval) => row.requestedAt ? new Date(row.requestedAt).toLocaleDateString() : '-' },
                  { key: 'requester', header: 'Requester', render: (row: Approval) => row.requester ? `${row.requester.firstName || ''} ${row.requester.lastName || ''}`.trim() : 'Instructor' },
                  { key: 'status', header: 'Status', render: (row: Approval) => <StatusChip status={row.status || 'PENDING'} /> },
                  { key: 'comment', header: 'Review Comments', render: (row: Approval) => row.comment || '-' },
                ]}
                rows={approvals}
                rowKey={(row: Approval) => row.id}
                emptyTitle="No approval history"
              />
            </Card>
          </div>
        )}

        {/* TAB 8: VERSION HISTORY */}
        {activeTab === 'versions' && (
          <Card title="Course Version Snapshots" padded={false}>
            <DataTable
              columns={[
                { key: 'version', header: 'Version #', render: (row: Version) => <strong>v{row.versionNumber}</strong> },
                { key: 'date', header: 'Created Date', render: (row: Version) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '-' },
                { key: 'summary', header: 'Change Summary', render: (row: Version) => row.changeSummary || 'Course snapshot' },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  render: (row: Version) => canAuthor && (
                    <Button size="sm" variant="ghost" loading={saving} onClick={() => handleRestoreVersion(row.id)}>
                      Restore Version
                    </Button>
                  ),
                },
              ]}
              rows={versions}
              rowKey={(row: Version) => row.id}
              emptyTitle="No version snapshots logged"
            />
          </Card>
        )}

        {/* TAB 9: FEEDBACK */}
        {activeTab === 'feedback' && (
          <div className="grid grid-2">
            <Card title="Submit Course Feedback">
              <div className="form-grid">
                <Select
                  label="Rating"
                  value={feedbackForm.rating}
                  onChange={(v) => setFeedbackForm({ ...feedbackForm, rating: v })}
                  options={[
                    { value: '5', label: '★★★★★ (5 - Excellent)' },
                    { value: '4', label: '★★★★☆ (4 - Good)' },
                    { value: '3', label: '★★★☆☆ (3 - Average)' },
                    { value: '2', label: '★★☆☆☆ (2 - Poor)' },
                    { value: '1', label: '★☆☆☆☆ (1 - Very Bad)' },
                  ]}
                />
                <div style={{ gridColumn: '1 / -1' }}>
                  <Textarea label="Your Review & Comments" value={feedbackForm.comment} onChange={(v) => setFeedbackForm({ ...feedbackForm, comment: v })} />
                </div>
              </div>
              <Button style={{ marginTop: '1rem' }} loading={saving} onClick={handleSubmitFeedback}>
                Submit Feedback
              </Button>
            </Card>

            <Card title="Learner Reviews">
              {feedbackList.length > 0 ? (
                feedbackList.map((fb) => (
                  <div key={fb.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{fb.employee ? `${fb.employee.firstName || ''} ${fb.employee.lastName || ''}`.trim() : 'Anonymous'}</strong>
                      <span style={{ color: '#eab308' }}>{'★'.repeat(fb.rating)}</span>
                    </div>
                    <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{fb.comment}</p>
                  </div>
                ))
              ) : (
                <EmptyState title="No student feedback yet" />
              )}
            </Card>
          </div>
        )}

        {/* TAB 10: CERTIFICATE */}
        {activeTab === 'certificate' && (
          <Card title="Course Completion Certificate">
            {enrollment?.certificate ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <h2 style={{ color: '#0f766e', margin: '0 0 0.5rem 0' }}>Certificate Issued!</h2>
                <p>Certificate Number: <strong>{enrollment.certificate.certificateNumber}</strong></p>
                <Button variant="success" href={`/api/learning/certificates/${enrollment.certificate.id}/download`}>
                  Download Official Certificate (PDF)
                </Button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p>Complete all mandatory lessons and pass quizzes to unlock your course completion certificate.</p>
                <Button loading={saving} onClick={handleGenerateCertificate}>
                  Generate Certificate Now
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* TAB 11: SETTINGS */}
        {activeTab === 'settings' && canAuthor && (
          <Card title="Course Metadata & Configuration">
            <div className="form-grid">
              <TextField label="Course Name" value={courseSettings.title} onChange={(v) => setCourseSettings({ ...courseSettings, title: v })} />
              <TextField label="Course Code" value={courseSettings.courseCode} onChange={(v) => setCourseSettings({ ...courseSettings, courseCode: v })} />
              <TextField label="Category" value={courseSettings.category} onChange={(v) => setCourseSettings({ ...courseSettings, category: v })} />
              <TextField label="Department" value={courseSettings.department} onChange={(v) => setCourseSettings({ ...courseSettings, department: v })} />
              <Select
                label="Difficulty"
                value={courseSettings.difficulty}
                onChange={(v) => setCourseSettings({ ...courseSettings, difficulty: v })}
                options={[
                  { value: 'BEGINNER', label: 'Beginner' },
                  { value: 'INTERMEDIATE', label: 'Intermediate' },
                  { value: 'ADVANCED', label: 'Advanced' },
                ]}
              />
              <TextField label="Duration (Mins)" value={courseSettings.durationMinutes} restrict="digits" onChange={(v) => setCourseSettings({ ...courseSettings, durationMinutes: v })} />
              <TextField label="Estimated Hours" value={courseSettings.estimatedHours} restrict="decimal" onChange={(v) => setCourseSettings({ ...courseSettings, estimatedHours: v })} />
              <TextField label="Instructor" value={courseSettings.instructor} onChange={(v) => setCourseSettings({ ...courseSettings, instructor: v })} />
              <TextField label="Passing Score (%)" value={courseSettings.passingScore} restrict="digits" onChange={(v) => setCourseSettings({ ...courseSettings, passingScore: v })} />
              <div style={{ gridColumn: '1 / -1' }}>
                <Textarea label="Learning Objectives" value={courseSettings.learningObjectives} onChange={(v) => setCourseSettings({ ...courseSettings, learningObjectives: v })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Textarea label="Prerequisites" value={courseSettings.prerequisites} onChange={(v) => setCourseSettings({ ...courseSettings, prerequisites: v })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Textarea label="Description" value={courseSettings.description} onChange={(v) => setCourseSettings({ ...courseSettings, description: v })} />
              </div>
            </div>
            <Button style={{ marginTop: '1rem' }} loading={saving} onClick={handleUpdateCourseSettings}>
              Save Course Configuration
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}
