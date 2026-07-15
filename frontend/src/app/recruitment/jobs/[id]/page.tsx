'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/lib/toastContext';
import {
  getJobOpeningById,
  updateApplicantStage,
  getApplicantReviews,
  createApplicantReview,
  applyForJob,
  scheduleInterview,
  resendInterviewEmail,
  submitInterviewFeedback,
  createJobOffer,
  updateJobOffer,
  generateJobOfferPdf,
  sendJobOffer,
  downloadOfferLetterPDF,
  type JobOfferPayload,
} from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { validateForm, email as vEmail, mobile as vMobile, personName, required, date as vDate, amount } from '@/lib/validators';
import {
  Badge,
  Banner,
  Button,
  ConfirmDialog,
  Drawer,
  LoadingBlock,
  Modal,
  Select,
  TextField,
  Textarea,
  type Tone,
} from '@/components/ui';

interface Interview {
  id: string;
  roundName: string;
  interviewerName: string;
  interviewDate: string;
  status: string;
  interviewMode?: string;
  meetingLink?: string;
  location?: string;
  instructions?: string;
  emailStatus?: string;
  emailSentAt?: string;
  emailFailureReason?: string;
  feedback?: string;
  rating?: number;
}

interface JobOffer {
  id: string;
  offeredSalary: number;
  offeredCtc?: number | string;
  basicSalary?: number | string | null;
  hra?: number | string | null;
  specialAllowance?: number | string | null;
  otherAllowances?: number | string | null;
  variablePay?: number | string | null;
  joiningBonus?: number | string | null;
  workLocation?: string | null;
  employmentType?: string | null;
  joiningDate: string;
  probationPeriod?: string | null;
  noticePeriod?: string | null;
  reportingManager?: string | null;
  reportingManagerTitle?: string | null;
  workingHours?: string | null;
  offerExpiryDate?: string | null;
  additionalTerms?: string | null;
  signatoryName?: string | null;
  signatoryDesignation?: string | null;
  status: string;
  pdfFileName?: string | null;
  pdfStorageKey?: string | null;
  sentAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  emailStatus?: string | null;
  emailFailureReason?: string | null;
  updatedAt?: string;
}

interface Applicant {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  coverLetter?: string;
  resumeUrl?: string;
  experience?: string;
  skills?: string;
  currentCtc?: string;
  expectedCtc?: string;
  noticePeriod?: string;
  stage: string;
  rating?: number;
  notes?: string;
  updatedAt?: string;
  interviews: Interview[];
  jobOffer?: JobOffer;
  createdAt: string;
}

interface CandidateReview {
  id: string;
  reviewerName: string;
  reviewerRole?: string;
  rating: number;
  reviewText: string;
  candidateStage: string;
  reviewType?: string;
  interviewRoundId?: string | null;
  interviewRoundName?: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface JobDetails {
  id: string;
  title: string;
  department: { name: string };
  location: string;
  employmentType: string;
  salaryRange?: string;
  description: string;
  requirements: string;
  applicants: Applicant[];
}

const ACTIVE_STAGE_ORDER = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'ONBOARDING'];
const TERMINAL_STAGE = 'REJECTED';
const STAGES = [...ACTIVE_STAGE_ORDER, TERMINAL_STAGE];

const STAGE_LABELS: Record<string, string> = {
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interviews',
  OFFER: 'Offer Extended',
  REJECTED: 'Archived / Rejected',
  ONBOARDING: 'Onboarding',
  HIRED: 'Hired',
};

// Tokenized stage accent colors (no hardcoded hex).
const STAGE_COLORS: Record<string, string> = {
  APPLIED: 'var(--accent)',
  SCREENING: 'var(--accent)',
  INTERVIEW: 'var(--accent)',
  OFFER: 'var(--warning-fg)',
  REJECTED: 'var(--danger-fg)',
  HIRED: 'var(--success-fg)',
  ONBOARDING: 'var(--success-fg)',
};

const STAGE_TONE: Record<string, Tone> = {
  APPLIED: 'info',
  SCREENING: 'info',
  INTERVIEW: 'info',
  OFFER: 'warning',
  REJECTED: 'danger',
  HIRED: 'success',
  ONBOARDING: 'success',
};

const RATING_OPTIONS = [
  { value: '5', label: '5 - Excellent Candidate' },
  { value: '4', label: '4 - Strong Candidate' },
  { value: '3', label: '3 - Qualified Candidate' },
  { value: '2', label: '2 - Borderline Candidate' },
  { value: '1', label: '1 - Not Qualified' },
];

const ROUND_OPTIONS = [
  { value: 'Technical Round 1', label: 'Technical Round 1' },
  { value: 'System Design & Architecture', label: 'System Design & Architecture' },
  { value: 'Managerial Interview', label: 'Managerial Interview' },
  { value: 'HR & Culture Round', label: 'HR & Culture Round' },
];

const INTERVIEW_MODE_OPTIONS = [
  { value: 'ONLINE', label: 'Online' },
  { value: 'IN_PERSON', label: 'In person' },
  { value: 'PHONE', label: 'Phone' },
];

const getAllowedForwardStages = (currentStage: string) => {
  if (currentStage === 'ONBOARDING' || currentStage === TERMINAL_STAGE) return [];
  const currentIndex = ACTIVE_STAGE_ORDER.indexOf(currentStage);
  if (currentIndex === -1) return [];

  return [...ACTIVE_STAGE_ORDER.slice(currentIndex + 1), TERMINAL_STAGE];
};

const toDatetimeLocalValue = (date: Date) => {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const AddCandidateIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
);

const BackIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
);

export default function JobBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [pendingApplicant, setPendingApplicant] = useState<Applicant | null>(null);
  const [pendingDrawerClose, setPendingDrawerClose] = useState(false);
  const [stageUpdatingId, setStageUpdatingId] = useState<string | null>(null);

  // Modals & Drawers
  const [showAddApplicant, setShowAddApplicant] = useState(false);
  const [showScheduleInterview, setShowScheduleInterview] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState<Interview | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showOfferPreview, setShowOfferPreview] = useState(false);

  // Validation states
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [interviewDateError, setInterviewDateError] = useState('');

  // Submit-in-flight states
  const [savingApplicant, setSavingApplicant] = useState(false);
  const [savingInterview, setSavingInterview] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [savingOffer, setSavingOffer] = useState(false);
  const [generatingOfferId, setGeneratingOfferId] = useState<string | null>(null);
  const [sendingOfferId, setSendingOfferId] = useState<string | null>(null);
  const [savingReview, setSavingReview] = useState(false);
  const [resendingInterviewId, setResendingInterviewId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [reviewHistory, setReviewHistory] = useState<CandidateReview[]>([]);
  const [reviewHistoryLoading, setReviewHistoryLoading] = useState(false);

  // Form states
  const [applicantForm, setApplicantForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    coverLetter: '',
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const [interviewForm, setInterviewForm] = useState({
    interviewerName: '',
    interviewDate: '',
    roundName: 'Technical Round 1',
    interviewMode: 'ONLINE',
    meetingLink: '',
    location: '',
    instructions: '',
  });

  const [feedbackForm, setFeedbackForm] = useState({
    feedback: '',
    rating: 5,
    status: 'COMPLETED',
  });
  const [savedReview, setSavedReview] = useState('');
  const [draftReview, setDraftReview] = useState('');
  const [savedRating, setSavedRating] = useState(0);
  const [draftRating, setDraftRating] = useState(0);

  const [offerForm, setOfferForm] = useState({
    offeredCtc: '',
    basicSalary: '',
    hra: '',
    specialAllowance: '',
    otherAllowances: '',
    variablePay: '',
    joiningBonus: '',
    workLocation: '',
    employmentType: 'FULL_TIME',
    joiningDate: '',
    probationPeriod: '6 months',
    noticePeriod: '',
    reportingManager: '',
    reportingManagerTitle: '',
    workingHours: '9:30 AM to 6:30 PM',
    offerExpiryDate: '',
    additionalTerms: '',
    signatoryName: '',
    signatoryDesignation: '',
  });

  const toNumberOrNull = (value: string) => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const fixedCompensation = ['basicSalary', 'hra', 'specialAllowance', 'otherAllowances']
    .reduce((sum, key) => sum + Number((offerForm as any)[key] || 0), 0);
  const variableCompensation = Number(offerForm.variablePay || 0) + Number(offerForm.joiningBonus || 0);
  const salaryTotal = fixedCompensation + variableCompensation;
  const offeredCtcNumber = Number(offerForm.offeredCtc || 0);

  const resetOfferForm = (applicant?: Applicant | null) => {
    const offer = applicant?.jobOffer;
    setOfferForm({
      offeredCtc: String(offer?.offeredCtc ?? offer?.offeredSalary ?? ''),
      basicSalary: String(offer?.basicSalary ?? ''),
      hra: String(offer?.hra ?? ''),
      specialAllowance: String(offer?.specialAllowance ?? ''),
      otherAllowances: String(offer?.otherAllowances ?? ''),
      variablePay: String(offer?.variablePay ?? ''),
      joiningBonus: String(offer?.joiningBonus ?? ''),
      workLocation: offer?.workLocation || job?.location || '',
      employmentType: offer?.employmentType || job?.employmentType || 'FULL_TIME',
      joiningDate: offer?.joiningDate ? offer.joiningDate.slice(0, 10) : '',
      probationPeriod: offer?.probationPeriod || '6 months',
      noticePeriod: offer?.noticePeriod || applicant?.noticePeriod || '',
      reportingManager: offer?.reportingManager || '',
      reportingManagerTitle: offer?.reportingManagerTitle || '',
      workingHours: offer?.workingHours || '9:30 AM to 6:30 PM',
      offerExpiryDate: offer?.offerExpiryDate ? offer.offerExpiryDate.slice(0, 10) : '',
      additionalTerms: offer?.additionalTerms || '',
      signatoryName: offer?.signatoryName || '',
      signatoryDesignation: offer?.signatoryDesignation || '',
    });
  };

  const buildOfferPayload = (): JobOfferPayload => ({
    offeredCtc: Number(offerForm.offeredCtc),
    basicSalary: toNumberOrNull(offerForm.basicSalary),
    hra: toNumberOrNull(offerForm.hra),
    specialAllowance: toNumberOrNull(offerForm.specialAllowance),
    otherAllowances: toNumberOrNull(offerForm.otherAllowances),
    variablePay: toNumberOrNull(offerForm.variablePay),
    joiningBonus: toNumberOrNull(offerForm.joiningBonus),
    workLocation: offerForm.workLocation.trim(),
    employmentType: offerForm.employmentType,
    joiningDate: offerForm.joiningDate,
    probationPeriod: offerForm.probationPeriod.trim(),
    noticePeriod: offerForm.noticePeriod.trim(),
    reportingManager: offerForm.reportingManager.trim(),
    reportingManagerTitle: offerForm.reportingManagerTitle.trim(),
    workingHours: offerForm.workingHours.trim(),
    offerExpiryDate: offerForm.offerExpiryDate,
    additionalTerms: offerForm.additionalTerms.trim(),
    signatoryName: offerForm.signatoryName.trim(),
    signatoryDesignation: offerForm.signatoryDesignation.trim(),
    updatedAt: selectedApplicant?.jobOffer?.updatedAt,
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user) loadData();
  }, [user, jobId]);

  useEffect(() => {
    if (!selectedApplicant) return;
    setSavedReview('');
    setDraftReview('');
    setSavedRating(0);
    setDraftRating(0);
    setReviewError('');
    setReviewSuccess('');
    loadReviewHistory(selectedApplicant.id);
  }, [selectedApplicant?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getJobOpeningById(jobId);
      setJob(data);
      if (selectedApplicant) {
        const updatedApp = data.applicants.find((a: any) => a.id === selectedApplicant.id);
        if (updatedApp) setSelectedApplicant(updatedApp);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateApplicantInState = (applicantId: string, patch: Partial<Applicant>) => {
    setJob(prev => prev ? {
      ...prev,
      applicants: prev.applicants.map(app => app.id === applicantId ? { ...app, ...patch } : app),
    } : prev);
    setSelectedApplicant(prev => prev?.id === applicantId ? { ...prev, ...patch } : prev);
  };

  const loadReviewHistory = async (applicantId: string) => {
    setReviewHistoryLoading(true);
    try {
      const data = await getApplicantReviews(applicantId);
      setReviewHistory(Array.isArray(data?.reviews) ? data.reviews : []);
    } catch (err) {
      console.error(err);
      setReviewHistory([]);
    } finally {
      setReviewHistoryLoading(false);
    }
  };

  const isReviewDirty = !!selectedApplicant && (
    draftReview !== savedReview || draftRating !== savedRating
  );

  useEffect(() => {
    if (!isReviewDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isReviewDirty]);

  const resetReviewDraft = () => {
    setDraftReview(savedReview);
    setDraftRating(savedRating);
    setReviewError('');
    setReviewSuccess('');
  };

  const handleSelectApplicant = (applicant: Applicant) => {
    if (selectedApplicant?.id === applicant.id) return;
    if (isReviewDirty) {
      setPendingApplicant(applicant);
      return;
    }
    setSelectedApplicant(applicant);
  };

  const handleCandidateDrawerClose = () => {
    if (isReviewDirty) {
      setPendingDrawerClose(true);
      return;
    }
    setSelectedApplicant(null);
  };

  const discardReviewChanges = () => {
    resetReviewDraft();
    if (pendingApplicant) {
      setSelectedApplicant(pendingApplicant);
      setPendingApplicant(null);
    } else if (pendingDrawerClose) {
      setSelectedApplicant(null);
      setPendingDrawerClose(false);
    }
  };

  const handleSaveReview = async () => {
    if (!selectedApplicant || !isReviewDirty || savingReview) return;
    const trimmedReview = draftReview.trim();
    if (!draftRating) {
      setReviewError('Select a rating before adding the review.');
      return;
    }
    if (!trimmedReview) {
      setReviewError('Review text is required.');
      return;
    }
    if (trimmedReview.length > 5000) {
      setReviewError('Review notes cannot exceed 5000 characters.');
      return;
    }

    setSavingReview(true);
    setReviewError('');
    setReviewSuccess('');
    try {
      const result = await createApplicantReview(selectedApplicant.id, {
        rating: draftRating,
        reviewText: trimmedReview,
      });
      const createdReview = result?.review;
      if (createdReview) {
        setReviewHistory(current => [createdReview, ...current]);
      }
      updateApplicantInState(selectedApplicant.id, {
        rating: draftRating,
        notes: trimmedReview,
      });
      setSavedReview('');
      setDraftReview('');
      setSavedRating(0);
      setDraftRating(0);
      setReviewSuccess('Review saved successfully.');
      showToast('Review saved successfully.', 'success');
    } catch (err: any) {
      setReviewError(err?.response?.data?.error || 'Could not save the review. Please try again.');
      showToast('Could not save the review. Please try again.', 'error');
    } finally {
      setSavingReview(false);
    }
  };

  const handleStageChange = async (applicantId: string, newStage: string) => {
    if (stageUpdatingId) return;
    const currentApplicant = job?.applicants.find(app => app.id === applicantId);
    if (!currentApplicant || currentApplicant.stage === newStage) return;
    const allowedStages = getAllowedForwardStages(currentApplicant.stage);
    if (!allowedStages.includes(newStage)) return;

    const previousStage = currentApplicant.stage;
    setStageUpdatingId(applicantId);
    updateApplicantInState(applicantId, { stage: newStage });
    try {
      const updatedApplicant = await updateApplicantStage(applicantId, { stage: newStage });
      updateApplicantInState(applicantId, updatedApplicant);
    } catch (err) {
      console.error(err);
      updateApplicantInState(applicantId, { stage: previousStage });
    } finally {
      setStageUpdatingId(null);
    }
  };

  const handleAddApplicant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const { isValid, firstError } = validateForm(
      {
        fullName: applicantForm.fullName,
        email: applicantForm.email,
        phone: applicantForm.phone,
      },
      {
        fullName: personName('Full name'),
        email: vEmail,
        phone: vMobile,
      }
    );
    if (!isValid) {
      setFormError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    setFormError('');
    setSavingApplicant(true);
    try {
      const formData = new FormData();
      formData.append('jobOpeningId', jobId);
      formData.append('fullName', applicantForm.fullName);
      formData.append('email', applicantForm.email);
      formData.append('phone', applicantForm.phone);
      formData.append('coverLetter', applicantForm.coverLetter);
      formData.append('source', 'MANUAL');
      if (resumeFile) formData.append('resume', resumeFile);

      await applyForJob(formData);
      setShowAddApplicant(false);
      setSubmitted(false);
      setApplicantForm({ fullName: '', email: '', phone: '', coverLetter: '' });
      setResumeFile(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to add candidate profile');
    } finally {
      setSavingApplicant(false);
    }
  };

  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApplicant || savingInterview) return;
    if (selectedApplicant.stage !== 'INTERVIEW') {
      setFormError('Interview rounds can only be scheduled when the candidate is in the Interviews stage.');
      return;
    }
    setSubmitted(true);
    setFormError('');
    setInterviewDateError('');
    const { isValid, firstError } = validateForm(
      {
        interviewerName: interviewForm.interviewerName,
        roundName: interviewForm.roundName,
        interviewDate: interviewForm.interviewDate,
      },
      {
        interviewerName: personName('Interviewer name'),
        roundName: required('Round'),
        interviewDate: vDate('Interview date'),
      }
    );
    if (!isValid) {
      setFormError(firstError || 'Please correct the highlighted fields.');
      return;
    }

    const scheduledAt = new Date(interviewForm.interviewDate);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      setInterviewDateError('Please select a future interview date and time.');
      setFormError('Please select a future interview date and time.');
      return;
    }
    if (interviewForm.interviewMode === 'ONLINE' && !interviewForm.meetingLink.trim()) {
      setFormError('Meeting link is required for online interviews.');
      return;
    }
    if (interviewForm.interviewMode === 'IN_PERSON' && !interviewForm.location.trim()) {
      setFormError('Location is required for in-person interviews.');
      return;
    }

    setFormError('');
    setSavingInterview(true);
    try {
      const result = await scheduleInterview({
        applicantId: selectedApplicant.id,
        interviewerName: interviewForm.interviewerName.trim(),
        roundName: interviewForm.roundName.trim(),
        interviewDate: scheduledAt.toISOString(),
        interviewMode: interviewForm.interviewMode,
        meetingLink: interviewForm.meetingLink.trim(),
        location: interviewForm.location.trim(),
        instructions: interviewForm.instructions.trim(),
      });
      setShowScheduleInterview(false);
      setSubmitted(false);
      setInterviewDateError('');
      setInterviewForm({ interviewerName: '', interviewDate: '', roundName: 'Technical Round 1', interviewMode: 'ONLINE', meetingLink: '', location: '', instructions: '' });
      await loadData();
      showToast(
        result?.emailStatus === 'SENT'
          ? 'Interview scheduled and candidate notified by email.'
          : 'Interview scheduled, but the candidate email could not be sent.',
        result?.emailStatus === 'SENT' ? 'success' : 'error'
      );
    } catch (err: any) {
      console.error(err);
      setFormError(err?.response?.data?.message || err?.response?.data?.error || 'Failed to schedule interview round.');
    } finally {
      setSavingInterview(false);
    }
  };

  const handleResendInterviewEmail = async (interviewId: string) => {
    if (resendingInterviewId) return;
    setResendingInterviewId(interviewId);
    try {
      const result = await resendInterviewEmail(interviewId);
      await loadData();
      showToast(
        result?.emailStatus === 'SENT'
          ? 'Interview email resent successfully.'
          : 'Interview email could not be resent.',
        result?.emailStatus === 'SENT' ? 'success' : 'error'
      );
    } catch (err: any) {
      console.error(err);
      showToast(err?.response?.data?.error || 'Interview email could not be resent.', 'error');
    } finally {
      setResendingInterviewId(null);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showFeedbackModal) return;
    setSubmitted(true);
    const { isValid, firstError } = validateForm(
      { feedback: feedbackForm.feedback },
      { feedback: required('Feedback') }
    );
    if (!isValid) {
      setFormError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    setFormError('');
    setSavingFeedback(true);
    try {
      await submitInterviewFeedback(showFeedbackModal.id, feedbackForm);
      setShowFeedbackModal(null);
      setSubmitted(false);
      setFeedbackForm({ feedback: '', rating: 5, status: 'COMPLETED' });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to log feedback');
    } finally {
      setSavingFeedback(false);
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApplicant) return;
    setSubmitted(true);
    const { isValid, firstError } = validateForm(
      {
        offeredCtc: offerForm.offeredCtc,
        joiningDate: offerForm.joiningDate,
        workLocation: offerForm.workLocation,
        employmentType: offerForm.employmentType,
        reportingManager: offerForm.reportingManager,
        offerExpiryDate: offerForm.offerExpiryDate,
        signatoryName: offerForm.signatoryName,
        signatoryDesignation: offerForm.signatoryDesignation,
      },
      {
        offeredCtc: amount,
        joiningDate: vDate('Joining date'),
        workLocation: required('Work location'),
        employmentType: required('Employment type'),
        reportingManager: required('Reporting manager'),
        offerExpiryDate: vDate('Offer expiry date'),
        signatoryName: personName('HR signatory name'),
        signatoryDesignation: required('HR signatory designation'),
      }
    );
    if (!isValid) {
      setFormError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    if (new Date(offerForm.offerExpiryDate) >= new Date(offerForm.joiningDate)) {
      setFormError('Offer expiry date must be before the joining date.');
      return;
    }
    setFormError('');
    setSavingOffer(true);
    try {
      const payload = buildOfferPayload();
      const savedOffer = selectedApplicant.jobOffer?.id
        ? await updateJobOffer(selectedApplicant.jobOffer.id, payload)
        : await createJobOffer(selectedApplicant.id, payload);
      updateApplicantInState(selectedApplicant.id, { jobOffer: savedOffer });
      setShowOfferModal(false);
      setShowOfferPreview(false);
      setSubmitted(false);
      showToast('Offer draft saved.', 'success');
    } catch (err: any) {
      console.error(err);
      setFormError(err?.response?.data?.error || 'Failed to save job offer draft');
    } finally {
      setSavingOffer(false);
    }
  };

  const handleGenerateOfferPdf = async (offerId: string) => {
    if (generatingOfferId) return;
    setGeneratingOfferId(offerId);
    try {
      const offer = await generateJobOfferPdf(offerId);
      if (selectedApplicant) updateApplicantInState(selectedApplicant.id, { jobOffer: offer });
      showToast('Offer PDF generated.', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Could not generate offer PDF.', 'error');
    } finally {
      setGeneratingOfferId(null);
    }
  };

  const handleSendOffer = async (offerId: string) => {
    if (sendingOfferId) return;
    setSendingOfferId(offerId);
    try {
      const offer = await sendJobOffer(offerId);
      if (selectedApplicant) updateApplicantInState(selectedApplicant.id, { jobOffer: offer });
      showToast(offer.emailStatus === 'SENT' ? 'Offer sent to candidate.' : 'Offer email failed. You can resend it.', offer.emailStatus === 'SENT' ? 'success' : 'error');
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Could not send offer.', 'error');
    } finally {
      setSendingOfferId(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="app-layout">
        <Sidebar activePath="/recruitment" />
        <main className="main-content">
          <LoadingBlock label="Loading job board..." />
        </main>
      </div>
    );
  }

  if (loading || !job) {
    return (
      <div className="app-layout">
        <Sidebar activePath="/recruitment" />
        <main className="main-content">
          <LoadingBlock label="Loading pipeline details..." />
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar activePath="/recruitment" />
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', padding: 0 }}>

        {/* Sub-header inside main-content */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Button variant="link" size="sm" leftIcon={BackIcon} onClick={() => router.push('/recruitment')} style={{ padding: 0 }}>
                Back to Jobs
              </Button>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>/</span>
              <Badge tone="info">{job.department?.name}</Badge>
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{job.title}</h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{job.location} · {job.employmentType.replace('_', ' ')} · {job.salaryRange || 'No disclosed package'}</p>
          </div>

          <Button variant="success" leftIcon={AddCandidateIcon} onClick={() => { setSubmitted(false); setFormError(''); setShowAddApplicant(true); }}>
            Add Candidate Profile
          </Button>
        </div>

        {/* Kanban Board Container */}
        <div style={{ flex: 1, display: 'flex', gap: '1rem', padding: '1.25rem', overflowX: 'auto', background: 'var(--surface-canvas)' }}>
          {STAGES.map(stage => {
            const applicantsInStage = job.applicants.filter(a => a.stage === stage);
            return (
              <div key={stage} style={{ flexShrink: 0, width: '275px', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '0.75rem' }}>
                {/* Column Title */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: `2px solid ${STAGE_COLORS[stage]}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STAGE_COLORS[stage] }}></span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{STAGE_LABELS[stage]}</span>
                  </div>
                  <Badge tone="neutral">{applicantsInStage.length}</Badge>
                </div>

                {/* Candidate list inside Column */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
                  {applicantsInStage.length === 0 ? (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                      No candidates
                    </div>
                  ) : (
                    applicantsInStage.map(app => (
                      <div key={app.id} onClick={() => handleSelectApplicant(app)} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.75rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.35rem', boxShadow: 'var(--shadow-1)', transition: 'transform var(--motion-fast) var(--ease-out)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{app.fullName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.email}</div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                          {/* Rating display */}
                          <div style={{ display: 'flex', gap: '2px', color: 'var(--warning-fg)' }}>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} style={{ fontSize: '0.65rem' }}>{i < (app.rating || 0) ? '★' : '☆'}</span>
                            ))}
                          </div>

                          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                            {new Date(app.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Candidate Modal */}
        <Modal
          open={showAddApplicant}
          onClose={() => setShowAddApplicant(false)}
          title="Add Candidate Profile"
          width={520}
        >
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Manually register applicant details
          </p>

          {formError && (
            <div style={{ marginBottom: '1rem' }}>
              <Banner tone="danger">{formError}</Banner>
            </div>
          )}

          <form onSubmit={handleAddApplicant}>
            <TextField
              label="Full Name"
              placeholder="John Doe"
              required
              value={applicantForm.fullName}
              onChange={v => setApplicantForm({ ...applicantForm, fullName: v })}
              validator={personName('Full name')}
              restrict="alpha"
              forceError={submitted}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <TextField
                label="Email Address"
                type="email"
                placeholder="john@example.com"
                required
                value={applicantForm.email}
                onChange={v => setApplicantForm({ ...applicantForm, email: v })}
                validator={vEmail}
                forceError={submitted}
              />
              <TextField
                label="Phone Number"
                type="tel"
                placeholder="10-digit mobile"
                required
                value={applicantForm.phone}
                onChange={v => setApplicantForm({ ...applicantForm, phone: v })}
                validator={vMobile}
                restrict="digits"
                maxLength={10}
                forceError={submitted}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Upload Resume (PDF, DOCX)</label>
              <input type="file" accept=".pdf,.doc,.docx" onChange={e => setResumeFile(e.target.files ? e.target.files[0] : null)} style={{ width: '100%', fontSize: '0.75rem', color: 'var(--text-secondary)' }} />
              {resumeFile && <span style={{ display: 'block', marginTop: 4, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{resumeFile.name}</span>}
            </div>

            <Textarea
              label="Cover Letter / Notes"
              placeholder="Candidate career aspirations…"
              value={applicantForm.coverLetter}
              onChange={v => setApplicantForm({ ...applicantForm, coverLetter: v })}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <Button type="button" variant="ghost" onClick={() => setShowAddApplicant(false)}>Cancel</Button>
              <Button type="submit" variant="success" loading={savingApplicant}>Register Candidate</Button>
            </div>
          </form>
        </Modal>

        {/* Candidate Detail Drawer */}
        <Drawer
          open={!!selectedApplicant}
          onClose={handleCandidateDrawerClose}
          title={selectedApplicant?.fullName || 'Candidate'}
          width={480}
        >
          {selectedApplicant && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Stage chip + selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <Badge tone={STAGE_TONE[selectedApplicant.stage] || 'neutral'} dot>
                  {STAGE_LABELS[selectedApplicant.stage]}
                </Badge>
                {getAllowedForwardStages(selectedApplicant.stage).length > 0 ? (
                  <div style={{ minWidth: '180px' }}>
                    <Select
                      value=""
                      onChange={v => handleStageChange(selectedApplicant.id, v)}
                      placeholder="Move candidate to..."
                      disabled={stageUpdatingId === selectedApplicant.id}
                      options={getAllowedForwardStages(selectedApplicant.stage).map(s => ({ value: s, label: STAGE_LABELS[s] }))}
                    />
                  </div>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {selectedApplicant.stage === 'ONBOARDING' ? 'Recruitment process completed' : 'Stage movement disabled'}
                  </span>
                )}
              </div>

              {/* Contact Information */}
              <div style={{ padding: '0.75rem', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ color: 'var(--text-secondary)' }}>Email: {selectedApplicant.email}</div>
                <div style={{ color: 'var(--text-secondary)' }}>Phone: {selectedApplicant.phone}</div>
                {selectedApplicant.resumeUrl && (
                  <div style={{ marginTop: '0.25rem' }}>
                    <a href={`http://localhost:5000${selectedApplicant.resumeUrl}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      View Candidate Resume file
                    </a>
                  </div>
                )}
              </div>

              <div style={{ padding: '0.75rem', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                <div style={{ color: 'var(--text-secondary)' }}>Experience: {selectedApplicant.experience || 'Not provided'}</div>
                <div style={{ color: 'var(--text-secondary)' }}>Skills: {selectedApplicant.skills || 'Not provided'}</div>
                <div style={{ color: 'var(--text-secondary)' }}>Current CTC: {selectedApplicant.currentCtc || 'Not provided'}</div>
                <div style={{ color: 'var(--text-secondary)' }}>Expected CTC: {selectedApplicant.expectedCtc || 'Not provided'}</div>
                <div style={{ color: 'var(--text-secondary)' }}>Notice Period: {selectedApplicant.noticePeriod || 'Not provided'}</div>
              </div>

              {/* Interactive Rating */}
              <div>
                <label className="form-label">Candidate Evaluation Rating</label>
                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '1.2rem' }} aria-label="Candidate evaluation rating">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button key={i} type="button" onClick={() => { setDraftRating(i + 1); setReviewSuccess(''); }} aria-label={`Rate ${i + 1} star`} style={{ background: 'none', border: 'none', color: i < draftRating ? 'var(--warning-fg)' : 'var(--border-strong)', cursor: 'pointer', padding: 0 }}>
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Cover Letter */}
              {selectedApplicant.coverLetter && (
                <div>
                  <label className="form-label">Cover Letter & Introduction</label>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>{selectedApplicant.coverLetter}</p>
                </div>
              )}

              {/* Notes Area */}
              <div>
                <label className="form-label">Evaluation & Review Notes</label>
                <textarea
                  placeholder="Log applicant strong points, gaps, technical scores..."
                  value={draftReview}
                  maxLength={5000}
                  onChange={e => { setDraftReview(e.target.value); setReviewSuccess(''); }}
                  onKeyDown={e => {
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                      e.preventDefault();
                      handleSaveReview();
                    }
                  }}
                  className="textarea-field"
                  aria-busy={savingReview}
                  style={{ minHeight: '96px', fontSize: '0.75rem' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', color: draftReview.length > 5000 ? 'var(--danger-fg)' : 'var(--text-muted)' }}>
                    {draftReview.length} / 5000
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <Button type="button" size="sm" variant="ghost" onClick={resetReviewDraft} disabled={!isReviewDirty || savingReview}>
                      Cancel
                    </Button>
                    <Button type="button" size="sm" onClick={handleSaveReview} loading={savingReview} disabled={!isReviewDirty || savingReview}>
                      {savingReview ? 'Saving...' : 'Add Review'}
                    </Button>
                  </div>
                </div>
                {reviewSuccess && <div role="status" style={{ marginTop: '0.5rem', color: 'var(--success-fg)', fontSize: '0.75rem' }}>{reviewSuccess}</div>}
                {reviewError && <div role="alert" style={{ marginTop: '0.5rem', color: 'var(--danger-fg)', fontSize: '0.75rem' }}>{reviewError}</div>}
              </div>

              {/* Candidate Review History */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label className="form-label" style={{ margin: 0 }}>Candidate Review History</label>
                {reviewHistoryLoading ? (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)', textAlign: 'center' }}>
                    Loading reviews...
                  </div>
                ) : reviewHistory.length === 0 ? (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)', textAlign: 'center' }}>
                    No reviews have been added yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '340px', overflowY: 'auto', paddingRight: '0.2rem' }}>
                    {reviewHistory.map(review => (
                      <div key={review.id} style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
                            {(review.reviewerName || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{review.reviewerName}</div>
                            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                              {review.reviewerRole && <Badge tone="neutral">{review.reviewerRole.replace(/_/g, ' ')}</Badge>}
                              <Badge tone="info">{STAGE_LABELS[review.candidateStage] || review.candidateStage}</Badge>
                              {review.interviewRoundName && <Badge tone="warning">{review.interviewRoundName}</Badge>}
                            </div>
                          </div>
                        </div>
                        <div style={{ color: 'var(--warning-fg)', fontSize: '0.8rem' }}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i}>{i < review.rating ? '★' : '☆'}</span>
                          ))}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {review.reviewText}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          Submitted: {new Date(review.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date(review.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Interviews Section */}
              {(selectedApplicant.interviews.length > 0 || selectedApplicant.stage === 'INTERVIEW') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ margin: 0 }}>Interview Status</label>
                    {selectedApplicant.stage === 'INTERVIEW' && (
                      <Button variant="ghost" size="sm" onClick={() => { setSubmitted(false); setFormError(''); setInterviewDateError(''); setShowScheduleInterview(true); }}>
                        Schedule Round
                      </Button>
                    )}
                  </div>

                  {selectedApplicant.interviews.length === 0 ? (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)', textAlign: 'center' }}>
                      No interview rounds scheduled yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {selectedApplicant.interviews.map(interview => (
                        <div key={interview.id} style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-primary)' }}>{interview.roundName}</span>
                            <Badge tone={interview.status === 'SCHEDULED' ? 'info' : 'success'}>{interview.status}</Badge>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Interviewer: {interview.interviewerName}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Date: {new Date(interview.interviewDate).toLocaleString()}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mode: {interview.interviewMode || 'ONLINE'}</div>
                          {(interview.meetingLink || interview.location) && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                              {interview.meetingLink ? `Meeting: ${interview.meetingLink}` : `Location: ${interview.location}`}
                            </div>
                          )}
                          {interview.emailStatus && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <Badge tone={interview.emailStatus === 'SENT' ? 'success' : interview.emailStatus === 'FAILED' ? 'danger' : 'warning'}>
                                Email: {interview.emailStatus}
                              </Badge>
                              {interview.emailStatus === 'FAILED' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  loading={resendingInterviewId === interview.id}
                                  disabled={!!resendingInterviewId}
                                  onClick={() => handleResendInterviewEmail(interview.id)}
                                >
                                  Resend Email
                                </Button>
                              )}
                            </div>
                          )}
                          {interview.feedback ? (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'var(--surface-raised)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', marginTop: '0.25rem' }}>
                              <strong>Feedback:</strong> {interview.feedback} (Rating: {interview.rating}/5)
                            </div>
                          ) : (
                            <div style={{ marginTop: '0.25rem' }}>
                              <Button variant="ghost" size="sm" onClick={() => { setSubmitted(false); setFormError(''); setShowFeedbackModal(interview); }}>
                                Log Interview Feedback
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Job Offer Section */}
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label className="form-label" style={{ margin: 0 }}>Formal Job Offer Letter</label>
                {selectedApplicant.jobOffer ? (
                  <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--success-fg)' }}>Offer Extended</span>
                      <Button variant="success" size="sm" onClick={() => downloadOfferLetterPDF(selectedApplicant.jobOffer!.id, selectedApplicant.fullName)}>
                        Download Letter
                      </Button>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Annual Salary: ₹{selectedApplicant.jobOffer.offeredSalary.toLocaleString()}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Target Joining Date: {new Date(selectedApplicant.jobOffer.joiningDate).toLocaleDateString()}</div>
                    {selectedApplicant.jobOffer.emailStatus === 'FAILED' && (
                      <Banner tone="danger">Email delivery failed safely. The generated offer is preserved.</Banner>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                      <Button size="sm" variant="ghost" onClick={() => { resetOfferForm(selectedApplicant); setShowOfferPreview(true); }}>
                        View
                      </Button>
                      {selectedApplicant.jobOffer.status === 'DRAFT' && (
                        <Button size="sm" loading={generatingOfferId === selectedApplicant.jobOffer.id} disabled={!!generatingOfferId} onClick={() => handleGenerateOfferPdf(selectedApplicant.jobOffer!.id)}>
                          Generate PDF
                        </Button>
                      )}
                      {['GENERATED', 'SENT', 'VIEWED'].includes(selectedApplicant.jobOffer.status) && (
                        <Button size="sm" variant="warning" loading={sendingOfferId === selectedApplicant.jobOffer.id} disabled={!!sendingOfferId} onClick={() => handleSendOffer(selectedApplicant.jobOffer!.id)}>
                          {selectedApplicant.jobOffer.status === 'GENERATED' ? 'Send Offer' : 'Resend'}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  selectedApplicant.stage === 'OFFER' ? (
                    <Button variant="warning" fullWidth onClick={() => { resetOfferForm(selectedApplicant); setSubmitted(false); setFormError(''); setShowOfferModal(true); }}>
                      Generate Offer Letter
                    </Button>
                  ) : (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)' }}>
                      Offer generation becomes available when the candidate reaches Offer Extended.
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </Drawer>

        {/* Schedule Interview Modal */}
        <Modal
          open={showScheduleInterview}
          onClose={() => setShowScheduleInterview(false)}
          title="Schedule Interview Round"
          width={420}
        >
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Set up evaluation slot for {selectedApplicant?.fullName}
          </p>

          {formError && (
            <div style={{ marginBottom: '1rem' }}>
              <Banner tone="danger">{formError}</Banner>
            </div>
          )}

          <form onSubmit={handleScheduleInterview}>
            <Select
              label="Round Description"
              value={interviewForm.roundName}
              onChange={v => setInterviewForm({ ...interviewForm, roundName: v })}
              options={ROUND_OPTIONS}
            />

            <TextField
              label="Interviewer Full Name"
              placeholder="e.g. Senior Tech Lead"
              required
              value={interviewForm.interviewerName}
              onChange={v => setInterviewForm({ ...interviewForm, interviewerName: v })}
              validator={personName('Interviewer name')}
              restrict="alpha"
              forceError={submitted}
            />

            <Select
              label="Interview Mode"
              value={interviewForm.interviewMode}
              onChange={v => setInterviewForm({ ...interviewForm, interviewMode: v })}
              options={INTERVIEW_MODE_OPTIONS}
            />

            {interviewForm.interviewMode === 'ONLINE' && (
              <TextField
                label="Meeting Link"
                placeholder="https://meet.example.com/interview"
                required
                value={interviewForm.meetingLink}
                onChange={v => setInterviewForm({ ...interviewForm, meetingLink: v })}
                forceError={submitted}
              />
            )}

            {interviewForm.interviewMode === 'IN_PERSON' && (
              <TextField
                label="Location"
                placeholder="Office address or room"
                required
                value={interviewForm.location}
                onChange={v => setInterviewForm({ ...interviewForm, location: v })}
                forceError={submitted}
              />
            )}

            <div className="form-group">
              <label className="form-label">Interview Slot Date & Time</label>
              <input
                type="datetime-local"
                required
                min={toDatetimeLocalValue(new Date())}
                value={interviewForm.interviewDate}
                onChange={e => {
                  setInterviewDateError('');
                  setInterviewForm({ ...interviewForm, interviewDate: e.target.value });
                }}
                className="input-field"
              />
              {interviewDateError && <span style={{ display: 'block', marginTop: 4, fontSize: '0.72rem', color: 'var(--danger-fg)' }}>{interviewDateError}</span>}
            </div>

            <Textarea
              label="Interview Instructions"
              placeholder="Candidate preparation notes, documents to carry, or joining instructions"
              value={interviewForm.instructions}
              onChange={v => setInterviewForm({ ...interviewForm, instructions: v })}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <Button type="button" variant="ghost" disabled={savingInterview} onClick={() => setShowScheduleInterview(false)}>Cancel</Button>
              <Button type="submit" loading={savingInterview} disabled={savingInterview}>Confirm Schedule</Button>
            </div>
          </form>
        </Modal>

        {/* Feedback Modal */}
        <Modal
          open={!!showFeedbackModal}
          onClose={() => setShowFeedbackModal(null)}
          title="Log Interview Feedback"
          width={420}
        >
          {showFeedbackModal && (
            <>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                Complete evaluation report for {showFeedbackModal.roundName}
              </p>

              {formError && (
                <div style={{ marginBottom: '1rem' }}>
                  <Banner tone="danger">{formError}</Banner>
                </div>
              )}

              <form onSubmit={handleFeedbackSubmit}>
                <Select
                  label="Score / Rating (1 to 5)"
                  value={String(feedbackForm.rating)}
                  onChange={v => setFeedbackForm({ ...feedbackForm, rating: parseInt(v) })}
                  options={RATING_OPTIONS}
                />

                <Textarea
                  label="Evaluation Feedback Notes"
                  placeholder="Detail core strengths, skill gaps, architectural command…"
                  required
                  value={feedbackForm.feedback}
                  onChange={v => setFeedbackForm({ ...feedbackForm, feedback: v })}
                  validator={required('Feedback')}
                  forceError={submitted}
                />

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <Button type="button" variant="ghost" onClick={() => setShowFeedbackModal(null)}>Cancel</Button>
                  <Button type="submit" variant="success" loading={savingFeedback}>Submit Review</Button>
                </div>
              </form>
            </>
          )}
        </Modal>

        {/* Create Job Offer Modal */}
        <Modal
          open={showOfferModal}
          onClose={() => setShowOfferModal(false)}
          title="Issue Employment Offer"
          width={420}
        >
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Prepare formal agreement details for {selectedApplicant?.fullName}
          </p>

          {formError && (
            <div style={{ marginBottom: '1rem' }}>
              <Banner tone="danger">{formError}</Banner>
            </div>
          )}

          <form onSubmit={handleCreateOffer}>
            <TextField
              label="Offered Annual CTC (INR)"
              type="text"
              placeholder="e.g. 1200000"
              required
              value={offerForm.offeredCtc}
              onChange={v => setOfferForm({ ...offerForm, offeredCtc: v })}
              validator={amount}
              restrict="digits"
              forceError={submitted}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem' }}>
              {[
                ['basicSalary', 'Basic Salary'],
                ['hra', 'HRA'],
                ['specialAllowance', 'Special Allowance'],
                ['otherAllowances', 'Other Allowances'],
                ['variablePay', 'Variable Pay'],
                ['joiningBonus', 'Joining Bonus'],
              ].map(([key, label]) => (
                <TextField
                  key={key}
                  label={label}
                  type="text"
                  value={(offerForm as any)[key]}
                  onChange={v => setOfferForm({ ...offerForm, [key]: v })}
                  restrict="digits"
                />
              ))}
            </div>

            <div style={{ fontSize: '0.72rem', color: salaryTotal && offeredCtcNumber && salaryTotal !== offeredCtcNumber ? 'var(--warning-fg)' : 'var(--text-muted)', margin: '0.4rem 0 0.75rem' }}>
              Salary components total INR {salaryTotal.toLocaleString()} {salaryTotal && offeredCtcNumber && salaryTotal !== offeredCtcNumber ? 'and do not reconcile with offered CTC.' : ''}
            </div>

            <TextField
              label="Work Location"
              required
              value={offerForm.workLocation}
              onChange={v => setOfferForm({ ...offerForm, workLocation: v })}
              validator={required('Work location')}
              forceError={submitted}
            />

            <Select
              label="Employment Type"
              value={offerForm.employmentType}
              onChange={v => setOfferForm({ ...offerForm, employmentType: v })}
              options={[
                { value: 'FULL_TIME', label: 'Full time' },
                { value: 'PART_TIME', label: 'Part time' },
                { value: 'CONTRACT', label: 'Contract' },
                { value: 'INTERN', label: 'Intern' },
              ]}
            />

            <div className="form-group">
              <label className="form-label">Target Date of Joining</label>
              <input type="date" required value={offerForm.joiningDate} onChange={e => setOfferForm({ ...offerForm, joiningDate: e.target.value })} className="input-field" />
            </div>

            <div className="form-group">
              <label className="form-label">Offer Expiry Date</label>
              <input type="date" required value={offerForm.offerExpiryDate} onChange={e => setOfferForm({ ...offerForm, offerExpiryDate: e.target.value })} className="input-field" />
            </div>

            <TextField
              label="Reporting Manager"
              required
              value={offerForm.reportingManager}
              onChange={v => setOfferForm({ ...offerForm, reportingManager: v })}
              validator={personName('Reporting manager')}
              forceError={submitted}
            />

            <TextField
              label="Reporting Manager Designation"
              value={offerForm.reportingManagerTitle}
              onChange={v => setOfferForm({ ...offerForm, reportingManagerTitle: v })}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem' }}>
              <TextField label="Probation Period" value={offerForm.probationPeriod} onChange={v => setOfferForm({ ...offerForm, probationPeriod: v })} />
              <TextField label="Notice Period" value={offerForm.noticePeriod} onChange={v => setOfferForm({ ...offerForm, noticePeriod: v })} />
              <TextField label="Working Hours" value={offerForm.workingHours} onChange={v => setOfferForm({ ...offerForm, workingHours: v })} />
            </div>

            <Textarea
              label="Additional Terms"
              value={offerForm.additionalTerms}
              onChange={v => setOfferForm({ ...offerForm, additionalTerms: v })}
            />

            <TextField
              label="HR Signatory Name"
              required
              value={offerForm.signatoryName}
              onChange={v => setOfferForm({ ...offerForm, signatoryName: v })}
              validator={personName('HR signatory name')}
              forceError={submitted}
            />

            <TextField
              label="HR Signatory Designation"
              required
              value={offerForm.signatoryDesignation}
              onChange={v => setOfferForm({ ...offerForm, signatoryDesignation: v })}
              validator={required('HR signatory designation')}
              forceError={submitted}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <Button type="button" variant="ghost" onClick={() => setShowOfferModal(false)}>Cancel</Button>
              <Button type="button" variant="ghost" onClick={() => setShowOfferPreview(true)}>Preview</Button>
              <Button type="submit" variant="warning" loading={savingOffer}>Save Draft</Button>
            </div>
          </form>
        </Modal>

        <Modal
          open={showOfferPreview}
          onClose={() => setShowOfferPreview(false)}
          title="Offer Letter Preview"
          width={720}
        >
          <div style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>PID HCMS</div>
                <div>{job.location}</div>
              </div>
              <div>{new Date().toLocaleDateString()}</div>
            </div>
            <div style={{ textAlign: 'center', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Offer of Employment</div>
            <p>Dear {selectedApplicant?.fullName},</p>
            <p>We are pleased to offer you the position of <strong>{job.title}</strong> in the {job.department.name} department.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', margin: '1rem 0' }}>
              <div><strong>Work Location:</strong> {offerForm.workLocation || job.location}</div>
              <div><strong>Employment Type:</strong> {offerForm.employmentType}</div>
              <div><strong>Joining Date:</strong> {offerForm.joiningDate || 'Not set'}</div>
              <div><strong>Reporting Manager:</strong> {offerForm.reportingManager || 'Not set'}</div>
              <div><strong>Offer Expiry:</strong> {offerForm.offerExpiryDate || 'Not set'}</div>
              <div><strong>Offered CTC:</strong> INR {Number(offerForm.offeredCtc || 0).toLocaleString()}</div>
            </div>
            <p>This offer is subject to successful background verification, company policies, confidentiality obligations, and completion of required joining documentation.</p>
            {offerForm.additionalTerms && <p>{offerForm.additionalTerms}</p>}
            <div style={{ marginTop: '2rem' }}>
              <strong>{offerForm.signatoryName || 'HR Signatory'}</strong><br />
              {offerForm.signatoryDesignation || 'Designation'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <Button type="button" variant="ghost" onClick={() => setShowOfferPreview(false)}>Back to Edit</Button>
            <Button type="button" variant="warning" onClick={handleCreateOffer as any} loading={savingOffer}>Save Draft</Button>
          </div>
        </Modal>

        <ConfirmDialog
          open={!!pendingApplicant || pendingDrawerClose}
          title="You have unsaved changes"
          message="Discard them?"
          confirmLabel="Discard Changes"
          cancelLabel="Keep Editing"
          tone="danger"
          onConfirm={discardReviewChanges}
          onCancel={() => { setPendingApplicant(null); setPendingDrawerClose(false); }}
        />
      </main>
    </div>
  );
}
