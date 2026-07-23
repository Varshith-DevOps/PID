const COURSE_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];
const MATERIAL_TYPES = ['PDF', 'DOCX', 'PPT', 'PPTX', 'TXT', 'MP4', 'VIDEO', 'YOUTUBE', 'VIMEO', 'EXTERNAL_URL'];
const LESSON_TYPES = ['RICH_TEXT', 'VIDEO', 'YOUTUBE', 'VIMEO', 'PDF', 'ATTACHMENT', 'EXTERNAL_LINK', 'QUIZ'];
const QUESTION_TYPES = ['MCQ', 'MULTIPLE_ANSWER', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'DESCRIPTIVE'];

const normalizeCsv = (value) => Array.isArray(value) ? value.join(',') : value;

const requireText = (payload, field, label) => {
  if (!payload[field] || typeof payload[field] !== 'string' || !payload[field].trim()) {
    return `${label} is required`;
  }
  return null;
};

const validateCoursePayload = (payload = {}, partial = false) => {
  const errors = [];
  if (!partial) {
    const titleError = requireText(payload, 'title', 'Course name');
    if (titleError) errors.push(titleError);
  }
  if (payload.difficulty && !DIFFICULTIES.includes(String(payload.difficulty).toUpperCase())) errors.push('Difficulty must be Beginner, Intermediate, or Advanced');
  if (payload.status && !COURSE_STATUSES.includes(String(payload.status).toUpperCase())) errors.push('Status must be Draft, Published, or Archived');
  if (payload.passingScore !== undefined) {
    const score = Number(payload.passingScore);
    if (!Number.isFinite(score) || score < 0 || score > 100) errors.push('Passing score must be between 0 and 100');
  }
  if (payload.durationMinutes !== undefined && Number(payload.durationMinutes) < 0) errors.push('Duration cannot be negative');
  return errors;
};

const buildCourseData = (payload = {}) => ({
  title: payload.title?.trim(),
  courseCode: payload.courseCode?.trim() || undefined,
  description: payload.description?.trim() || undefined,
  category: payload.category?.trim() || 'GENERAL',
  department: payload.department?.trim() || undefined,
  difficulty: payload.difficulty ? String(payload.difficulty).toUpperCase() : 'BEGINNER',
  durationMinutes: payload.durationMinutes !== undefined ? Number(payload.durationMinutes) : 0,
  estimatedHours: payload.estimatedHours !== undefined && payload.estimatedHours !== '' ? Number(payload.estimatedHours) : undefined,
  instructor: payload.instructor?.trim() || undefined,
  thumbnailUrl: payload.thumbnailUrl?.trim() || undefined,
  bannerUrl: payload.bannerUrl?.trim() || undefined,
  tags: normalizeCsv(payload.tags)?.trim?.() || undefined,
  prerequisites: normalizeCsv(payload.prerequisites)?.trim?.() || undefined,
  learningObjectives: normalizeCsv(payload.learningObjectives)?.trim?.() || undefined,
  visibility: payload.visibility ? String(payload.visibility).toUpperCase() : undefined,
  language: payload.language?.trim?.() || undefined,
  passingScore: payload.passingScore !== undefined ? Number(payload.passingScore) : 70,
  certificateAvailable: Boolean(payload.certificateAvailable),
  status: payload.status ? String(payload.status).toUpperCase() : 'DRAFT',
  isMandatory: Boolean(payload.isMandatory),
});

const validateMaterialPayload = (payload = {}) => {
  const errors = [];
  const titleError = requireText(payload, 'title', 'Material title');
  if (titleError) errors.push(titleError);
  const type = String(payload.materialType || '').toUpperCase();
  if (!MATERIAL_TYPES.includes(type)) errors.push('Material type is not supported');
  if (['YOUTUBE', 'EXTERNAL_URL'].includes(type) && !payload.externalUrl) errors.push('External URL is required');
  return errors;
};

const validateChapterPayload = (payload = {}, partial = false) => {
  const errors = [];
  if (!partial) {
    const titleError = requireText(payload, 'title', 'Chapter title');
    if (titleError) errors.push(titleError);
  }
  if (payload.minimumTimeMinutes !== undefined && Number(payload.minimumTimeMinutes) < 0) errors.push('Minimum learning time cannot be negative');
  return errors;
};

const validateLessonPayload = (payload = {}, partial = false) => {
  const errors = [];
  if (!partial) {
    const titleError = requireText(payload, 'title', 'Lesson title');
    if (titleError) errors.push(titleError);
  }
  const type = String(payload.lessonType || 'VIDEO').toUpperCase();
  if (!LESSON_TYPES.includes(type)) errors.push('Lesson type is not supported');
  if (payload.durationMinutes !== undefined && Number(payload.durationMinutes) < 0) errors.push('Lesson duration cannot be negative');
  return errors;
};

const validateQuestionType = (type) => QUESTION_TYPES.includes(String(type || '').toUpperCase());

const validateAssignmentPayload = (payload = {}) => {
  const errors = [];
  const assignmentType = String(payload.assignmentType || '').toUpperCase();
  if (!payload.courseId) errors.push('Course is required');
  if (!payload.employeeId && !payload.employeeIds?.length && !payload.departmentId && !payload.department && !payload.designationId && !payload.designation && !['COMPANY', 'ORGANIZATION'].includes(assignmentType)) {
    errors.push('Select at least one assignment target');
  }
  if (payload.priority && !PRIORITIES.includes(String(payload.priority).toUpperCase())) errors.push('Priority must be High, Medium, or Low');
  return errors;
};

module.exports = {
  buildCourseData,
  validateAssignmentPayload,
  validateChapterPayload,
  validateCoursePayload,
  validateLessonPayload,
  validateMaterialPayload,
  validateQuestionType,
};
