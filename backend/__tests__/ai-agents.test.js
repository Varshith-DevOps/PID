const prisma = require('../src/config/database');
const { SherlockAgent, JarvisAgent, WinstonAgent, AthenaAgent } = require('../src/services/aiAgentService');

describe('Rule-based assistants ("AI agents") — honesty & correctness', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('every agent labels itself as non-AI and advisory', async () => {
    const s = await SherlockAgent.auditTdsProof({ category: 'HRA', amount: '120000', documentName: 'rent.pdf', rentDetails: { landlordPan: 'ABCDE1234F', monthlyRent: 12000 } });
    expect(s.aiPowered).toBe(false);
    expect(s.engine).toBe('rule-based-heuristic');
    expect(s.disclaimer).toMatch(/advisory|not ai/i);
    // No fabricated numeric fraud score; status is a suggestion pending review.
    expect(s.auditResult.fraudScore).toBeUndefined();
    expect(s.auditResult.suggestedStatus).toMatch(/REVIEW|LOOKS_OK/);
  });

  it('Winston no longer fabricates Git/Slack/VPN evidence and never auto-approves', async () => {
    const w = await WinstonAgent.resolveRegularization('emp-1', 'Monday 2026-06-15', '09:00', '18:00');
    expect(w.recommendation).toBe('MANAGER_REVIEW_REQUIRED');
    expect(w.integrationsConnected).toBe(false);
    expect(w.aiPowered).toBe(false);
    const blob = JSON.stringify(w).toLowerCase();
    expect(blob).not.toContain('git');
    expect(blob).not.toContain('vpn');
    expect(blob).not.toContain('slack');
    expect(blob).not.toContain('auto_approved');
  });

  it('Athena returns an advisory answer with a disclaimer', async () => {
    const a = await AthenaAgent.askPolicyQuestion('What is the gratuity rule?', null);
    expect(a.aiPowered).toBe(false);
    expect(a.disclaimer).toBeTruthy();
    expect(a.answer).toMatch(/gratuity/i);
  });

  it('Jarvis runs without throwing (salaryStructure relation fixed) and returns advisory output', async () => {
    const company = await prisma.company.findFirst();
    const result = await JarvisAgent.auditMonthlyPayroll(company.id, 6, 2026);
    expect(result.aiPowered).toBe(false);
    expect(Array.isArray(result.anomalies)).toBe(true);
    expect(typeof result.complianceScore).toBe('number');
  });
});
