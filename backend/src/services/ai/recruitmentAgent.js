const prisma = require('../../config/database');

const TERMINAL_STAGE = 'REJECTED';
const OFFER_STAGES = new Set(['OFFER', 'OFFER_EXTENDED']);
const ONBOARDING_STAGES = new Set(['ONBOARDING', 'HIRED']);

const formatDate = (value) => value ? new Date(value).toISOString().slice(0, 10) : 'No date';

const numberFromText = (value) => {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : null;
};

const lineList = (items, emptyText) => items.length ? items.map((item, index) => `${index + 1}. ${item}`).join('\n') : emptyText;

const summarizeJobs = (jobs) => jobs.map((job) => ({
  id: job.id,
  title: job.title,
  department: job.department?.name || 'General',
  status: job.status,
  location: job.location,
  applicantCount: job.applicants.length,
  applicants: job.applicants.map((applicant) => ({
    id: applicant.id,
    name: applicant.fullName,
    email: applicant.email,
    phone: applicant.phone,
    stage: applicant.stage,
    rating: applicant.rating || null,
    skills: applicant.skills || '',
    currentCtc: applicant.currentCtc || 'N/A',
    expectedCtc: applicant.expectedCtc || 'N/A',
    noticePeriod: applicant.noticePeriod || 'N/A',
    createdAt: formatDate(applicant.createdAt),
    interviews: applicant.interviews.map((interview) => ({
      roundName: interview.roundName,
      interviewerName: interview.interviewerName,
      status: interview.status,
      date: formatDate(interview.interviewDate),
      rating: interview.rating || null,
    })),
    reviews: applicant.reviews.map((review) => ({
      reviewerName: review.reviewerName,
      rating: review.rating,
      reviewType: review.reviewType,
    })),
    offer: applicant.jobOffer ? {
      status: applicant.jobOffer.status,
      joiningDate: formatDate(applicant.jobOffer.joiningDate),
      offeredSalary: Number(applicant.jobOffer.offeredSalary || 0),
    } : null,
  })),
}));

const answerRecruitmentQuestion = (question, jobs) => {
  const q = String(question || '').toLowerCase();
  const applicants = jobs.flatMap((job) => job.applicants.map((applicant) => ({ ...applicant, jobTitle: job.title, department: job.department })));
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const nextMonth = new Date(today);
  nextMonth.setMonth(today.getMonth() + 1);

  if (!jobs.length) return 'No recruitment data was found.';

  if (q.includes('screening')) {
    const rows = applicants.filter((candidate) => candidate.stage === 'SCREENING').map((candidate) => `${candidate.name} - ${candidate.jobTitle}, rating ${candidate.rating || 'N/A'}`);
    return lineList(rows, 'No candidates are currently in screening.');
  }

  if (q.includes('today') && q.includes('interview')) {
    const rows = applicants.flatMap((candidate) => candidate.interviews
      .filter((interview) => interview.date === formatDate(today))
      .map((interview) => `${candidate.name} - ${candidate.jobTitle}, ${interview.roundName} with ${interview.interviewerName} (${interview.status})`));
    return lineList(rows, "No interviews are scheduled for today.");
  }

  if (q.includes('highest applicant')) {
    const rows = [...jobs].sort((a, b) => b.applicantCount - a.applicantCount).slice(0, 10).map((job) => `${job.title}: ${job.applicantCount} applicant(s)`);
    return lineList(rows, 'No job applicant counts were found.');
  }

  if (q.includes('offer')) {
    const rows = applicants
      .filter((candidate) => OFFER_STAGES.has(candidate.stage) || candidate.offer)
      .map((candidate) => `${candidate.name} - ${candidate.jobTitle}, stage ${candidate.stage}, offer ${candidate.offer?.status || 'not generated'}`);
    return lineList(rows, 'No offer-stage candidates were found.');
  }

  if (q.includes('joining next month') || q.includes('onboarding')) {
    const rows = applicants
      .filter((candidate) => {
        const joiningDate = candidate.offer?.joiningDate && candidate.offer.joiningDate !== 'No date' ? new Date(candidate.offer.joiningDate) : null;
        return ONBOARDING_STAGES.has(candidate.stage) || (joiningDate && joiningDate >= today && joiningDate <= nextMonth);
      })
      .map((candidate) => `${candidate.name} - ${candidate.jobTitle}, joining ${candidate.offer?.joiningDate || 'N/A'}, stage ${candidate.stage}`);
    return lineList(rows, 'No onboarding or next-month joining candidates were found.');
  }

  if (q.includes('5-star') || q.includes('5 star') || q.includes('five-star')) {
    const rows = applicants
      .filter((candidate) => candidate.rating === 5 || candidate.reviews.some((review) => review.rating === 5) || candidate.interviews.some((interview) => interview.rating === 5))
      .map((candidate) => `${candidate.name} - ${candidate.jobTitle}, candidate rating ${candidate.rating || 'N/A'}`);
    return lineList(rows, 'No 5-star rated candidates were found.');
  }

  if (q.includes('notice')) {
    const threshold = numberFromText(q) || 30;
    const rows = applicants
      .filter((candidate) => {
        const days = numberFromText(candidate.noticePeriod);
        return candidate.noticePeriod.toLowerCase().includes('immediate') || (days !== null && days < threshold);
      })
      .map((candidate) => `${candidate.name} - ${candidate.jobTitle}, notice ${candidate.noticePeriod}, expected CTC ${candidate.expectedCtc}`);
    return lineList(rows, `No candidates with notice period below ${threshold} days were found.`);
  }

  if (q.includes('rejected')) {
    const rows = applicants.filter((candidate) => candidate.stage === TERMINAL_STAGE).map((candidate) => `${candidate.name} - ${candidate.jobTitle}, rating ${candidate.rating || 'N/A'}`);
    return lineList(rows, 'No rejected candidates were found.');
  }

  if (q.includes('java') || q.includes('developer') || q.includes('skill')) {
    const skill = q.includes('java') ? 'java' : q.includes('developer') ? 'developer' : '';
    const rows = applicants
      .filter((candidate) => `${candidate.skills} ${candidate.jobTitle}`.toLowerCase().includes(skill))
      .map((candidate) => `${candidate.name} - ${candidate.jobTitle}, skills ${candidate.skills || 'N/A'}, stage ${candidate.stage}`);
    return lineList(rows, `No candidates matched ${skill || 'the requested skill'}.`);
  }

  if (q.includes('stage')) {
    const stageCounts = applicants.reduce((map, candidate) => {
      map.set(candidate.stage, (map.get(candidate.stage) || 0) + 1);
      return map;
    }, new Map());
    return [...stageCounts.entries()].map(([stage, count]) => `${stage}: ${count} candidate(s)`).join('\n');
  }

  return [
    `Open jobs: ${jobs.filter((job) => job.status === 'OPEN').length}`,
    `Total applicants: ${applicants.length}`,
    `Interviews scheduled: ${applicants.reduce((sum, candidate) => sum + candidate.interviews.filter((interview) => interview.status === 'SCHEDULED').length, 0)}`,
    `Offer/onboarding candidates: ${applicants.filter((candidate) => OFFER_STAGES.has(candidate.stage) || ONBOARDING_STAGES.has(candidate.stage)).length}`,
    '',
    ...jobs.slice(0, 10).map((job) => `${job.title}: ${job.applicantCount} applicant(s), ${job.status}, ${job.department}`),
  ].join('\n');
};

const askRecruitmentQuestion = async (question) => {
  const jobs = await prisma.jobOpening.findMany({
    include: {
      department: { select: { name: true } },
      applicants: {
        include: {
          interviews: { orderBy: { interviewDate: 'asc' } },
          reviews: { orderBy: { createdAt: 'desc' } },
          jobOffer: true,
        },
        orderBy: { updatedAt: 'desc' },
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  });

  const summaries = summarizeJobs(jobs);
  return {
    success: true,
    agentName: 'Nova',
    engine: 'rule-based-database-query',
    readOnly: true,
    answer: answerRecruitmentQuestion(question, summaries),
    meta: {
      jobCount: summaries.length,
      applicantCount: summaries.reduce((sum, job) => sum + job.applicantCount, 0),
    },
  };
};

module.exports = { askRecruitmentQuestion };
