const prisma = require('../config/database');

const publishPulseSurvey = async (req, res) => {
  try {
    const { title, description } = req.body;
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(400).json({ error: 'No company context found.' });
    }

    // Only HR or Admin can publish surveys
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' && req.user.role !== 'HR') {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    const survey = await prisma.$transaction(async (tx) => {
      // Deactivate other surveys in the company
      await tx.pulseSurvey.updateMany({
        where: { companyId, isActive: true },
        data: { isActive: false }
      });

      // Create new active survey
      return await tx.pulseSurvey.create({
        data: {
          companyId,
          title,
          description,
          isActive: true
        }
      });
    });

    res.status(201).json(survey);
  } catch (error) {
    console.error('[PUBLISH SURVEY ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getActiveSurvey = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company context found.' });
    }

    const survey = await prisma.pulseSurvey.findFirst({
      where: { companyId, isActive: true }
    });

    res.json(survey || null);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const submitResponse = async (req, res) => {
  try {
    const { surveyId, score, feedback } = req.body;
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(400).json({ error: 'No company context found.' });
    }

    const survey = await prisma.pulseSurvey.findUnique({ where: { id: surveyId } });
    if (!survey || !survey.isActive) {
      return res.status(400).json({ error: 'Pulse survey is not active or does not exist.' });
    }

    const rating = parseInt(score);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Mood score must be an integer between 1 and 5.' });
    }

    const response = await prisma.pulseResponse.create({
      data: {
        companyId,
        surveyId,
        score: rating,
        feedback: feedback || ''
      }
    });

    res.status(201).json(response);
  } catch (error) {
    console.error('[SUBMIT RESPONSE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getPulseSummary = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company context found.' });
    }

    const activeSurvey = await prisma.pulseSurvey.findFirst({
      where: { companyId, isActive: true }
    });

    if (!activeSurvey) {
      return res.json({ survey: null, responseCount: 0, averageScore: 0, feedbackList: [] });
    }

    const responses = await prisma.pulseResponse.findMany({
      where: { surveyId: activeSurvey.id },
      select: {
        score: true,
        feedback: true,
        createdAt: true
      }
    });

    const count = responses.length;
    const totalScore = responses.reduce((acc, curr) => acc + curr.score, 0);
    const average = count > 0 ? Math.round((totalScore / count) * 10) / 10 : 0;

    res.json({
      survey: activeSurvey,
      responseCount: count,
      averageScore: average,
      feedbackList: responses.filter(r => r.feedback).map(r => ({
        text: r.feedback,
        date: r.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  publishPulseSurvey,
  getActiveSurvey,
  submitResponse,
  getPulseSummary
};
