'use client';

import React, { useState } from 'react';
import {
  askAthenaPolicy,
  auditPayrollCompliance,
  auditTdsProof,
  regularizeAttendanceWinston
} from '@/lib/api';

export default function AIAgentsPage() {
  // Athena state
  const [athenaQuestion, setAthenaQuestion] = useState('');
  const [athenaChat, setAthenaChat] = useState<{ sender: 'user' | 'athena'; text: string; citations?: string[] }[]>([
    { sender: 'athena', text: "Hello! I am Athena, your Policy Copilot. You can ask me about maternity benefits, gratuity calculations, provident fund caps, or local leave policies." }
  ]);
  const [athenaLoading, setAthenaLoading] = useState(false);

  // Jarvis state
  const [jarvisMonth, setJarvisMonth] = useState(6);
  const [jarvisYear, setJarvisYear] = useState(2026);
  const [jarvisReport, setJarvisReport] = useState<any>(null);
  const [jarvisLoading, setJarvisLoading] = useState(false);

  // Sherlock state
  const [sherlockCategory, setSherlockCategory] = useState('HRA');
  const [sherlockAmount, setSherlockAmount] = useState('120000');
  const [landlordPan, setLandlordPan] = useState('ABCDE1234F');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sherlockReport, setSherlockReport] = useState<any>(null);
  const [sherlockLoading, setSherlockLoading] = useState(false);

  // Winston state
  const [winstonDate, setWinstonDate] = useState('2026-06-12');
  const [winstonReport, setWinstonReport] = useState<any>(null);
  const [winstonLoading, setWinstonLoading] = useState(false);

  // Active Tab
  const [activeAgent, setActiveAgent] = useState<'athena' | 'jarvis' | 'sherlock' | 'winston'>('athena');

  // Handle Athena Question
  const handleAthenaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!athenaQuestion.trim()) return;

    const userMsg = athenaQuestion;
    setAthenaChat(prev => [...prev, { sender: 'user', text: userMsg }]);
    setAthenaQuestion('');
    setAthenaLoading(true);

    try {
      const res = await askAthenaPolicy(userMsg);
      setAthenaChat(prev => [...prev, { sender: 'athena', text: res.answer, citations: res.citations }]);
    } catch (err) {
      setAthenaChat(prev => [...prev, { sender: 'athena', text: "Sorry, I had trouble parsing the policy database." }]);
    } finally {
      setAthenaLoading(false);
    }
  };

  // Handle Jarvis Run
  const handleJarvisRun = async () => {
    setJarvisLoading(true);
    setJarvisReport(null);
    try {
      const res = await auditPayrollCompliance(jarvisMonth, jarvisYear);
      setJarvisReport(res);
    } catch (err) {
      console.error(err);
    } finally {
      setJarvisLoading(false);
    }
  };

  // Handle Winston Run
  const handleWinstonRun = async () => {
    setWinstonLoading(true);
    setWinstonReport(null);
    try {
      const res = await regularizeAttendanceWinston({ dateStr: winstonDate });
      setWinstonReport(res);
    } catch (err) {
      console.error(err);
    } finally {
      setWinstonLoading(false);
    }
  };

  // Handle Sherlock Run
  const handleSherlockRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setSherlockLoading(true);
    setSherlockReport(null);

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
    } finally {
      setSherlockLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', minHeight: '100vh', backgroundColor: '#0A0E1A', color: '#FFFFFF' }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ padding: '0.4rem 0.8rem', background: 'rgba(59,130,246,0.1)', color: '#60A5FA', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
            INTELLIGENT LAYER ACTIVE
          </span>
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.75px', margin: 0, background: 'linear-gradient(to right, #FFFFFF, #94A3B8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          AI Command Center
        </h1>
        <p style={{ color: '#94A3B8', marginTop: '0.5rem', fontSize: '1rem' }}>
          Orchestrate and query NexusHR's four master-level autonomous AI compliance agents.
        </p>
      </div>

      {/* Agents Selection Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '3rem' }}>
        {/* Athena */}
        <div 
          onClick={() => setActiveAgent('athena')}
          style={{ 
            padding: '1.5rem', 
            borderRadius: '16px', 
            background: activeAgent === 'athena' ? 'rgba(59,130,246,0.1)' : '#0F172A',
            border: activeAgent === 'athena' ? '2px solid #3B82F6' : '1px solid #1E293B',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ width: '40px', height: '40px', background: 'rgba(139,92,246,0.1)', color: '#A78BFA', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              💬
            </div>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
          </div>
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 'bold' }}>Athena</h3>
          <p style={{ margin: 0, color: '#64748B', fontSize: '0.85rem' }}>Policy & RAG Coordinator</p>
        </div>

        {/* Jarvis */}
        <div 
          onClick={() => setActiveAgent('jarvis')}
          style={{ 
            padding: '1.5rem', 
            borderRadius: '16px', 
            background: activeAgent === 'jarvis' ? 'rgba(59,130,246,0.1)' : '#0F172A',
            border: activeAgent === 'jarvis' ? '2px solid #3B82F6' : '1px solid #1E293B',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ width: '40px', height: '40px', background: 'rgba(16,185,129,0.1)', color: '#34D399', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              📊
            </div>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
          </div>
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 'bold' }}>Jarvis</h3>
          <p style={{ margin: 0, color: '#64748B', fontSize: '0.85rem' }}>Statutory Payroll Auditor</p>
        </div>

        {/* Sherlock */}
        <div 
          onClick={() => setActiveAgent('sherlock')}
          style={{ 
            padding: '1.5rem', 
            borderRadius: '16px', 
            background: activeAgent === 'sherlock' ? 'rgba(59,130,246,0.1)' : '#0F172A',
            border: activeAgent === 'sherlock' ? '2px solid #3B82F6' : '1px solid #1E293B',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ width: '40px', height: '40px', background: 'rgba(245,158,11,0.1)', color: '#FBBF24', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              🔍
            </div>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
          </div>
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 'bold' }}>Sherlock</h3>
          <p style={{ margin: 0, color: '#64748B', fontSize: '0.85rem' }}>TDS Document Assessor</p>
        </div>

        {/* Winston */}
        <div 
          onClick={() => setActiveAgent('winston')}
          style={{ 
            padding: '1.5rem', 
            borderRadius: '16px', 
            background: activeAgent === 'winston' ? 'rgba(59,130,246,0.1)' : '#0F172A',
            border: activeAgent === 'winston' ? '2px solid #3B82F6' : '1px solid #1E293B',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ width: '40px', height: '40px', background: 'rgba(239,68,68,0.1)', color: '#F87171', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ⚡
            </div>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
          </div>
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 'bold' }}>Winston</h3>
          <p style={{ margin: 0, color: '#64748B', fontSize: '0.85rem' }}>Roster & Attendance Arbiter</p>
        </div>
      </div>

      {/* Main Agent Interface Console */}
      <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '20px', padding: '2rem' }}>
        
        {/* Tab 1: Athena */}
        {activeAgent === 'athena' && (
          <div>
            <div style={{ borderBottom: '1px solid #1E293B', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>Athena: Policy Copilot Console</h2>
              <p style={{ margin: '0.5rem 0 0 0', color: '#64748B', fontSize: '0.9rem' }}>
                Ask Athena semantic questions regarding maternity benefits, gratuity clauses, or organizational policies.
              </p>
            </div>

            {/* Chat Box */}
            <div style={{ background: '#070D19', border: '1px solid #1E293B', borderRadius: '12px', height: '360px', overflowY: 'auto', padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {athenaChat.map((msg, index) => (
                <div key={index} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                  <div style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    background: msg.sender === 'user' ? '#3B82F6' : '#1E293B',
                    color: '#FFFFFF',
                    fontSize: '0.9rem',
                    lineHeight: '1.5'
                  }}>
                    {msg.text}
                  </div>
                  {msg.citations && msg.citations.length > 0 && (
                    <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {msg.citations.map((c, i) => (
                        <span key={i} style={{ fontSize: '10px', color: '#60A5FA', background: 'rgba(59,130,246,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                          📜 {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {athenaLoading && (
                <div style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem', background: '#1E293B', borderRadius: '12px', color: '#94A3B8', fontSize: '0.85rem' }}>
                  Athena is searching policy guides...
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleAthenaSubmit} style={{ display: 'flex', gap: '1rem' }}>
              <input 
                type="text"
                value={athenaQuestion}
                onChange={(e) => setAthenaQuestion(e.target.value)}
                placeholder="Ask Athena e.g. How is gratuity calculated or what is our leave policy?"
                style={{ flex: 1, padding: '0.9rem 1.2rem', borderRadius: '10px', background: '#070D19', border: '1px solid #1E293B', color: '#FFFFFF', outline: 'none' }}
              />
              <button 
                type="submit"
                disabled={athenaLoading}
                style={{ padding: '0 2rem', background: '#3B82F6', border: 'none', borderRadius: '10px', color: '#FFFFFF', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Send
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Jarvis */}
        {activeAgent === 'jarvis' && (
          <div>
            <div style={{ borderBottom: '1px solid #1E293B', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>Jarvis: Statutory Payroll Compliance</h2>
              <p style={{ margin: '0.5rem 0 0 0', color: '#64748B', fontSize: '0.9rem' }}>
                Run Jarvis to scan all active salary structures, EPF basic thresholds, and ESI gross eligibility limits.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', color: '#64748B', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>AUDIT MONTH</label>
                <select 
                  value={jarvisMonth} 
                  onChange={(e) => setJarvisMonth(parseInt(e.target.value))}
                  style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: '#070D19', border: '1px solid #1E293B', color: '#FFFFFF' }}
                >
                  <option value={6}>June</option>
                  <option value={7}>July</option>
                  <option value={8}>August</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: '#64748B', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>AUDIT YEAR</label>
                <select 
                  value={jarvisYear} 
                  onChange={(e) => setJarvisYear(parseInt(e.target.value))}
                  style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: '#070D19', border: '1px solid #1E293B', color: '#FFFFFF' }}
                >
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>

              <button 
                onClick={handleJarvisRun}
                disabled={jarvisLoading}
                style={{ padding: '0.75rem 2rem', background: '#10B981', border: 'none', borderRadius: '8px', color: '#FFFFFF', fontWeight: 'bold', marginTop: '1.25rem', cursor: 'pointer' }}
              >
                {jarvisLoading ? 'Running Auditor...' : 'Run Compliance Audit'}
              </button>
            </div>

            {jarvisReport && (
              <div style={{ background: '#070D19', border: '1px solid #1E293B', borderRadius: '12px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: 'bold' }}>Compliance Score: {jarvisReport.complianceScore}%</h3>
                    <p style={{ margin: '0.2rem 0 0 0', color: '#64748B', fontSize: '0.8rem' }}>Scanned {jarvisReport.totalAuditedEmployees} employee structures</p>
                  </div>
                  <span style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: jarvisReport.complianceScore > 90 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: jarvisReport.complianceScore > 90 ? '#10B981' : '#EF4444' }}>
                    {jarvisReport.complianceScore > 90 ? 'COMPLIANT' : 'ATTENTION REQUIRED'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {jarvisReport.anomalies.length === 0 ? (
                    <p style={{ color: '#10B981', fontSize: '0.9rem', margin: 0 }}>✓ Zero compliance anomalies detected. Ready for payroll run.</p>
                  ) : (
                    jarvisReport.anomalies.map((anom: any, idx: number) => (
                      <div key={idx} style={{ padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.03)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 'bold', color: '#FFFFFF', fontSize: '0.9rem' }}>{anom.employeeName}</span>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: anom.severity === 'HIGH' ? '#EF4444' : '#F59E0B', background: anom.severity === 'HIGH' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>
                            {anom.severity} RISK
                          </span>
                        </div>
                        <p style={{ margin: '0 0 0.25rem 0', color: '#E2E8F0', fontSize: '0.85rem', fontWeight: 'bold' }}>{anom.rule}</p>
                        <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.8rem' }}>{anom.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Sherlock */}
        {activeAgent === 'sherlock' && (
          <div>
            <div style={{ borderBottom: '1px solid #1E293B', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>Sherlock: TDS Verification & Fraud Control</h2>
              <p style={{ margin: '0.5rem 0 0 0', color: '#64748B', fontSize: '0.9rem' }}>
                Simulate uploading landlord rent receipts or LIC declarations to audit landlord PAN accuracy and verification status.
              </p>
            </div>

            <form onSubmit={handleSherlockRun} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <label style={{ display: 'block', color: '#64748B', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>CLAIM CATEGORY</label>
                <select 
                  value={sherlockCategory} 
                  onChange={(e) => setSherlockCategory(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: '#070D19', border: '1px solid #1E293B', color: '#FFFFFF' }}
                >
                  <option value="HRA">House Rent Allowance (HRA)</option>
                  <option value="LIC">LIC Premium Proof</option>
                  <option value="MEDICAL">Medical Insurance 80D</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: '#64748B', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>CLAIMED AMOUNT (INR)</label>
                <input 
                  type="number"
                  value={sherlockAmount}
                  onChange={(e) => setSherlockAmount(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: '#070D19', border: '1px solid #1E293B', color: '#FFFFFF', outline: 'none' }}
                />
              </div>

              {sherlockCategory === 'HRA' && (
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', color: '#64748B', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>LANDLORD PAN (Provide 10-char format, e.g., ABCDE1234F)</label>
                  <input 
                    type="text"
                    value={landlordPan}
                    onChange={(e) => setLandlordPan(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: '#070D19', border: '1px solid #1E293B', color: '#FFFFFF', outline: 'none' }}
                  />
                </div>
              )}

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', color: '#64748B', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>UPLOAD SIMULATED FILE (Upload files named 'sample_fake.pdf' to trigger Sherlock's fraud audit alerts)</label>
                <input 
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  style={{ color: '#94A3B8' }}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <button 
                  type="submit"
                  disabled={sherlockLoading}
                  style={{ padding: '0.75rem 2.5rem', background: '#F59E0B', border: 'none', borderRadius: '8px', color: '#0F172A', fontWeight: 'extrabold', cursor: 'pointer' }}
                >
                  {sherlockLoading ? 'Sherlock is auditing document...' : 'Audit Document Validation'}
                </button>
              </div>
            </form>

            {sherlockReport && (
              <div style={{ background: '#070D19', border: '1px solid #1E293B', borderRadius: '12px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: 'bold' }}>Sherlock Verdict</h3>
                    <p style={{ margin: '0.2rem 0 0 0', color: '#64748B', fontSize: '0.8rem' }}>Scanned: {sherlockReport.extractedDetails.documentDetected}</p>
                  </div>
                  <span style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: sherlockReport.auditResult.status === 'APPROVED' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: sherlockReport.auditResult.status === 'APPROVED' ? '#10B981' : '#EF4444' }}>
                    {sherlockReport.auditResult.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ padding: '0.75rem', background: '#0F172A', borderRadius: '6px' }}>
                    <span style={{ color: '#64748B', fontSize: '11px', fontWeight: 'bold', display: 'block' }}>FRAUD INDEX SCORE</span>
                    <span style={{ color: sherlockReport.auditResult.fraudScore > 50 ? '#EF4444' : '#10B981', fontSize: '18px', fontWeight: 'bold' }}>
                      {sherlockReport.auditResult.fraudScore} / 100
                    </span>
                  </div>
                  <div style={{ padding: '0.75rem', background: '#0F172A', borderRadius: '6px' }}>
                    <span style={{ color: '#64748B', fontSize: '11px', fontWeight: 'bold', display: 'block' }}>COMPUTED TAX EXEMPTION</span>
                    <span style={{ color: '#3B82F6', fontSize: '18px', fontWeight: 'bold' }}>
                      ₹{sherlockReport.extractedDetails.computedExemption}
                    </span>
                  </div>
                </div>

                <p style={{ margin: '0 0 1rem 0', color: '#E2E8F0', fontSize: '0.85rem', lineHeight: '1.5' }}>
                  <strong>Explanation:</strong> {sherlockReport.auditResult.explanation}
                </p>

                {sherlockReport.auditResult.warnings.length > 0 && (
                  <div>
                    <span style={{ color: '#EF4444', fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>DETECTED WARNINGS</span>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#EF4444', fontSize: '0.8rem' }}>
                      {sherlockReport.auditResult.warnings.map((w: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Winston */}
        {activeAgent === 'winston' && (
          <div>
            <div style={{ borderBottom: '1px solid #1E293B', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>Winston: Roster & Work Footprint Arbitration</h2>
              <p style={{ margin: '0.5rem 0 0 0', color: '#64748B', fontSize: '0.9rem' }}>
                Winston auto-resolves regularization claims by matching network activity footprints (Slack, Git, VPN logs).
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#64748B', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>REGULARIZATION TARGET DATE</label>
                <input 
                  type="text"
                  value={winstonDate}
                  onChange={(e) => setWinstonDate(e.target.value)}
                  placeholder="e.g. 2026-06-12"
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: '#070D19', border: '1px solid #1E293B', color: '#FFFFFF', outline: 'none' }}
                />
              </div>

              <button 
                onClick={handleWinstonRun}
                disabled={winstonLoading}
                style={{ padding: '0.75rem 2rem', background: '#EF4444', border: 'none', borderRadius: '8px', color: '#FFFFFF', fontWeight: 'bold', marginTop: '1.25rem', cursor: 'pointer' }}
              >
                {winstonLoading ? 'Winston is auditing network logs...' : 'Validate Regularization'}
              </button>
            </div>

            {winstonReport && (
              <div style={{ background: '#070D19', border: '1px solid #1E293B', borderRadius: '12px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: 'bold' }}>Winston Verdict</h3>
                    <p style={{ margin: '0.2rem 0 0 0', color: '#64748B', fontSize: '0.8rem' }}>Verification Confidence: {winstonReport.confidence}%</p>
                  </div>
                  <span style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: winstonReport.resolution === 'AUTO_APPROVED' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: winstonReport.resolution === 'AUTO_APPROVED' ? '#10B981' : '#F59E0B' }}>
                    {winstonReport.resolution.replaceAll('_', ' ')}
                  </span>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <span style={{ color: '#64748B', fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>EXAMINED NETWORK SIGNALS</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', background: '#0F172A', borderRadius: '6px' }}>
                      <span style={{ display: 'block', fontSize: '10px', color: '#64748B', fontWeight: 'bold' }}>SLACK ACTIVITY</span>
                      <span style={{ fontSize: '12.5px', color: '#FFFFFF', fontWeight: 'w600' }}>{winstonReport.auditLog.slackActivity}</span>
                    </div>
                    <div style={{ padding: '0.75rem', background: '#0F172A', borderRadius: '6px' }}>
                      <span style={{ display: 'block', fontSize: '10px', color: '#64748B', fontWeight: 'bold' }}>GIT REPOSITORIES</span>
                      <span style={{ fontSize: '12.5px', color: '#FFFFFF', fontWeight: 'w600' }}>{winstonReport.auditLog.gitCommits}</span>
                    </div>
                    <div style={{ padding: '0.75rem', background: '#0F172A', borderRadius: '6px' }}>
                      <span style={{ display: 'block', fontSize: '10px', color: '#64748B', fontWeight: 'bold' }}>VPN TUNNELS</span>
                      <span style={{ fontSize: '12.5px', color: '#FFFFFF', fontWeight: 'w600' }}>{winstonReport.auditLog.vpnConnection}</span>
                    </div>
                  </div>
                </div>

                <p style={{ margin: 0, color: '#E2E8F0', fontSize: '0.85rem', lineHeight: '1.5' }}>
                  <strong>Explanation:</strong> {winstonReport.explanation}
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
