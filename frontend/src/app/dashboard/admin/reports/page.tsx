'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import {
  getStatutoryReport,
  getDashboardData,
  queryEmployeesReport,
  downloadReportExport,
  getAnalyticsReport
} from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

type TabType = 'compliance' | 'diversity' | 'builder';

export default function ReportsDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('compliance');
  const [loading, setLoading] = useState(true);
  
  // Dashboard & Report Data
  const [chroData, setChroData] = useState<any>(null);
  const [compStats, setCompStats] = useState<any>(null);
  const [epfData, setEpfData] = useState<any[]>([]);
  const [esiData, setEsiData] = useState<any[]>([]);
  const [minWageData, setMinWageData] = useState<any[]>([]);
  const [genderGapData, setGenderGapData] = useState<any[]>([]);
  
  // Analytics charts
  const [ageData, setAgeData] = useState<any[]>([]);
  const [expData, setExpData] = useState<any[]>([]);
  const [genderDistribution, setGenderDistribution] = useState<any[]>([]);

  // Query Builder State
  const [builderCols, setBuilderCols] = useState<string[]>(['employeeId', 'firstName', 'lastName', 'gender', 'jobTitle', 'department']);
  const [builderFilters, setBuilderFilters] = useState<any[]>([
    { field: 'gender', operator: 'EQUALS', value: 'FEMALE' }
  ]);
  const [builderResult, setBuilderResult] = useState<any[]>([]);
  const [builderRunning, setBuilderRunning] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && user.role !== 'MANAGER'))) {
      router.push('/');
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (user) {
      loadInitialStats();
    }
  }, [user]);

  const loadInitialStats = async () => {
    try {
      setLoading(true);
      const [chro, comp, epf, esi, minWage, payGap, age, exp, div] = await Promise.all([
        getDashboardData('chro'),
        getDashboardData('compliance'),
        getStatutoryReport('epf'),
        getStatutoryReport('esi'),
        getStatutoryReport('minwage'),
        getStatutoryReport('gender-pay-gap'),
        getAnalyticsReport('age'),
        getAnalyticsReport('experience'),
        getAnalyticsReport('diversity')
      ]);

      setChroData(chro);
      setCompStats(comp);
      setEpfData(epf.data || []);
      setEsiData(esi.data || []);
      setMinWageData(minWage.data || []);
      setGenderGapData(payGap.data || []);
      setAgeData(age.data || []);
      setExpData(exp.data || []);
      setGenderDistribution(div.data || []);
      
      // Run builder query once to initialize
      runBuilderQuery();
    } catch (err) {
      console.error('Failed to load compliance & analytics reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const runBuilderQuery = async () => {
    try {
      setBuilderRunning(true);
      const res = await queryEmployeesReport({
        columns: builderCols,
        filters: builderFilters.filter(f => f.field && f.value)
      });
      setBuilderResult(res.data || []);
    } catch (err) {
      console.error('Failed to execute builder query:', err);
    } finally {
      setBuilderRunning(false);
    }
  };

  const handleExport = async () => {
    try {
      await downloadReportExport({ reportType: 'general' });
    } catch (err) {
      alert('Failed to generate Excel report');
    }
  };

  if (authLoading || !user) {
    return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  }

  const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" style={{ padding: '2rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

          {/* PAGE HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800, background: 'linear-gradient(135deg, #ffffff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.25rem' }}>
                Workforce Intelligence & Compliance Reports
              </h1>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Statutory wage compliance, gender metrics, age and experience bands, and dynamic ad-hoc report builder.
              </p>
            </div>
            <button 
              onClick={handleExport}
              className="btn btn-primary"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              📥 Export Master Excel Ledger
            </button>
          </div>

          {/* KEY SCORECARDS */}
          {chroData && compStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>EPF Compliance</span>
                <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', margin: '0.25rem 0' }}>{compStats.pfCompliancePercent}%</h3>
                <p style={{ fontSize: '0.65rem', color: '#10b981' }}>Active UAN registrations matches</p>
              </div>
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>ESI Compliance</span>
                <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', margin: '0.25rem 0' }}>{compStats.esiCompliancePercent}%</h3>
                <p style={{ fontSize: '0.65rem', color: '#10b981' }}>Standard rate coverage</p>
              </div>
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Gender Diversity</span>
                <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#a855f7', margin: '0.25rem 0' }}>{chroData.diversityRatio}%</h3>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Female staff headcount ratio</p>
              </div>
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Compliance Score</span>
                <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', margin: '0.25rem 0' }}>{chroData.complianceScore}%</h3>
                <p style={{ fontSize: '0.65rem', color: '#10b981' }}>Zero penalties incurred</p>
              </div>
            </div>
          )}

          {/* NAVIGATION TABS */}
          <div className="tabs-container" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
            <button 
              onClick={() => setActiveTab('compliance')} 
              style={{ background: 'none', border: 'none', color: activeTab === 'compliance' ? '#a855f7' : 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, paddingBottom: '0.5rem', borderBottom: activeTab === 'compliance' ? '2px solid #a855f7' : 'none', cursor: 'pointer' }}
            >
              ⚖️ Statutory Compliances (EPF/ESI/PT)
            </button>
            <button 
              onClick={() => setActiveTab('diversity')} 
              style={{ background: 'none', border: 'none', color: activeTab === 'diversity' ? '#a855f7' : 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, paddingBottom: '0.5rem', borderBottom: activeTab === 'diversity' ? '2px solid #a855f7' : 'none', cursor: 'pointer' }}
            >
              📊 Demographics & Pay Gap
            </button>
            <button 
              onClick={() => setActiveTab('builder')} 
              style={{ background: 'none', border: 'none', color: activeTab === 'builder' ? '#a855f7' : 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, paddingBottom: '0.5rem', borderBottom: activeTab === 'builder' ? '2px solid #a855f7' : 'none', cursor: 'pointer' }}
            >
              ⚙️ Interactive Report Builder
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <div className="loading-spinner" />
            </div>
          ) : (
            <>
              {/* TAB 1: STATUTORY COMPLIANCE TABLES */}
              {activeTab === 'compliance' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* EPF REGISTER */}
                  <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', marginBottom: '1rem' }}>
                       Provident Fund (EPF) Statutory Register
                    </h3>
                    <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '0.75rem' }}>Emp ID</th>
                            <th style={{ padding: '0.75rem' }}>Name</th>
                            <th style={{ padding: '0.75rem' }}>UAN Number</th>
                            <th style={{ padding: '0.75rem' }}>PF Wages (Capped)</th>
                            <th style={{ padding: '0.75rem' }}>Employee PF (12%)</th>
                            <th style={{ padding: '0.75rem' }}>Employer PF (3.67%)</th>
                            <th style={{ padding: '0.75rem' }}>EPS Contribution (8.33%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {epfData.map((row: any) => (
                            <tr key={row.employeeId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '0.65rem', fontWeight: 600, color: 'white' }}>{row.employeeId}</td>
                              <td style={{ padding: '0.65rem' }}>{row.name}</td>
                              <td style={{ padding: '0.65rem', color: 'var(--text-secondary)' }}>{row.uan}</td>
                              <td style={{ padding: '0.65rem' }}>
                                {typeof row.pfWages === 'number' ? `₹${row.pfWages.toLocaleString()}` : row.pfWages}
                              </td>
                              <td style={{ padding: '0.65rem', color: '#10b981', fontWeight: 600 }}>
                                {typeof row.employeePf === 'number' ? `₹${row.employeePf.toLocaleString()}` : row.employeePf}
                              </td>
                              <td style={{ padding: '0.65rem' }}>
                                {typeof row.employerPf === 'number' ? `₹${row.employerPf.toLocaleString()}` : row.employerPf}
                              </td>
                              <td style={{ padding: '0.65rem' }}>
                                {typeof row.employerEps === 'number' ? `₹${row.employerEps.toLocaleString()}` : row.employerEps}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ESI REGISTER */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', marginBottom: '1rem' }}>
                        🏥 State Insurance (ESI) Eligible Register (CTC ≤ ₹21,000)
                      </h3>
                      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '0.75rem' }}>Name</th>
                              <th style={{ padding: '0.75rem' }}>ESI Wages</th>
                              <th style={{ padding: '0.75rem' }}>Employee (0.75%)</th>
                              <th style={{ padding: '0.75rem' }}>Employer (3.25%)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {esiData.map((row: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '0.65rem', fontWeight: 600, color: 'white' }}>{row.name}</td>
                                <td style={{ padding: '0.65rem' }}>
                                  {typeof row.esiWages === 'number' ? `₹${row.esiWages.toLocaleString()}` : row.esiWages}
                                </td>
                                <td style={{ padding: '0.65rem', color: '#10b981' }}>
                                  {typeof row.employeeContribution === 'number' ? `₹${row.employeeContribution.toLocaleString()}` : row.employeeContribution}
                                </td>
                                <td style={{ padding: '0.65rem' }}>
                                  {typeof row.employerContribution === 'number' ? `₹${row.employerContribution.toLocaleString()}` : row.employerContribution}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* MINIMUM WAGES BY STATE */}
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', marginBottom: '1rem' }}>
                        📍 Minimum Wages Compliance Checker
                      </h3>
                      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '0.75rem' }}>Name</th>
                              <th style={{ padding: '0.75rem' }}>State</th>
                              <th style={{ padding: '0.75rem' }}>Wage</th>
                              <th style={{ padding: '0.75rem' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {minWageData.map((row: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '0.65rem', fontWeight: 600, color: 'white' }}>{row.name}</td>
                                <td style={{ padding: '0.65rem', color: 'var(--text-secondary)' }}>{row.state}</td>
                                <td style={{ padding: '0.65rem' }}>
                                  {typeof row.currentWage === 'number' ? `₹${row.currentWage.toLocaleString()}` : row.currentWage}
                                </td>
                                <td style={{ padding: '0.65rem' }}>
                                  <span className={`badge ${row.complianceStatus === 'COMPLIANT' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.62rem' }}>
                                    {row.complianceStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: DEMOGRAPHICS & GENDER PAY GAP */}
              {activeTab === 'diversity' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* CHARTS LAYOUT */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
                    
                    {/* GENDER PAY GAP */}
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', marginBottom: '1.25rem' }}>
                        ⚖️ Gender Pay Gap Analysis by Department
                      </h3>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={genderGapData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="department" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
                          <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} label={{ value: 'Gap %', angle: -90, position: 'insideLeft', fill: 'white', fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }} />
                          <Bar dataKey="genderGapPercent" name="Gender Wage Gap %" fill="#c084fc" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* DIVERSITY RATIO */}
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', marginBottom: '1.25rem' }}>
                        ⚧️ Gender Diversity Distribution
                      </h3>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie 
                            data={genderDistribution} 
                            cx="50%" 
                            cy="50%" 
                            innerRadius={60} 
                            outerRadius={90} 
                            dataKey="count" 
                            nameKey="gender"
                            label={({ gender, percentage }) => `${gender} (${percentage}%)`}
                          >
                            {genderDistribution.map((_, idx) => (
                              <Cell key={`cell-${idx}`} fill={idx === 0 ? '#3b82f6' : '#a855f7'} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                  </div>

                  {/* AGE & EXPERIENCE BANDS */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    
                    {/* AGE BANDS */}
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', marginBottom: '1.25rem' }}>
                        🎂 Headcount distribution by Age Groups
                      </h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={ageData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="ageBand" tick={{ fontSize: 11, fill: 'white' }} />
                          <YAxis tick={{ fontSize: 11, fill: 'white' }} />
                          <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }} />
                          <Bar dataKey="count" name="Employee Count" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* EXPERIENCE BANDS */}
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', marginBottom: '1.25rem' }}>
                        🏢 Internal Experience Bands (Tenure)
                      </h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={expData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="experienceBand" tick={{ fontSize: 11, fill: 'white' }} />
                          <YAxis tick={{ fontSize: 11, fill: 'white' }} />
                          <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }} />
                          <Bar dataKey="count" name="Employee Count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                  </div>

                </div>
              )}

              {/* TAB 3: CUSTOM QUERY BUILDER */}
              {activeTab === 'builder' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="glass-card" style={{ padding: '1.75rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', marginBottom: '1rem' }}>
                      ⚙️ Dynamic Query Engine
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
                      
                      {/* COLUMNS SELECTION */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                          Choose Output Columns:
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          {[
                            { key: 'employeeId', label: 'Employee ID' },
                            { key: 'firstName', label: 'First Name' },
                            { key: 'lastName', label: 'Last Name' },
                            { key: 'email', label: 'Email' },
                            { key: 'gender', label: 'Gender' },
                            { key: 'jobTitle', label: 'Designation' },
                            { key: 'department', label: 'Department' },
                            { key: 'location', label: 'Location' },
                            { key: 'salary', label: 'CTC Salary' }
                          ].map(col => (
                            <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                              <input 
                                type="checkbox" 
                                checked={builderCols.includes(col.key)} 
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setBuilderCols([...builderCols, col.key]);
                                  } else {
                                    setBuilderCols(builderCols.filter(c => c !== col.key));
                                  }
                                }}
                              />
                              {col.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* FILTERS SELECTION */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                          Add Filters:
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {builderFilters.map((filter, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <select 
                                className="form-control" 
                                style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                                value={filter.field} 
                                onChange={(e) => {
                                  const list = [...builderFilters];
                                  list[idx].field = e.target.value;
                                  setBuilderFilters(list);
                                }}
                              >
                                <option value="">Select Field</option>
                                <option value="gender">Gender</option>
                                <option value="department">Department Name</option>
                                <option value="location">Location</option>
                                <option value="employmentType">Employment Type</option>
                                <option value="age">Age (Older than)</option>
                                <option value="experience">Experience (Years)</option>
                              </select>

                              <select 
                                className="form-control" 
                                style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                                value={filter.operator} 
                                onChange={(e) => {
                                  const list = [...builderFilters];
                                  list[idx].operator = e.target.value;
                                  setBuilderFilters(list);
                                }}
                              >
                                <option value="EQUALS">Equals</option>
                                <option value="GREATER_THAN">Greater Than</option>
                                <option value="LESS_THAN">Less Than</option>
                                <option value="CONTAINS">Contains</option>
                              </select>

                              <input 
                                type="text" 
                                className="form-control" 
                                style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                                placeholder="Value" 
                                value={filter.value} 
                                onChange={(e) => {
                                  const list = [...builderFilters];
                                  list[idx].value = e.target.value;
                                  setBuilderFilters(list);
                                }}
                              />

                              <button 
                                type="button" 
                                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '1rem', cursor: 'pointer' }}
                                onClick={() => setBuilderFilters(builderFilters.filter((_, fIdx) => fIdx !== idx))}
                              >
                                🗑️
                              </button>
                            </div>
                          ))}

                          <button 
                            type="button" 
                            className="btn btn-neutral" 
                            style={{ fontSize: '0.7rem', width: 'fit-content', padding: '0.3rem 0.75rem' }}
                            onClick={() => setBuilderFilters([...builderFilters, { field: '', operator: 'EQUALS', value: '' }])}
                          >
                            ➕ Add Filter Row
                          </button>
                        </div>
                      </div>

                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button 
                        onClick={runBuilderQuery} 
                        className="btn btn-primary"
                        style={{ fontSize: '0.8rem', padding: '0.5rem 1.5rem' }}
                        disabled={builderRunning}
                      >
                        {builderRunning ? 'Executing...' : '🔍 Execute Dynamic Query'}
                      </button>
                    </div>
                  </div>

                  {/* QUERY RESULTS */}
                  <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white' }}>
                        📋 Results ({builderResult.length} Records Found)
                      </h3>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                            {builderCols.map(c => (
                              <th key={c} style={{ padding: '0.75rem', textTransform: 'capitalize' }}>
                                {c.replace('employeeId', 'Emp ID').replace('firstName', 'First').replace('lastName', 'Last').replace('jobTitle', 'Designation')}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {builderResult.length === 0 ? (
                            <tr>
                              <td colSpan={builderCols.length} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                No records found matching the active filters.
                              </td>
                            </tr>
                          ) : (
                            builderResult.map((row: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                {builderCols.map(colName => (
                                  <td key={colName} style={{ padding: '0.65rem' }}>
                                    {colName === 'salary' && typeof row[colName] === 'number' 
                                      ? `₹${row[colName].toLocaleString()}` 
                                      : row[colName] !== undefined ? String(row[colName]) : 'N/A'}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  );
}
