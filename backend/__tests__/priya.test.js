const prisma = require('../src/config/database');
const { askPriyaQuestion } = require('../src/services/ai/priyaAgent');

describe('Priya HR Agent Core Capability & Self-Improving Feedback Loop', () => {
  let testUser = null;
  let testEmployee = null;
  let managerUser = null;

  beforeAll(async () => {
    // Fetch a seeded employee and their corresponding user account
    testEmployee = await prisma.employee.findFirst({
      where: {
        user: { isNot: null },
        leaveQuotas: { some: {} }
      },
      include: { user: true }
    });

    if (testEmployee && testEmployee.user) {
      testUser = {
        id: testEmployee.user.id,
        email: testEmployee.user.email,
        role: testEmployee.user.role,
        companyId: testEmployee.user.companyId,
        employeeId: testEmployee.id
      };
    }

    // Fetch a manager employee
    const managerEmp = await prisma.employee.findFirst({
      where: {
        user: { role: 'MANAGER' }
      },
      include: { user: true }
    });

    if (managerEmp && managerEmp.user) {
      managerUser = {
        id: managerEmp.user.id,
        email: managerEmp.user.email,
        role: managerEmp.user.role,
        companyId: managerEmp.user.companyId,
        employeeId: managerEmp.id
      };
    }
  });

  afterAll(async () => {
    // Clean up test feedback logs
    await prisma.agentFeedback.deleteMany({
      where: { agentName: 'Priya' }
    });
    await prisma.$disconnect();
  });

  it('Priya successfully answers employee leave queries using live database quotas', async () => {
    if (!testUser) {
      console.warn('Skipping test: No test user found with active leave quotas.');
      return;
    }
    const result = await askPriyaQuestion('How many leaves do I have?', testUser);
    expect(result.success).toBe(true);
    expect(result.agentName).toBe('Priya');
    expect(result.intentType).toBe('EMPLOYEE_LEAVES');
    expect(result.answer).toMatch(/leave|quota|balance/i);
  });

  it('Priya successfully answers manager requests for team low attendance alerts', async () => {
    if (!managerUser) {
      console.warn('Skipping test: No manager user found.');
      return;
    }
    const result = await askPriyaQuestion('Show employees with low attendance', managerUser);
    expect(result.success).toBe(true);
    expect(result.intentType).toBe('LOW_ATTENDANCE');
    expect(result.answer).toBeTruthy();
  });

  it('Priya applies admin feedback corrections to self-correct answers (Self-Improving RAG)', async () => {
    if (!testUser) return;
    
    const mockQuestion = 'What is the travel expense limit?';
    
    // Step A: Ask the question initially
    const initialResult = await askPriyaQuestion(mockQuestion, testUser);
    expect(initialResult.success).toBe(true);

    // Step B: Submit a corrected response to simulated feedback table
    const correctedAnswer = 'The travel expense limit has been officially updated to INR 5000 per day including meals.';
    await prisma.agentFeedback.create({
      data: {
        agentName: 'Priya',
        companyId: testUser.companyId,
        userId: testUser.id,
        question: mockQuestion,
        response: initialResult.answer,
        rating: -1,
        feedbackText: 'Outdated limits reported.',
        isCorrected: true,
        correctedText: correctedAnswer
      }
    });

    // Step C: Ask the same question again and verify it pulls the correction
    const secondaryResult = await askPriyaQuestion(mockQuestion, testUser);
    expect(secondaryResult.success).toBe(true);
    // The engine should fetch the corrected text in context and the answer should reflect or incorporate it
    expect(secondaryResult.answer).toContain('5000');
  });
});
