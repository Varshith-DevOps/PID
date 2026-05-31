'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getExecutiveSummary } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    try {
      const data = await getExecutiveSummary();
      setStats(data);
    } catch (err) {
      console.error('Failed to load executive summary:', err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" style={{ padding: '2rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          
          {/* EXECUTIVE HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800, background: 'linear-gradient(135deg, #ffffff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.25rem' }}>
                Executive Briefing Overview
              </h1>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Real-time operational health, headcount tracker, detailed attendance analysis, and active leave pipelines.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '0.45rem 0.85rem', borderRadius: '8px', color: 'var(--text-secondary)' }}>
                🕒 Last Update: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <button 
                onClick={() => { setLoading(true); loadStats(); }} 
                style={{ background: 'linear-gradient(135deg, #a855f7, #c084fc)', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(168,85,247,0.2)' }}
              >
                🔄 Refresh Analytics
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '350px' }}>
              <div className="loading-spinner" />
            </div>
          ) : (
            stats && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                
                {/* PRIMARY HIGH-LEVEL KPIS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                  
                  {/* HEADCOUNT */}
                  <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Headcount</span>
                      <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0.2rem 0', color: 'white' }}>{stats.workforce.total}</h2>
                      <span style={{ fontSize: '0.68rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        🟢 {stats.workforce.active} Active · {stats.workforce.managers} Mgrs
                      </span>
                    </div>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                      <svg style={{ width: '22px', height: '22px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
                  </div>

                  {/* ATTENDANCE RATE */}
                  <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Attendance Rate (Today)</span>
                      <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0.2rem 0', color: stats.attendance.attendanceRate > 80 ? '#10b981' : '#f59e0b' }}>{stats.attendance.attendanceRate}%</h2>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {stats.attendance.presentCount} present · {stats.attendance.lateCount} late · {stats.attendance.absentCount} absent
                      </span>
                    </div>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                      <svg style={{ width: '22px', height: '22px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                  </div>

                  {/* PENDING LIABILITY (EXPENSES) */}
                  <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Approvals Value</span>
                      <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0.2rem 0', color: '#f87171' }}>
                        ₹{stats.expenses.pendingAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </h2>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {stats.expenses.pendingClaims} claims · {stats.leave.pendingApprovalsCount} leaves waiting
                      </span>
                    </div>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
                      <svg style={{ width: '22px', height: '22px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                  </div>

                  {/* TALENT PIPELINE */}
                  <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Talent Sourcing</span>
                      <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0.2rem 0', color: 'white' }}>{stats.recruitment.openPositions} Jobs</h2>
                      <span style={{ fontSize: '0.68rem', color: '#06b6d4' }}>
                        {stats.recruitment.totalApplicants} Applicants · {stats.recruitment.upcomingInterviews} interviews
                      </span>
                    </div>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(6,182,212,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06b6d4' }}>
                      <svg style={{ width: '22px', height: '22px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                  </div>

                </div>

                {/* DETAILED DOUBLE-COLUMN WORKFLOW HUB */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                  
                  {/* LEFT COLUMN: DETAILED ATTENDANCE HUB */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* ATTENDANCE HUB CARD */}
                    <div className="glass-card" style={{ padding: '1.75rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          📅 Detailed Attendance Analysis (Today)
                        </h3>
                        <Link href="/attendance" style={{ fontSize: '0.72rem', color: '#c084fc', textDecoration: 'none', fontWeight: 600 }}>
                          View Register →
                        </Link>
                      </div>

                      {/* LATE CHECK-INS */}
                      <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                          <span>⏰ Today's Late Check-ins</span>
                          <span style={{ fontSize: '0.75rem', background: 'rgba(245,158,11,0.08)', padding: '2px 8px', borderRadius: '4px' }}>
                            {stats.attendance.lateArrivals.length} Late Arrivals
                          </span>
                        </div>

                        {stats.attendance.lateArrivals.length === 0 ? (
                          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            🎉 Outstanding! No late arrivals recorded today.
                          </div>
                        ) : (
                          <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}>
                                  <th style={{ padding: '0.6rem 0.85rem' }}>Name</th>
                                  <th style={{ padding: '0.6rem 0.85rem' }}>Department</th>
                                  <th style={{ padding: '0.6rem 0.85rem' }}>In Time</th>
                                  <th style={{ padding: '0.6rem 0.85rem', textAlign: 'right' }}>Late Minutes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {stats.attendance.lateArrivals.map((a: any) => (
                                  <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                    <td style={{ padding: '0.55rem 0.85rem', fontWeight: 600, color: 'white' }}>{a.name}</td>
                                    <td style={{ padding: '0.55rem 0.85rem', color: 'var(--text-secondary)' }}>{a.department}</td>
                                    <td style={{ padding: '0.55rem 0.85rem', color: '#f59e0b' }}>{a.checkIn}</td>
                                    <td style={{ padding: '0.55rem 0.85rem', color: '#ef4444', textAlign: 'right', fontWeight: 600 }}>{a.lateMinutes} mins</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* ABSENTEES */}
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ef4444', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                          <span>🚫 Absent / Not Checked-In Today</span>
                          <span style={{ fontSize: '0.75rem', background: 'rgba(239,68,68,0.08)', padding: '2px 8px', borderRadius: '4px' }}>
                            {stats.attendance.absentees.length} Absent
                          </span>
                        </div>

                        {stats.attendance.absentees.length === 0 ? (
                          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ✅ Perfect! All staff members checked in or are accounted for today.
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.65rem' }}>
                            {stats.attendance.absentees.map((e: any) => (
                              <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.08)', padding: '0.65rem 0.85rem', borderRadius: '8px' }}>
                                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'white' }}>{e.name}</span>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{e.department}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>

                    {/* OPERATIONS & TASKS PANEL */}
                    <div className="glass-card" style={{ padding: '1.75rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', marginBottom: '1.25rem' }}>
                        📊 Operations & Project Progress
                      </h3>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
                        
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Active Projects</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white', margin: '0.25rem 0' }}>{stats.projects.active}</div>
                          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Under tracking in workspace</p>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Overdue Tasks</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: stats.projects.overdueTasks > 0 ? '#ef4444' : '#10b981', margin: '0.25rem 0' }}>
                            {stats.projects.overdueTasks} Tasks
                          </div>
                          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Require immediate oversight</p>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Task Completion Rate</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', margin: '0.25rem 0' }}>{stats.projects.taskCompletionRate}%</div>
                          <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginTop: '0.4rem' }}>
                            <div style={{ width: `${stats.projects.taskCompletionRate}%`, height: '100%', background: '#10b981' }} />
                          </div>
                        </div>

                      </div>
                    </div>

                  </div>

                  {/* RIGHT COLUMN: DETAILED LEAVE HUB */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* LEAVE HUB CARD */}
                    <div className="glass-card" style={{ padding: '1.75rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          🌴 Out of Office & Leaves Tracker
                        </h3>
                        <Link href="/leave" style={{ fontSize: '0.72rem', color: '#c084fc', textDecoration: 'none', fontWeight: 600 }}>
                          Manage Leaves →
                        </Link>
                      </div>

                      {/* ON LEAVE TODAY */}
                      <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#3b82f6', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                          <span>🏖️ Out of Office Today</span>
                          <span style={{ fontSize: '0.75rem', background: 'rgba(59,130,246,0.08)', padding: '2px 8px', borderRadius: '4px' }}>
                            {stats.leave.onLeaveToday.length} Active Leaves
                          </span>
                        </div>

                        {stats.leave.onLeaveToday.length === 0 ? (
                          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            💼 Nobody is currently out of office on leave today.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {stats.leave.onLeaveToday.map((l: any) => (
                              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '8px' }}>
                                <div>
                                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'white' }}>{l.name}</span>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '8px' }}>({l.department})</span>
                                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    📅 {l.range}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span className="badge" style={{ background: 'rgba(59,130,246,0.08)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.15)', fontSize: '0.62rem' }}>
                                    {l.leaveType}
                                  </span>
                                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 600 }}>{l.days} Days</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* LEAVE APPLICATIONS AWAITING APPROVAL */}
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fbbf24', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                          <span>✍️ Awaiting Leave Approval (Signature Required)</span>
                          <span style={{ fontSize: '0.75rem', background: 'rgba(245,158,11,0.08)', padding: '2px 8px', borderRadius: '4px' }}>
                            {stats.leave.pendingApprovals.length} Pending
                          </span>
                        </div>

                        {stats.leave.pendingApprovals.length === 0 ? (
                          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ☕ No leave requests waiting for your approval! All caught up.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {stats.leave.pendingApprovals.map((l: any) => (
                              <div key={l.id} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(245,158,11,0.02)', border: '1px solid rgba(245,158,11,0.08)', padding: '0.85rem', borderRadius: '8px', gap: '0.4rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'white' }}>{l.name}</span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '8px' }}>({l.department})</span>
                                  </div>
                                  <span className="badge" style={{ background: 'rgba(245,158,11,0.08)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.15)', fontSize: '0.62rem' }}>
                                    {l.leaveType} · {l.days} days
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                                  📅 Range: {l.range}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(255,255,255,0.01)', padding: '0.4rem 0.6rem', borderRadius: '4px', borderLeft: '2px solid rgba(245,158,11,0.3)' }}>
                                  💬 "{l.reason}"
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>

                    {/* OPERATIONAL CONTROL DECK */}
                    <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'white', marginBottom: '1rem' }}>
                        ⚡ Operational Control Deck
                      </h3>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                        <Link href="/employees" style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', textDecoration: 'none', color: 'white', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, display: 'block', transition: 'background 0.2s' }}>
                          👥 Employees
                        </Link>
                        <Link href="/attendance" style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', textDecoration: 'none', color: 'white', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, display: 'block' }}>
                          📅 Attendance
                        </Link>
                        <Link href="/payroll" style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', textDecoration: 'none', color: 'white', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, display: 'block' }}>
                          💰 Payroll
                        </Link>
                        <Link href="/recruitment" style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', textDecoration: 'none', color: 'white', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, display: 'block' }}>
                          🎯 Recruitment
                        </Link>
                        <Link href="/projects" style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', textDecoration: 'none', color: 'white', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, display: 'block' }}>
                          📂 Projects
                        </Link>
                        <Link href="/checklists" style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', textDecoration: 'none', color: 'white', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, display: 'block' }}>
                          🚀 Checklist Path
                        </Link>
                      </div>
                    </div>

                  </div>

                </div>

              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}