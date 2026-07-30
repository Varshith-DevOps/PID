'use client';

import React, { useState } from 'react';
import {
  askAthenaPolicy,
  askPriyaHR,
  submitAgentFeedback,
  askAtlasProject,
  askNovaRecruitment,
  auditPayrollCompliance,
  auditTdsProof,
  regularizeAttendanceWinston
} from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import {
  PageHeader, Card, Badge, Button, Banner, StatusChip,
  Field, Select, TextField, NumberField, FileDrop, EmptyState,
} from '@/components/ui';

type AgentKey = 'athena' | 'jarvis' | 'sherlock' | 'winston' | 'atlas' | 'nova';
type SimpleChatMessage = { sender: 'user' | 'agent'; text: string };

const AGENTS: { key: AgentKey; name: string; role: string; icon: string; accent: string }[] = [
  { key: 'athena', name: 'Priya', role: 'Conversational HR Advisor', icon: '💬', accent: 'var(--accent)' },
  { key: 'jarvis', name: 'Jarvis', role: 'Statutory Payroll Auditor', icon: '📊', accent: 'var(--success-fg)' },
  { key: 'sherlock', name: 'Sherlock', role: 'TDS Document Assessor', icon: '🔍', accent: 'var(--warning-fg)' },
  { key: 'winston', name: 'Winston', role: 'Roster & Attendance Arbiter', icon: '⚡', accent: 'var(--danger-fg)' },
  { key: 'atlas', name: 'Atlas', role: 'Project Management Assistant', icon: '📋', accent: 'var(--accent)' },
  { key: 'nova', name: 'Nova', role: 'Recruitment Intelligence Assistant', icon: '👥', accent: 'var(--accent)' },
];

function SimpleAgentConsole({
  title,
  description,
  messages,
  question,
  setQuestion,
  loading,
  placeholder,
  onSubmit,
}: {
  title: string;
  description: string;
  messages: SimpleChatMessage[];
  question: string;
  setQuestion: (value: string) => void;
  loading: boolean;
  placeholder: string;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <div>
      <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
        <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{description}</p>
      </div>

      <div
        style={{
          background: 'var(--surface-sunken)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          height: '360px',
          overflowY: 'auto',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          whiteSpace: 'pre-wrap',
        }}
      >
        {messages.map((msg, index) => (
          <div key={index} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: msg.sender === 'user' ? 'var(--accent)' : 'var(--surface-raised)',
                color: msg.sender === 'user' ? 'var(--text-on-accent)' : 'var(--text-primary)',
                border: msg.sender === 'user' ? 'none' : '1px solid var(--border-subtle)',
                fontSize: '0.9rem',
                lineHeight: 1.5,
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div
            style={{
              alignSelf: 'flex-start',
              padding: '0.5rem 1rem',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
            }}
          >
            Reading application data...
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <TextField label="" value={question} onChange={setQuestion} placeholder={placeholder} />
        </div>
        <Button type="submit" loading={loading} disabled={loading}>Send</Button>
      </form>
    </div>
  );
}

export default function AIAgentsPage() {
  // Athena state
  const [athenaQuestion, setAthenaQuestion] = useState('');
  const [athenaChat, setAthenaChat] = useState<{ sender: 'user' | 'athena'; text: string; citations?: string[] }[]>([
    { sender: 'athena', text: "Hello! I am Priya, your Conversational HR Advisor. I am here to help you and your team with instant, policy-compliant answers. Ask me anything about leaves, notice periods, travel reimbursements, upcoming holidays, team attendance alerts, or appraisals!" }
  ]);
  const [athenaLoading, setAthenaLoading] = useState(false);

  // Priya / Agent feedback states
  const [feedbackRates, setFeedbackRates] = useState<Record<number, number>>({});
  const [feedbackText, setFeedbackText] = useState<Record<number, string>>({});
  const [showCorrectionInput, setShowCorrectionInput] = useState<Record<number, boolean>>({});
  const [feedbackSaved, setFeedbackSaved] = useState<Record<number, boolean>>({});

  const handleFeedbackSubmit = async (msgIndex: number, rating: number, correctedAnswer?: string) => {
    // Find the corresponding user question (usually the preceding message)
    const userMsg = msgIndex > 0 ? athenaChat[msgIndex - 1]?.text : 'General Q&A';
    const agentMsg = athenaChat[msgIndex]?.text || '';
    
    try {
      await submitAgentFeedback({
        agentName: 'Priya',
        question: userMsg,
        response: agentMsg,
        rating,
        correctedText: correctedAnswer || undefined
      });
      setFeedbackRates(prev => ({ ...prev, [msgIndex]: rating }));
      setFeedbackSaved(prev => ({ ...prev, [msgIndex]: true }));
      setShowCorrectionInput(prev => ({ ...prev, [msgIndex]: false }));
    } catch (err) {
      console.error('Error submitting feedback:', err);
    }
  };

  // Jarvis state
  const [jarvisMonth, setJarvisMonth] = useState(6);
  const [jarvisYear, setJarvisYear] = useState(2026);
  const [jarvisReport, setJarvisReport] = useState<any>(null);
  const [jarvisLoading, setJarvisLoading] = useState(false);
  const [jarvisError, setJarvisError] = useState(false);

  // Sherlock state
  const [sherlockCategory, setSherlockCategory] = useState('HRA');
  const [sherlockAmount, setSherlockAmount] = useState('120000');
  const [landlordPan, setLandlordPan] = useState('ABCDE1234F');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sherlockReport, setSherlockReport] = useState<any>(null);
  const [sherlockLoading, setSherlockLoading] = useState(false);
  const [sherlockError, setSherlockError] = useState(false);

  // Winston state
  const [winstonDate, setWinstonDate] = useState('2026-06-12');
  const [winstonReport, setWinstonReport] = useState<any>(null);
  const [winstonLoading, setWinstonLoading] = useState(false);
  const [winstonError, setWinstonError] = useState(false);

  // Atlas state
  const [atlasQuestion, setAtlasQuestion] = useState('');
  const [atlasChat, setAtlasChat] = useState<SimpleChatMessage[]>([
    { sender: 'agent', text: 'Hello! I am Atlas, your Project Management Assistant. Ask me about project progress, workload, deadlines, delayed tasks, milestones, or resource allocation.' }
  ]);
  const [atlasLoading, setAtlasLoading] = useState(false);

  // Nova state
  const [novaQuestion, setNovaQuestion] = useState('');
  const [novaChat, setNovaChat] = useState<SimpleChatMessage[]>([
    { sender: 'agent', text: 'Hello! I am Nova, your Recruitment Intelligence Assistant. Ask me about candidates, job openings, stages, interviews, offers, ratings, notice periods, or onboarding.' }
  ]);
  const [novaLoading, setNovaLoading] = useState(false);

  // Active Tab
  const [activeAgent, setActiveAgent] = useState<AgentKey>('athena');

  // Handle Athena Question
  const handleAthenaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!athenaQuestion.trim()) return;

    const userMsg = athenaQuestion;
    setAthenaChat(prev => [...prev, { sender: 'user', text: userMsg }]);
    setAthenaQuestion('');
    setAthenaLoading(true);

    try {
      const res = await askPriyaHR(userMsg);
      setAthenaChat(prev => [...prev, { sender: 'athena', text: res.answer, citations: res.citations }]);
    } catch (err) {
      setAthenaChat(prev => [...prev, { sender: 'athena', text: "Sorry, Priya had trouble accessing the HR database." }]);
    } finally {
      setAthenaLoading(false);
    }
  };

  // Handle Jarvis Run
  const handleJarvisRun = async () => {
    setJarvisLoading(true);
    setJarvisReport(null);
    setJarvisError(false);
    try {
      const res = await auditPayrollCompliance(jarvisMonth, jarvisYear);
      setJarvisReport(res);
    } catch (err) {
      console.error(err);
      setJarvisError(true);
    } finally {
      setJarvisLoading(false);
    }
  };

  // Handle Winston Run
  const handleWinstonRun = async () => {
    setWinstonLoading(true);
    setWinstonReport(null);
    setWinstonError(false);
    try {
      const res = await regularizeAttendanceWinston({ dateStr: winstonDate });
      setWinstonReport(res);
    } catch (err) {
      console.error(err);
      setWinstonError(true);
    } finally {
      setWinstonLoading(false);
    }
  };

  const handleAtlasSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!atlasQuestion.trim()) return;

    const userMsg = atlasQuestion;
    setAtlasChat(prev => [...prev, { sender: 'user', text: userMsg }]);
    setAtlasQuestion('');
    setAtlasLoading(true);

    try {
      const res = await askAtlasProject(userMsg);
      setAtlasChat(prev => [...prev, { sender: 'agent', text: res.answer || 'Atlas did not find a matching project answer.' }]);
    } catch (err) {
      console.error(err);
      setAtlasChat(prev => [...prev, { sender: 'agent', text: 'Atlas could not read project data for this request.' }]);
    } finally {
      setAtlasLoading(false);
    }
  };

  const handleNovaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaQuestion.trim()) return;

    const userMsg = novaQuestion;
    setNovaChat(prev => [...prev, { sender: 'user', text: userMsg }]);
    setNovaQuestion('');
    setNovaLoading(true);

    try {
      const res = await askNovaRecruitment(userMsg);
      setNovaChat(prev => [...prev, { sender: 'agent', text: res.answer || 'Nova did not find a matching recruitment answer.' }]);
    } catch (err) {
      console.error(err);
      setNovaChat(prev => [...prev, { sender: 'agent', text: 'Nova could not read recruitment data for this request.' }]);
    } finally {
      setNovaLoading(false);
    }
  };

  // Handle Sherlock Run
  const handleSherlockRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setSherlockLoading(true);
    setSherlockReport(null);
    setSherlockError(false);

    try {
      const fd = new FormData();
      fd.append('category', sherlockCategory);
      fd.append('amount', sherlockAmount);
      fd.append('rentDetails', JSON.stringify({ landlordPan, monthlyRent: parseFloat(sherlockAmount) / 12 }));
      if (selectedFile) {
        fd.append('document', selectedFile);
      }

      const res = await auditTdsProof(fd);
      setSherlockReport(res);
    } catch (err) {
      console.error(err);
      setSherlockError(true);
    } finally {
      setSherlockLoading(false);
    }
  };

  const sectionHeaderStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--border-subtle)',
    paddingBottom: '1.25rem',
    marginBottom: '1.5rem',
  };

  return (
    <div className="app-layout">
      <Sidebar activePath="/dashboard/ai-agents" />
      <main className="main-content">
        <PageHeader
          title="AI Command Center"
          subtitle="Orchestrate and query PID HRMS's rule-based AI assistants across HR, compliance, projects, and recruitment."
          actions={<Badge tone="info" dot>Intelligent Layer Active</Badge>}
        />

      {/* Agents Selection Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2.5rem',
        }}
      >
        {AGENTS.map((agent) => {
          const active = activeAgent === agent.key;
          return (
            <button
              key={agent.key}
              type="button"
              onClick={() => setActiveAgent(agent.key)}
              className="card"
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: active ? 'var(--accent-soft)' : 'var(--surface-raised)',
                border: active ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
                transition: 'var(--transition)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div
                  style={{
                    width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--surface-sunken)', fontSize: '1.1rem',
                  }}
                >
                  {agent.icon}
                </div>
                <span
                  title="Online"
                  style={{
                    display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                    background: 'var(--success-fg)', boxShadow: '0 0 8px var(--success-fg)',
                  }}
                />
              </div>
              <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{agent.name}</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{agent.role}</p>
            </button>
          );
        })}
      </div>

      {/* Main Agent Interface Console */}
        <Card>
        {/* Tab 1: Priya */}
        {activeAgent === 'athena' && (
          <div>
            <div style={sectionHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>Priya: Conversational HR Console</h2>
              <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Ask Priya questions regarding leaves, notice periods, travel reimbursements, upcoming holidays, team attendance alerts, or appraisal schedules.
              </p>
            </div>

            {/* Chat Box */}
            <div
              style={{
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                height: '360px',
                overflowY: 'auto',
                padding: '1.5rem',
                marginBottom: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              {athenaChat.map((msg, index) => (
                <div key={index} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                  <div
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      background: msg.sender === 'user' ? 'var(--accent)' : 'var(--surface-raised)',
                      color: msg.sender === 'user' ? 'var(--text-on-accent)' : 'var(--text-primary)',
                      border: msg.sender === 'user' ? 'none' : '1px solid var(--border-subtle)',
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                    }}
                  >
                    {msg.text}
                  </div>
                  {msg.citations && msg.citations.length > 0 && (
                    <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {msg.citations.map((c, i) => (
                        <Badge key={i} tone="info">📜 {c}</Badge>
                      ))}
                    </div>
                  )}

                  {/* Feedback Mechanism for Priya Agent Responses */}
                  {msg.sender === 'athena' && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {feedbackSaved[index] ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--success-fg)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          ✓ Feedback recorded. Thank you for helping Priya learn!
                        </span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Was this helpful?</span>
                          <button
                            onClick={() => handleFeedbackSubmit(index, 1)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '2px 4px', borderRadius: '4px' }}
                            title="Helpful"
                          >
                            👍
                          </button>
                          <button
                            onClick={() => setShowCorrectionInput(prev => ({ ...prev, [index]: true }))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '2px 4px', borderRadius: '4px' }}
                            title="Incorrect / Needs Correction"
                          >
                            👎
                          </button>
                        </div>
                      )}

                      {showCorrectionInput[index] && (
                        <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Suggest a correction for Priya:</span>
                          <input
                            type="text"
                            value={feedbackText[index] || ''}
                            onChange={(e) => setFeedbackText(prev => ({ ...prev, [index]: e.target.value }))}
                            placeholder="Type the correct policy answer here..."
                            style={{
                              padding: '0.4rem 0.6rem',
                              fontSize: '0.85rem',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-subtle)',
                              background: 'var(--surface-sunken)',
                              color: 'var(--text-primary)',
                              width: '100%'
                            }}
                          />
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => setShowCorrectionInput(prev => ({ ...prev, [index]: false }))}
                              style={{ padding: '0.35rem 0.65rem', border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleFeedbackSubmit(index, -1, feedbackText[index])}
                              style={{ padding: '0.35rem 0.65rem', border: 'none', background: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              Submit Correction
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {athenaLoading && (
                <div
                  style={{
                    alignSelf: 'flex-start',
                    padding: '0.5rem 1rem',
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                  }}
                >
                  Priya is compiling policy guidelines and live metrics…
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleAthenaSubmit} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <TextField
                  label=""
                  value={athenaQuestion}
                  onChange={setAthenaQuestion}
                  placeholder="Ask Priya e.g. How many leaves do I have? or Show employees with low attendance"
                />
              </div>
              <Button type="submit" loading={athenaLoading} disabled={athenaLoading}>Send</Button>
            </form>
          </div>
        )}

        {/* Tab 2: Jarvis */}
        {activeAgent === 'jarvis' && (
          <div>
            <div style={sectionHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>Jarvis: Statutory Payroll Compliance</h2>
              <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Run Jarvis to scan all active salary structures, EPF basic thresholds, and ESI gross eligibility limits.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 160 }}>
                <Select
                  label="Audit Month"
                  value={String(jarvisMonth)}
                  onChange={(v) => setJarvisMonth(parseInt(v))}
                  options={[
                    { value: '6', label: 'June' },
                    { value: '7', label: 'July' },
                    { value: '8', label: 'August' },
                  ]}
                />
              </div>
              <div style={{ minWidth: 160 }}>
                <Select
                  label="Audit Year"
                  value={String(jarvisYear)}
                  onChange={(v) => setJarvisYear(parseInt(v))}
                  options={[
                    { value: '2026', label: '2026' },
                    { value: '2027', label: '2027' },
                  ]}
                />
              </div>
              <Button variant="success" onClick={handleJarvisRun} loading={jarvisLoading} disabled={jarvisLoading}>
                {jarvisLoading ? 'Running Auditor…' : 'Run Compliance Audit'}
              </Button>
            </div>

            {jarvisError && (
              <Banner tone="danger" title="Audit failed">
                Jarvis could not complete the compliance audit. Please try again.
              </Banner>
            )}

            {jarvisReport && (
              <div
                style={{
                  background: 'var(--surface-sunken)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.5rem', gap: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Compliance Score: {jarvisReport.complianceScore}%</h3>
                    <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Scanned {jarvisReport.totalAuditedEmployees} employee structures</p>
                  </div>
                  <StatusChip status={jarvisReport.complianceScore > 90 ? 'COMPLIANT' : 'ATTENTION REQUIRED'} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {jarvisReport.anomalies.length === 0 ? (
                    <Banner tone="success">✓ Zero compliance anomalies detected. Ready for payroll run.</Banner>
                  ) : (
                    jarvisReport.anomalies.map((anom: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          padding: '1rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--danger-border)',
                          background: 'var(--danger-bg)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.75rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{anom.employeeName}</span>
                          <Badge tone={anom.severity === 'HIGH' ? 'danger' : 'warning'}>{anom.severity} RISK</Badge>
                        </div>
                        <p style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700 }}>{anom.rule}</p>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{anom.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {!jarvisReport && !jarvisLoading && !jarvisError && (
              <EmptyState title="No audit yet" message="Select a month and year, then run the compliance audit to see Jarvis's findings." />
            )}
          </div>
        )}

        {/* Tab 3: Sherlock */}
        {activeAgent === 'sherlock' && (
          <div>
            <div style={sectionHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>Sherlock: TDS Verification & Fraud Control</h2>
              <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Simulate uploading landlord rent receipts or LIC declarations to audit landlord PAN accuracy and verification status.
              </p>
            </div>

            <form onSubmit={handleSherlockRun} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <Select
                label="Claim Category"
                value={sherlockCategory}
                onChange={setSherlockCategory}
                options={[
                  { value: 'HRA', label: 'House Rent Allowance (HRA)' },
                  { value: 'LIC', label: 'LIC Premium Proof' },
                  { value: 'MEDICAL', label: 'Medical Insurance 80D' },
                ]}
              />

              <NumberField
                label="Claimed Amount (INR)"
                value={sherlockAmount}
                onChange={setSherlockAmount}
              />

              {sherlockCategory === 'HRA' && (
                <div style={{ gridColumn: 'span 2' }}>
                  <TextField
                    label="Landlord PAN"
                    help="Provide 10-char format, e.g., ABCDE1234F"
                    value={landlordPan}
                    onChange={setLandlordPan}
                  />
                </div>
              )}

              <div style={{ gridColumn: 'span 2' }}>
                <FileDrop
                  label="Upload Simulated File"
                  hint="Upload files named 'sample_fake.pdf' to trigger Sherlock's fraud audit alerts"
                  onFile={(f) => setSelectedFile(f)}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <Button type="submit" variant="warning" loading={sherlockLoading} disabled={sherlockLoading}>
                  {sherlockLoading ? 'Sherlock is auditing document…' : 'Audit Document Validation'}
                </Button>
              </div>
            </form>

            {sherlockError && (
              <Banner tone="danger" title="Audit failed">
                Sherlock could not complete the document audit. Please try again.
              </Banner>
            )}

            {sherlockReport && (
              <div
                style={{
                  background: 'var(--surface-sunken)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.25rem', gap: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Sherlock Verdict</h3>
                    <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Scanned: {sherlockReport.extractedDetails.documentDetected}</p>
                  </div>
                  <StatusChip status={sherlockReport.auditResult.status} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ padding: '0.75rem', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fraud Index Score</span>
                    <span style={{ color: sherlockReport.auditResult.fraudScore > 50 ? 'var(--danger-fg)' : 'var(--success-fg)', fontSize: '18px', fontWeight: 700 }}>
                      {sherlockReport.auditResult.fraudScore} / 100
                    </span>
                  </div>
                  <div style={{ padding: '0.75rem', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Computed Tax Exemption</span>
                    <span style={{ color: 'var(--accent)', fontSize: '18px', fontWeight: 700 }}>
                      ₹{sherlockReport.extractedDetails.computedExemption}
                    </span>
                  </div>
                </div>

                <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Explanation:</strong> {sherlockReport.auditResult.explanation}
                </p>

                {sherlockReport.auditResult.warnings.length > 0 && (
                  <Banner tone="danger" title="Detected Warnings">
                    <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.2rem' }}>
                      {sherlockReport.auditResult.warnings.map((w: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{w}</li>
                      ))}
                    </ul>
                  </Banner>
                )}
              </div>
            )}

            {!sherlockReport && !sherlockLoading && !sherlockError && (
              <EmptyState title="No audit yet" message="Complete the claim details and run the document validation to see Sherlock's verdict." />
            )}
          </div>
        )}

        {/* Tab 4: Winston */}
        {activeAgent === 'winston' && (
          <div>
            <div style={sectionHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>Winston: Roster & Work Footprint Arbitration</h2>
              <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Winston auto-resolves regularization claims by matching network activity footprints (Slack, Git, VPN logs).
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <TextField
                  label="Regularization Target Date"
                  value={winstonDate}
                  onChange={setWinstonDate}
                  placeholder="e.g. 2026-06-12"
                />
              </div>
              <Button variant="danger" onClick={handleWinstonRun} loading={winstonLoading} disabled={winstonLoading}>
                {winstonLoading ? 'Winston is auditing network logs…' : 'Validate Regularization'}
              </Button>
            </div>

            {winstonError && (
              <Banner tone="danger" title="Validation failed">
                Winston could not complete the regularization validation. Please try again.
              </Banner>
            )}

            {winstonReport && (
              <div
                style={{
                  background: 'var(--surface-sunken)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.25rem', gap: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Winston Verdict</h3>
                    <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Verification Confidence: {winstonReport.confidence}%</p>
                  </div>
                  <StatusChip status={winstonReport.resolution} />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Examined Network Signals</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    {[
                      { label: 'Slack Activity', value: winstonReport.auditLog.slackActivity },
                      { label: 'Git Repositories', value: winstonReport.auditLog.gitCommits },
                      { label: 'VPN Tunnels', value: winstonReport.auditLog.vpnConnection },
                    ].map((signal) => (
                      <div key={signal.label} style={{ padding: '0.75rem', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{signal.label}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>{signal.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Explanation:</strong> {winstonReport.explanation}
                </p>
              </div>
            )}

            {!winstonReport && !winstonLoading && !winstonError && (
              <EmptyState title="No validation yet" message="Enter a target date and run the validation to see Winston's verdict." />
            )}
          </div>
        )}

        {activeAgent === 'atlas' && (
          <SimpleAgentConsole
            title="Atlas: Project Management Assistant"
            description="Ask Atlas read-only questions about projects, tasks, employees, milestones, resource allocation, risk, progress, and deadlines."
            messages={atlasChat}
            question={atlasQuestion}
            setQuestion={setAtlasQuestion}
            loading={atlasLoading}
            placeholder="Ask Atlas about projects, tasks, employees, milestones or deadlines."
            onSubmit={handleAtlasSubmit}
          />
        )}

        {activeAgent === 'nova' && (
          <SimpleAgentConsole
            title="Nova: Recruitment Intelligence Assistant"
            description="Ask Nova read-only questions about recruitment, candidates, interviews, offers, ratings, notice periods, and onboarding."
            messages={novaChat}
            question={novaQuestion}
            setQuestion={setNovaQuestion}
            loading={novaLoading}
            placeholder="Ask Nova about recruitment, candidates, interviews, offers or onboarding."
            onSubmit={handleNovaSubmit}
          />
        )}
        </Card>
      </main>
    </div>
  );
}
