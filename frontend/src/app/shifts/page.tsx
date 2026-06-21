'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import {
  getShiftTypes,
  createShiftType,
  getShiftAssignments,
  createShiftAssignment,
  getEmployees,
  getDepartments,
  verifyCheckin,
  getShiftAuditLogs,
} from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { ValidatedInput } from '@/components/ValidatedField';
import { validateForm, required, amount, nonNegative, integer } from '@/lib/validators';

interface ShiftType {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  shiftAllowance: number;
  ipRestricted: boolean;
  allowedIpRange?: string;
  geoRestricted: boolean;
  allowedLatitude?: number;
  allowedLongitude?: number;
  allowedRadiusMeters?: number;
  weeklyOffs?: string;
  gracePeriod?: number;
  minimumWorkHours?: number;
  startDay?: string;
  endDay?: string;
}

interface ShiftAssignment {
  id: string;
  startDate: string;
  endDate?: string;
  employeeId: string;
  employee: {
    firstName: string;
    lastName: string;
    jobTitle: string;
    gender?: string;
    location?: string;
    department?: {
      id: string;
      name: string;
    };
  };
  shiftType: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    shiftAllowance: number;
  };
  changeReason?: string;
  changedBy?: string;
  createdAt?: string;
}

export default function ShiftsDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab State
  const [activeTab, setActiveTab] = useState<'available_shifts' | 'employee_roster' | 'calendar_view' | 'roster_history'>('employee_roster');

  // Muster / Roster States
  const [rosterViewMode, setRosterViewMode] = useState<'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Filters
  const [filterGender, setFilterGender] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');

  // Calendar click popup modal states
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<Date | null>(null);
  const [popupFilterGender, setPopupFilterGender] = useState('');
  const [popupFilterLocation, setPopupFilterLocation] = useState('');
  const [popupFilterDept, setPopupFilterDept] = useState('');

  // Modals
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeSubmitted, setTypeSubmitted] = useState(false);
  const [typeError, setTypeError] = useState('');

  // Define Type Form State
  const [typeForm, setTypeForm] = useState({
    name: '',
    code: '',
    startTime: '09:00',
    endTime: '18:00',
    startDay: 'Monday',
    endDay: 'Monday',
    gracePeriod: '15',
    minimumWorkHours: '8.0',
    weeklyOffs: 'Sunday',
    shiftAllowance: '',
    ipRestricted: false,
    allowedIpRange: '',
    geoRestricted: false,
    allowedLatitude: '19.0760',
    allowedLongitude: '72.8777',
    allowedRadiusMeters: '150',
  });

  // Simulator State
  const [simulator, setSimulator] = useState({
    latitude: '19.0760',
    longitude: '72.8777',
    clientIp: '192.168.1.50',
  });
  const [simulationResult, setSimulationResult] = useState<{ allowed: boolean; reason: string } | null>(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, filterGender, filterLocation, filterDepartment]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [typesData, assignmentsData, empData, deptData, auditData] = await Promise.all([
        getShiftTypes(),
        getShiftAssignments(),
        getEmployees({ gender: filterGender, location: filterLocation, departmentId: filterDepartment }),
        getDepartments(),
        getShiftAuditLogs().catch(() => []),
      ]);
      setShiftTypes(typesData);
      setAssignments(assignmentsData);
      setEmployees(empData.employees || []);
      setDepartments(deptData || []);
      setAuditLogs(auditData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    setTypeSubmitted(true);
    const { isValid, firstError } = validateForm(
      {
        name: typeForm.name,
        startTime: typeForm.startTime,
        endTime: typeForm.endTime,
        gracePeriod: typeForm.gracePeriod,
        minimumWorkHours: typeForm.minimumWorkHours,
      },
      {
        name: required('Name'),
        startTime: required('Start time'),
        endTime: required('End time'),
        gracePeriod: integer('Grace period'),
        minimumWorkHours: nonNegative('Minimum work hours'),
      }
    );
    if (!isValid) {
      setTypeError(firstError || 'Please correct the highlighted fields.');
      return;
    }
    if (typeForm.shiftAllowance) {
      const allowanceErr = amount(typeForm.shiftAllowance);
      if (allowanceErr) {
        setTypeError(allowanceErr);
        return;
      }
    }
    setTypeError('');
    try {
      await createShiftType({
        ...typeForm,
        shiftAllowance: parseFloat(typeForm.shiftAllowance) || 0,
        gracePeriod: parseInt(typeForm.gracePeriod) || 15,
        minimumWorkHours: parseFloat(typeForm.minimumWorkHours) || 8.0,
        allowedLatitude: typeForm.geoRestricted ? parseFloat(typeForm.allowedLatitude) : null,
        allowedLongitude: typeForm.geoRestricted ? parseFloat(typeForm.allowedLongitude) : null,
        allowedRadiusMeters: typeForm.geoRestricted ? parseFloat(typeForm.allowedRadiusMeters) : null,
      });
      setShowTypeModal(false);
      setTypeSubmitted(false);
      setTypeError('');
      setTypeForm({
        name: '',
        code: '',
        startTime: '09:00',
        endTime: '18:00',
        startDay: 'Monday',
        endDay: 'Monday',
        gracePeriod: '15',
        minimumWorkHours: '8.0',
        weeklyOffs: 'Sunday',
        shiftAllowance: '',
        ipRestricted: false,
        allowedIpRange: '',
        geoRestricted: false,
        allowedLatitude: '19.0760',
        allowedLongitude: '72.8777',
        allowedRadiusMeters: '150',
      });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to create shift type');
    }
  };

  const runSimulation = async () => {
    setSimulating(true);
    setSimulationResult(null);
    try {
      const result = await verifyCheckin({
        latitude: parseFloat(simulator.latitude),
        longitude: parseFloat(simulator.longitude),
        clientIp: simulator.clientIp,
      });
      setSimulationResult(result);
    } catch (err: any) {
      setSimulationResult({
        allowed: false,
        reason: err.response?.data?.reason || 'Failed to verify check-in constraints.',
      });
    } finally {
      setSimulating(false);
    }
  };

  // 1-Click Roster Update Handler
  const handleCellShiftChange = async (empId: string, date: Date, shiftId: string) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    try {
      await createShiftAssignment({
        employeeId: empId,
        shiftTypeId: shiftId,
        startDate: dateStr,
      });
      
      // Update local state assignments array for super-fast visual responsiveness
      const updatedAssignments = await getShiftAssignments();
      setAssignments(updatedAssignments);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to assign shift type');
    }
  };

  if (authLoading || !user) {
    return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  }

  const isAdminOrHR = user.role === 'ADMIN' || user.role === 'HR' || user.role === 'SUPER_ADMIN';

  // Muster Time helpers
  const getWeekDays = (baseDate: Date) => {
    const startOfWeek = new Date(baseDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const getMonthDays = (baseDate: Date) => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const numDays = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 1; i <= numDays; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  // Build high-performance fast lookup hash map for assignments on dates
  const assignmentMap: { [key: string]: string } = {}; // "empId_YYYY-MM-DD" -> shiftTypeId
  assignments.forEach(ass => {
    const dateStr = new Date(ass.startDate).toISOString().split('T')[0];
    assignmentMap[`${ass.employeeId}_${dateStr}`] = ass.shiftType.id;
  });

  const activeDays = rosterViewMode === 'week' ? getWeekDays(selectedDate) : getMonthDays(selectedDate);

  // Month navigation helpers
  const handlePrevRange = () => {
    const d = new Date(selectedDate);
    if (rosterViewMode === 'week') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    setSelectedDate(d);
  };

  const handleNextRange = () => {
    const d = new Date(selectedDate);
    if (rosterViewMode === 'week') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    setSelectedDate(d);
  };

  // Get Calendar Days Grid for active month
  const getCalendarDays = (baseDate: Date) => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    const startDayIndex = firstDay.getDay(); // 0 is Sunday, etc.
    
    // Total days in month
    const numDays = new Date(year, month + 1, 0).getDate();
    
    const calendarCells: (Date | null)[] = [];
    
    // Padding for empty prefix slots
    for (let i = 0; i < startDayIndex; i++) {
      calendarCells.push(null);
    }
    
    // Add all calendar dates
    for (let i = 1; i <= numDays; i++) {
      calendarCells.push(new Date(year, month, i));
    }
    
    return calendarCells;
  };

  // Group allocations counts by date
  const getAllocationMap = () => {
    const map: { [key: string]: { [shiftId: string]: { count: number; name: string } } } = {};
    
    assignments.forEach(ass => {
      const dateStr = new Date(ass.startDate).toISOString().split('T')[0];
      if (!map[dateStr]) map[dateStr] = {};
      
      const sId = ass.shiftType.id;
      if (!map[dateStr][sId]) {
        map[dateStr][sId] = { count: 0, name: ass.shiftType.name };
      }
      map[dateStr][sId].count += 1;
    });
    
    return map;
  };

  const allocationMap = getAllocationMap();
  const calendarCells = getCalendarDays(selectedDate);

  // Calendar Day clicked popup filter logic
  const getSelectedDaySubordinates = () => {
    if (!selectedCalendarDay) return [];
    const dateStr = selectedCalendarDay.toISOString().split('T')[0];
    
    return assignments.filter(ass => {
      const assDateStr = new Date(ass.startDate).toISOString().split('T')[0];
      if (assDateStr !== dateStr) return false;
      
      // Perform popup modal client-side filters
      const emp = ass.employee;
      if (popupFilterGender && emp.gender !== popupFilterGender) return false;
      if (popupFilterLocation && emp.location !== popupFilterLocation) return false;
      if (popupFilterDept && emp.department?.id !== popupFilterDept) return false;
      
      return true;
    });
  };

  return (
    <div className="app-layout">
      <Sidebar activePath="/shifts" />
      <main className="main-content">
        
        {/* Header */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #a855f7, #FFB23F)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M12 14v4"/><path d="M8 16h8"/>
              </svg>
            </div>
            <div>
              <h1 className="page-title">Shift Roster & Muster</h1>
              <p className="page-subtitle">
                {user.role === 'MANAGER' 
                  ? 'Manage and assign shifts dynamically for your direct subordinates' 
                  : 'Configure Dynamic allowances, geofenced structures, and design real-time muster templates'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {isAdminOrHR && (
              <button onClick={() => setShowTypeModal(true)} className="btn btn-secondary" style={{ border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                Create Shift Type
              </button>
            )}
          </div>
        </div>

        {/* View Selection Mode Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
          <button 
            onClick={() => setActiveTab('employee_roster')} 
            className="btn" 
            style={{ 
              background: activeTab === 'employee_roster' ? 'linear-gradient(135deg, #a855f7, #FFB23F)' : 'rgba(255,255,255,0.04)',
              color: 'white',
              border: 'none',
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: activeTab === 'employee_roster' ? '0 4px 15px rgba(168,85,247,0.3)' : 'none'
            }}
          >
            📋 Employee Shift Roster
          </button>
          
          <button 
            onClick={() => setActiveTab('calendar_view')} 
            className="btn" 
            style={{ 
              background: activeTab === 'calendar_view' ? 'linear-gradient(135deg, #a855f7, #FFB23F)' : 'rgba(255,255,255,0.04)',
              color: 'white',
              border: 'none',
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: activeTab === 'calendar_view' ? '0 4px 15px rgba(168,85,247,0.3)' : 'none'
            }}
          >
            📅 Calendar Allocation View
          </button>

          <button 
            onClick={() => setActiveTab('available_shifts')} 
            className="btn" 
            style={{ 
              background: activeTab === 'available_shifts' ? 'linear-gradient(135deg, #a855f7, #FFB23F)' : 'rgba(255,255,255,0.04)',
              color: 'white',
              border: 'none',
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: activeTab === 'available_shifts' ? '0 4px 15px rgba(168,85,247,0.3)' : 'none'
            }}
          >
            ⚙️ Available Shift Modes
          </button>

          <button 
            onClick={() => setActiveTab('roster_history')} 
            className="btn" 
            style={{ 
              background: activeTab === 'roster_history' ? 'linear-gradient(135deg, #a855f7, #FFB23F)' : 'rgba(255,255,255,0.04)',
              color: 'white',
              border: 'none',
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: activeTab === 'roster_history' ? '0 4px 15px rgba(168,85,247,0.3)' : 'none'
            }}
          >
            📜 Change History & Audit Logs
          </button>
        </div>

        {/* ──── TAB 1: EMPLOYEE SHIFT ROSTER (MUSTER GRID) ──── */}
        {activeTab === 'employee_roster' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Roster Controls & Filters */}
            <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
              
              {/* Date & Week/Month View Switchers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button onClick={handlePrevRange} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }}>◀ Prev</button>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'white', minWidth: '160px', textAlign: 'center' }}>
                  {rosterViewMode === 'week' 
                    ? `Week of ${activeDays[0].toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
                    : activeDays[0].toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                  }
                </span>
                <button onClick={handleNextRange} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }}>Next ▶</button>
                
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.2rem', marginLeft: '0.5rem' }}>
                  <button 
                    onClick={() => setRosterViewMode('week')} 
                    style={{ background: rosterViewMode === 'week' ? '#a855f7' : 'transparent', color: 'white', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Week
                  </button>
                  <button 
                    onClick={() => setRosterViewMode('month')} 
                    style={{ background: rosterViewMode === 'month' ? '#a855f7' : 'transparent', color: 'white', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Month
                  </button>
                </div>
              </div>

              {/* Roster Filters */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="select-field" style={{ width: '110px', fontSize: '0.75rem', padding: '0.4rem' }}>
                  <option value="">All Genders</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>

                <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="select-field" style={{ width: '130px', fontSize: '0.75rem', padding: '0.4rem' }}>
                  <option value="">All Locations</option>
                  <option value="Mumbai Office">Mumbai</option>
                  <option value="Bangalore Office">Bangalore</option>
                  <option value="Pune Office">Pune</option>
                </select>

                <select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)} className="select-field" style={{ width: '130px', fontSize: '0.75rem', padding: '0.4rem' }}>
                  <option value="">All Depts</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            {/* Sticky/Scrollable Muster Grid */}
            <div className="glass-card" style={{ padding: '1.25rem', overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white' }}>
                  {user.role === 'MANAGER' ? 'Direct Subordinates Shift Muster' : 'Active Employee Muster'}
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  💡 Change employee shifts instantly with a single click in the calendar grid.
                </span>
              </div>

              {loading ? (
                <div className="loading-container"><div className="loading-spinner" />Loading muster schedules...</div>
              ) : employees.length === 0 ? (
                <div className="empty-state">No matching employees found for shift rostering.</div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <table className="data-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        {/* Sticky Employee Name Column */}
                        <th style={{ position: 'sticky', left: 0, background: '#11131c', zIndex: 12, width: '220px', minWidth: '220px', borderRight: '2px solid rgba(255,255,255,0.08)' }}>
                          Employee Detail
                        </th>
                        {activeDays.map(day => (
                          <th key={day.toISOString()} style={{ textAlign: 'center', minWidth: '95px', padding: '0.5rem 0.25rem' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              {day.toLocaleDateString('en-IN', { weekday: 'short' })}
                            </div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>
                              {day.getDate()}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map(emp => (
                        <tr key={emp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          {/* Sticky Employee Name cell */}
                          <td style={{ position: 'sticky', left: 0, background: '#11131c', zIndex: 10, borderRight: '2px solid rgba(255,255,255,0.08)', padding: '0.75rem' }}>
                            <div style={{ fontWeight: 700, color: 'white', fontSize: '0.82rem' }}>{emp.firstName} {emp.lastName}</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{emp.jobTitle}</div>
                            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.04)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                                {emp.location || 'HQ'}
                              </span>
                              <span style={{ fontSize: '0.6rem', color: '#FFB23F', background: 'rgba(168,85,247,0.05)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                                {emp.department?.name || 'Staff'}
                              </span>
                            </div>
                          </td>

                          {/* 1-Click Interactive Date Cells */}
                          {activeDays.map(day => {
                            const dateStr = day.toISOString().split('T')[0];
                            const currentShiftId = assignmentMap[`${emp.id}_${dateStr}`] || 'GENERAL';

                            return (
                              <td key={day.toISOString()} style={{ textAlign: 'center', padding: '0.4rem 0.25rem', verticalAlign: 'middle' }}>
                                <select 
                                  value={currentShiftId}
                                  onChange={e => handleCellShiftChange(emp.id, day, e.target.value)}
                                  style={{
                                    width: '100%',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '0.3rem',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    cursor: 'pointer',
                                    background: currentShiftId === 'GENERAL' 
                                      ? 'rgba(255,255,255,0.02)' 
                                      : 'rgba(168,85,247,0.15)',
                                    color: currentShiftId === 'GENERAL' ? 'var(--text-secondary)' : '#FFB23F'
                                  }}
                                >
                                  <option value="GENERAL">General</option>
                                  {shiftTypes.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                  ))}
                                </select>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ──── TAB 2: CALENDAR ALLOCATION VIEW ──── */}
        {activeTab === 'calendar_view' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Month selector & legend */}
            <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button onClick={handlePrevRange} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }}>◀ Prev Month</button>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: 'white', minWidth: '160px', textAlign: 'center' }}>
                  {selectedDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={handleNextRange} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }}>Next Month ▶</button>
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFB23F' }} /> Allocation counts visible per active shift
                </span>
                <span>💡 Click on any day to filter and view assigned employees.</span>
              </div>
            </div>

            {/* Monthly Calendar Grid */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '0.5rem', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', minHeight: '420px' }}>
                {calendarCells.map((date, idx) => {
                  if (!date) {
                    return <div key={`empty-${idx}`} style={{ background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }} />;
                  }

                  const dateStr = date.toISOString().split('T')[0];
                  const dayAllocations = allocationMap[dateStr] || {};
                  const isToday = new Date().toDateString() === date.toDateString();

                  return (
                    <div 
                      key={dateStr} 
                      onClick={() => setSelectedCalendarDay(date)}
                      style={{
                        background: isToday ? 'rgba(168,85,247,0.05)' : 'rgba(255,255,255,0.02)',
                        border: isToday ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '8px',
                        padding: '0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        minHeight: '85px'
                      }}
                      onMouseEnter={e => e.currentTarget.style.border = '1px solid #FFB23F'}
                      onMouseLeave={e => e.currentTarget.style.border = isToday ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.04)'}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: isToday ? '#FFB23F' : 'white', textAlign: 'right' }}>
                        {date.getDate()}
                      </div>

                      {/* Allocations stack */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.25rem' }}>
                        {Object.keys(dayAllocations).length === 0 ? (
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>General only</span>
                        ) : (
                          Object.entries(dayAllocations).map(([sId, data]) => (
                            <span 
                              key={sId}
                              style={{
                                fontSize: '0.65rem',
                                color: 'white',
                                background: 'rgba(168,85,247,0.2)',
                                padding: '0.1rem 0.25rem',
                                borderRadius: '4px',
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {data.name}: <strong>{data.count}</strong>
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* ──── TAB 3: AVAILABLE SHIFT MODES ──── */}
        {activeTab === 'available_shifts' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* Shift Types details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', marginBottom: '0.2rem' }}>Configured Shift Schemes</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                {shiftTypes.length === 0 ? (
                  <div className="empty-state">No custom shifts defined.</div>
                ) : (
                  shiftTypes.map(type => (
                    <div key={type.id} className="glass-card" style={{ padding: '1.25rem', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'white' }}>{type.name}</h3>
                        <span className="badge" style={{ background: 'rgba(168,85,247,0.1)', color: '#FFB23F', border: '1px solid rgba(168,85,247,0.2)', fontSize: '0.65rem' }}>
                          {type.startTime} - {type.endTime}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', paddingBottom: '0.25rem' }}>
                        <span>Shift Allowance:</span>
                        <strong style={{ color: '#10b981' }}>INR {type.shiftAllowance || 0} / shift</strong>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Weekly Offs:</span>
                          <span style={{ color: 'white', fontWeight: 600 }}>{type.weeklyOffs || 'Sunday'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Grace Period:</span>
                          <span style={{ color: 'white', fontWeight: 600 }}>{type.gracePeriod || 15} mins</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Min Work Hours:</span>
                          <span style={{ color: 'white', fontWeight: 600 }}>{type.minimumWorkHours || 8.0} hrs</span>
                        </div>
                        {((type.startDay && type.endDay && type.startDay !== type.endDay) || (type.startTime > type.endTime)) && (
                          <div style={{ color: '#fbbf24', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                            🌙 Overnight / Night Shift Setup
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {type.geoRestricted && (
                          <span style={{ fontSize: '0.65rem', background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '0.15rem 0.35rem', borderRadius: '4px' }}>
                            📍 Geofenced ({type.allowedRadiusMeters}m)
                          </span>
                        )}
                        {type.ipRestricted && (
                          <span style={{ fontSize: '0.65rem', background: 'rgba(0,167,181,0.1)', color: '#73E0E7', padding: '0.15rem 0.35rem', borderRadius: '4px' }}>
                            🌐 IP Restricted
                          </span>
                        )}
                        {!type.geoRestricted && !type.ipRestricted && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>No boundary restrictions</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Geofence Simulator */}
            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'white' }}>Geofence Check-in Simulator</h2>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Simulate coordinates and IP checks to audit check-in safety bounds</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Latitude</label>
                  <input type="text" value={simulator.latitude} onChange={e => setSimulator({ ...simulator, latitude: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Longitude</label>
                  <input type="text" value={simulator.longitude} onChange={e => setSimulator({ ...simulator, longitude: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Client Check-in IP Address</label>
                  <input type="text" value={simulator.clientIp} onChange={e => setSimulator({ ...simulator, clientIp: e.target.value })} className="input-field" />
                </div>

                <button type="button" onClick={runSimulation} disabled={simulating} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #a855f7, #FFB23F)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                  {simulating ? 'Auditing Boundary...' : 'Verify Boundary Constraints'}
                </button>
              </div>

              {simulationResult && (
                <div style={{ padding: '1rem', background: simulationResult.allowed ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: simulationResult.allowed ? '1px solid #10b981' : '1px solid #ef4444', borderRadius: '8px', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: simulationResult.allowed ? '#10b981' : '#f87171' }}>
                    {simulationResult.allowed ? '✓ Check-in Allowable' : '✕ Boundary Violation'}
                  </span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{simulationResult.reason}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──── TAB 4: ROSTER CHANGE HISTORY & AUDIT LOGS ──── */}
        {activeTab === 'roster_history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Roster Assignment History List */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Roster Assignment Change Logs</h2>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Historical tracking of all shift reassignments and overrides</p>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Effective Date</th>
                      <th>Previous Shift</th>
                      <th>Assigned Shift</th>
                      <th>Reason</th>
                      <th>Assigned By</th>
                      <th>Assigned On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                          No historical roster changes recorded.
                        </td>
                      </tr>
                    ) : (
                      assignments.map(ass => (
                        <tr key={ass.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'white' }}>{ass.employee?.firstName} {ass.employee?.lastName}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ass.employee?.jobTitle}</div>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {new Date(ass.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td>
                            <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>
                              General Shift
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-primary" style={{ background: 'rgba(168,85,247,0.15)', color: '#FFB23F', border: '1px solid rgba(168,85,247,0.25)', fontSize: '0.68rem' }}>
                              {ass.shiftType?.name}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'white' }}>
                            {ass.changeReason || 'Initial Assignment'}
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {ass.changedBy || 'SYSTEM'}
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {ass.createdAt ? new Date(ass.createdAt).toLocaleString('en-IN') : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>System Audit Logs</h2>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Real-time transactional audit trail of roster changes and system checks</p>
              </div>

              <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Performed By</th>
                      <th>Action</th>
                      <th>Entity Affected</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                          No system audit logs found.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log: any) => (
                        <tr key={log.id}>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {new Date(log.createdAt).toLocaleString('en-IN')}
                          </td>
                          <td style={{ fontWeight: 600, color: 'white', fontSize: '0.78rem' }}>
                            {log.userEmail}
                          </td>
                          <td>
                            <span className={`badge ${
                              log.action.includes('CREATE') ? 'badge-success' :
                              log.action.includes('DELETE') ? 'badge-danger' : 'badge-info'
                            }`} style={{ fontSize: '0.65rem' }}>
                              {log.action}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'white' }}>
                            {log.entityType} ({log.entityId || 'N/A'})
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.newValue || ''}>
                            {log.newValue || log.oldValue || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ──── POPUP MODAL: CALENDAR DAY DETAIL ──── */}
        {selectedCalendarDay && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '640px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'white' }}>
                    Allocations: {selectedCalendarDay.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>List of employees custom-scheduled for today</p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedCalendarDay(null);
                    setPopupFilterGender('');
                    setPopupFilterLocation('');
                    setPopupFilterDept('');
                  }} 
                  style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}
                >
                  ✕
                </button>
              </div>

              {/* Day-specific Filters */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <select value={popupFilterGender} onChange={e => setPopupFilterGender(e.target.value)} className="select-field" style={{ flex: 1, fontSize: '0.72rem', padding: '0.4rem' }}>
                  <option value="">Filter Gender...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>

                <select value={popupFilterLocation} onChange={e => setPopupFilterLocation(e.target.value)} className="select-field" style={{ flex: 1, fontSize: '0.72rem', padding: '0.4rem' }}>
                  <option value="">Filter Location...</option>
                  <option value="Mumbai Office">Mumbai</option>
                  <option value="Bangalore Office">Bangalore</option>
                  <option value="Pune Office">Pune</option>
                </select>

                <select value={popupFilterDept} onChange={e => setPopupFilterDept(e.target.value)} className="select-field" style={{ flex: 1, fontSize: '0.72rem', padding: '0.4rem' }}>
                  <option value="">Filter Dept...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {/* Employees List */}
              <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.50rem' }}>
                {getSelectedDaySubordinates().length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No custom-scheduled employees match the active filters on this day.
                  </div>
                ) : (
                  getSelectedDaySubordinates().map(ass => (
                    <div 
                      key={ass.id} 
                      className="glass-card" 
                      style={{ 
                        padding: '0.75rem 1rem', 
                        background: 'rgba(255,255,255,0.02)', 
                        border: '1px solid rgba(255,255,255,0.05)', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center' 
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: 'white', fontSize: '0.85rem' }}>
                          {ass.employee.firstName} {ass.employee.lastName}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {ass.employee.jobTitle} • {ass.employee.department?.name || 'Staff'}
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>📍 {ass.employee.location || 'HQ'}</span>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>👤 {ass.employee.gender || '—'}</span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span className="badge" style={{ background: 'rgba(168,85,247,0.15)', color: '#FFB23F', border: '1px solid rgba(168,85,247,0.2)' }}>
                          {ass.shiftType.name}
                        </span>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {ass.shiftType.startTime} - {ass.shiftType.endTime}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button 
                  onClick={() => {
                    setSelectedCalendarDay(null);
                    setPopupFilterGender('');
                    setPopupFilterLocation('');
                    setPopupFilterDept('');
                  }} 
                  className="btn btn-secondary"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Define Type Modal */}
        {showTypeModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Define Shift Type</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Configure schedule bounds and shift allowances</p>
              </div>

              <form onSubmit={handleCreateType} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {typeError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '0.6rem 0.85rem', borderRadius: '8px', fontSize: '0.78rem' }}>{typeError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Shift Name</label>
                    <ValidatedInput type="text" placeholder="e.g. Night Roster" required value={typeForm.name} onChange={v => setTypeForm({ ...typeForm, name: v })} validator={required('Name')} forceError={typeSubmitted} className="input-field" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Code</label>
                    <ValidatedInput type="text" placeholder="e.g. NS01" value={typeForm.code} onChange={v => setTypeForm({ ...typeForm, code: v })} className="input-field" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Start Time</label>
                    <ValidatedInput type="text" placeholder="09:00" required value={typeForm.startTime} onChange={v => setTypeForm({ ...typeForm, startTime: v })} validator={required('Start time')} forceError={typeSubmitted} className="input-field" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>End Time</label>
                    <ValidatedInput type="text" placeholder="18:00" required value={typeForm.endTime} onChange={v => setTypeForm({ ...typeForm, endTime: v })} validator={required('End time')} forceError={typeSubmitted} className="input-field" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Start Day</label>
                    <select value={typeForm.startDay} onChange={e => setTypeForm({ ...typeForm, startDay: e.target.value })} className="select-field">
                      <option value="Monday">Monday</option>
                      <option value="Tuesday">Tuesday</option>
                      <option value="Wednesday">Wednesday</option>
                      <option value="Thursday">Thursday</option>
                      <option value="Friday">Friday</option>
                      <option value="Saturday">Saturday</option>
                      <option value="Sunday">Sunday</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>End Day (Overnight)</label>
                    <select value={typeForm.endDay} onChange={e => setTypeForm({ ...typeForm, endDay: e.target.value })} className="select-field">
                      <option value="Monday">Monday</option>
                      <option value="Tuesday">Tuesday</option>
                      <option value="Wednesday">Wednesday</option>
                      <option value="Thursday">Thursday</option>
                      <option value="Friday">Friday</option>
                      <option value="Saturday">Saturday</option>
                      <option value="Sunday">Sunday</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Allowance</label>
                    <ValidatedInput inputMode="decimal" placeholder="200" value={typeForm.shiftAllowance} onChange={v => setTypeForm({ ...typeForm, shiftAllowance: v })} restrict="decimal" forceError={typeSubmitted} className="input-field" style={{ padding: '0.5rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Grace (min)</label>
                    <ValidatedInput inputMode="numeric" placeholder="15" value={typeForm.gracePeriod} onChange={v => setTypeForm({ ...typeForm, gracePeriod: v })} validator={integer('Grace period')} restrict="digits" forceError={typeSubmitted} className="input-field" style={{ padding: '0.5rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Min Hours</label>
                    <ValidatedInput inputMode="decimal" placeholder="8.0" value={typeForm.minimumWorkHours} onChange={v => setTypeForm({ ...typeForm, minimumWorkHours: v })} validator={nonNegative('Minimum work hours')} restrict="decimal" forceError={typeSubmitted} className="input-field" style={{ padding: '0.5rem' }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Weekly Offs (comma separated)</label>
                  <ValidatedInput type="text" placeholder="Sunday" value={typeForm.weeklyOffs} onChange={v => setTypeForm({ ...typeForm, weeklyOffs: v })} className="input-field" />
                </div>

                <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.75rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={typeForm.geoRestricted} onChange={e => setTypeForm({ ...typeForm, geoRestricted: e.target.checked })} />
                    Geofenced Check-in
                  </label>

                  <label style={{ fontSize: '0.75rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={typeForm.ipRestricted} onChange={e => setTypeForm({ ...typeForm, ipRestricted: e.target.checked })} />
                    IP Restricted
                  </label>
                </div>

                {typeForm.geoRestricted && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '4px' }}>
                    <div>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Lat</label>
                      <ValidatedInput type="text" value={typeForm.allowedLatitude} onChange={v => setTypeForm({ ...typeForm, allowedLatitude: v })} className="input-field" style={{ fontSize: '0.75rem', padding: '0.25rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Lng</label>
                      <ValidatedInput type="text" value={typeForm.allowedLongitude} onChange={v => setTypeForm({ ...typeForm, allowedLongitude: v })} className="input-field" style={{ fontSize: '0.75rem', padding: '0.25rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Radius(m)</label>
                      <ValidatedInput inputMode="numeric" value={typeForm.allowedRadiusMeters} onChange={v => setTypeForm({ ...typeForm, allowedRadiusMeters: v })} restrict="digits" className="input-field" style={{ fontSize: '0.75rem', padding: '0.25rem' }} />
                    </div>
                  </div>
                )}

                {typeForm.ipRestricted && (
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '4px' }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Allowed IP Substring (e.g. 192.168.1)</label>
                    <ValidatedInput type="text" placeholder="192.168.1" value={typeForm.allowedIpRange} onChange={v => setTypeForm({ ...typeForm, allowedIpRange: v })} className="input-field" style={{ fontSize: '0.75rem' }} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => { setShowTypeModal(false); setTypeSubmitted(false); setTypeError(''); }} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #a855f7, #FFB23F)', border: 'none' }}>
                    Create Shift
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
