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
import { validateForm, required, amount, nonNegative, integer } from '@/lib/validators';
import {
  Button, Badge, StatusChip, Tabs, Modal, Drawer, Field, TextField, Select,
  DataTable, EmptyState, ErrorState, LoadingBlock, PageHeader, Banner, Checkbox,
} from '@/components/ui';
import type { Column, TabItem } from '@/components/ui';

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

interface AuditLog {
  id: string;
  createdAt: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId?: string;
  newValue?: string;
  oldValue?: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ShiftsDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

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
    setLoadError(false);
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
      setLoadError(true);
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

  const closeCalendarDay = () => {
    setSelectedCalendarDay(null);
    setPopupFilterGender('');
    setPopupFilterLocation('');
    setPopupFilterDept('');
  };

  const tabItems: TabItem[] = [
    { key: 'employee_roster', label: 'Roster' },
    { key: 'calendar_view', label: 'Calendar' },
    { key: 'available_shifts', label: 'Shift Modes' },
    { key: 'roster_history', label: 'Change History' },
  ];

  // History DataTable columns
  const historyColumns: Column<ShiftAssignment>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (ass) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ass.employee?.firstName} {ass.employee?.lastName}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ass.employee?.jobTitle}</div>
        </div>
      ),
    },
    {
      key: 'effectiveDate',
      header: 'Effective Date',
      render: (ass) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {new Date(ass.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'previousShift',
      header: 'Previous Shift',
      render: () => <Badge tone="neutral">General Shift</Badge>,
    },
    {
      key: 'assignedShift',
      header: 'Assigned Shift',
      render: (ass) => <Badge tone="payroll">{ass.shiftType?.name}</Badge>,
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (ass) => <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>{ass.changeReason || 'Initial Assignment'}</span>,
    },
    {
      key: 'changedBy',
      header: 'Assigned By',
      render: (ass) => <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{ass.changedBy || 'SYSTEM'}</span>,
    },
    {
      key: 'createdAt',
      header: 'Assigned On',
      render: (ass) => (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {ass.createdAt ? new Date(ass.createdAt).toLocaleString('en-IN') : '—'}
        </span>
      ),
    },
  ];

  const auditColumns: Column<AuditLog>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (log) => (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {new Date(log.createdAt).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'userEmail',
      header: 'Performed By',
      render: (log) => <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.78rem' }}>{log.userEmail}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      render: (log) => (
        <Badge tone={log.action.includes('CREATE') ? 'success' : log.action.includes('DELETE') ? 'danger' : 'info'}>
          {log.action}
        </Badge>
      ),
    },
    {
      key: 'entity',
      header: 'Entity Affected',
      render: (log) => <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>{log.entityType} ({log.entityId || 'N/A'})</span>,
    },
    {
      key: 'details',
      header: 'Details',
      render: (log) => (
        <span
          style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '300px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={log.newValue || ''}
        >
          {log.newValue || log.oldValue || '—'}
        </span>
      ),
    },
  ];

  const dayDetails = getSelectedDaySubordinates();

  return (
    <div className="app-layout">
      <Sidebar activePath="/shifts" />
      <main className="main-content">

        <PageHeader
          title="Shift Roster & Muster"
          subtitle={user.role === 'MANAGER'
            ? 'Manage and assign shifts dynamically for your direct subordinates'
            : 'Configure dynamic allowances, geofenced structures, and design real-time muster templates'}
          icon={(
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M12 14v4" /><path d="M8 16h8" />
            </svg>
          )}
          actions={isAdminOrHR && (
            <Button variant="primary" onClick={() => setShowTypeModal(true)}>Create Shift Type</Button>
          )}
        />

        <Tabs
          items={tabItems}
          value={activeTab}
          onChange={(k) => setActiveTab(k as typeof activeTab)}
          style={{ marginBottom: '1.5rem' }}
        />

        {loadError ? (
          <ErrorState onRetry={loadData} />
        ) : (
          <>
            {/* ──── TAB 1: EMPLOYEE SHIFT ROSTER (MUSTER GRID) ──── */}
            {activeTab === 'employee_roster' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Roster Controls & Filters */}
                <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>

                  {/* Date & Week/Month View Switchers */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <Button variant="ghost" size="sm" onClick={handlePrevRange}>◀ Prev</Button>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', minWidth: '160px', textAlign: 'center' }}>
                      {rosterViewMode === 'week'
                        ? `Week of ${activeDays[0].toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
                        : activeDays[0].toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                    </span>
                    <Button variant="ghost" size="sm" onClick={handleNextRange}>Next ▶</Button>

                    <div style={{ display: 'flex', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', padding: '0.2rem', marginLeft: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setRosterViewMode('week')}
                        style={{ background: rosterViewMode === 'week' ? 'var(--accent)' : 'transparent', color: rosterViewMode === 'week' ? 'var(--text-on-accent)' : 'var(--text-secondary)', border: 'none', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-xs)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Week
                      </button>
                      <button
                        type="button"
                        onClick={() => setRosterViewMode('month')}
                        style={{ background: rosterViewMode === 'month' ? 'var(--accent)' : 'transparent', color: rosterViewMode === 'month' ? 'var(--text-on-accent)' : 'var(--text-secondary)', border: 'none', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-xs)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Month
                      </button>
                    </div>
                  </div>

                  {/* Roster Filters */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ width: '120px' }}>
                      <Select
                        value={filterGender}
                        onChange={setFilterGender}
                        placeholder="All Genders"
                        options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]}
                      />
                    </div>
                    <div style={{ width: '140px' }}>
                      <Select
                        value={filterLocation}
                        onChange={setFilterLocation}
                        placeholder="All Locations"
                        options={[
                          { value: 'Mumbai Office', label: 'Mumbai' },
                          { value: 'Bangalore Office', label: 'Bangalore' },
                          { value: 'Pune Office', label: 'Pune' },
                        ]}
                      />
                    </div>
                    <div style={{ width: '140px' }}>
                      <Select
                        value={filterDepartment}
                        onChange={setFilterDepartment}
                        placeholder="All Depts"
                        options={departments.map(d => ({ value: d.id, label: d.name }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Sticky/Scrollable Muster Grid */}
                <div className="glass-card" style={{ padding: '1.25rem', overflowX: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {user.role === 'MANAGER' ? 'Direct Subordinates Shift Muster' : 'Active Employee Muster'}
                    </h3>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      💡 Change employee shifts instantly with a single click in the calendar grid.
                    </span>
                  </div>

                  {loading ? (
                    <LoadingBlock label="Loading muster schedules…" />
                  ) : employees.length === 0 ? (
                    <EmptyState title="No matching employees" message="No matching employees found for shift rostering." />
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                      <table className="data-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
                        <thead>
                          <tr>
                            {/* Sticky Employee Name Column */}
                            <th style={{ position: 'sticky', left: 0, background: 'var(--surface-raised)', zIndex: 12, width: '220px', minWidth: '220px', borderRight: '2px solid var(--border-strong)' }}>
                              Employee Detail
                            </th>
                            {activeDays.map(day => (
                              <th key={day.toISOString()} style={{ textAlign: 'center', minWidth: '95px', padding: '0.5rem 0.25rem' }}>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                  {day.toLocaleDateString('en-IN', { weekday: 'short' })}
                                </div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {day.getDate()}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {employees.map(emp => (
                            <tr key={emp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              {/* Sticky Employee Name cell */}
                              <td style={{ position: 'sticky', left: 0, background: 'var(--surface-raised)', zIndex: 10, borderRight: '2px solid var(--border-strong)', padding: '0.75rem' }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.82rem' }}>{emp.firstName} {emp.lastName}</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{emp.jobTitle}</div>
                                <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', background: 'var(--surface-sunken)', padding: '0.1rem 0.35rem', borderRadius: 'var(--radius-xs)' }}>
                                    {emp.location || 'HQ'}
                                  </span>
                                  <span style={{ fontSize: '0.6rem', color: 'var(--payroll-fg)', background: 'var(--payroll-bg)', padding: '0.1rem 0.35rem', borderRadius: 'var(--radius-xs)' }}>
                                    {emp.department?.name || 'Staff'}
                                  </span>
                                </div>
                              </td>

                              {/* 1-Click Interactive Date Cells */}
                              {activeDays.map(day => {
                                const dateStr = day.toISOString().split('T')[0];
                                const currentShiftId = assignmentMap[`${emp.id}_${dateStr}`] || 'GENERAL';
                                const isAssigned = currentShiftId !== 'GENERAL';

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
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--border-subtle)',
                                        cursor: 'pointer',
                                        background: isAssigned ? 'var(--payroll-bg)' : 'var(--surface-sunken)',
                                        color: isAssigned ? 'var(--payroll-fg)' : 'var(--text-secondary)',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <Button variant="ghost" size="sm" onClick={handlePrevRange}>◀ Prev Month</Button>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', minWidth: '160px', textAlign: 'center' }}>
                      {selectedDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                    </span>
                    <Button variant="ghost" size="sm" onClick={handleNextRange}>Next Month ▶</Button>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-secondary)', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} /> Allocation counts visible per active shift
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
                        return <div key={`empty-${idx}`} style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', opacity: 0.4 }} />;
                      }

                      const dateStr = date.toISOString().split('T')[0];
                      const dayAllocations = allocationMap[dateStr] || {};
                      const isToday = new Date().toDateString() === date.toDateString();

                      return (
                        <div
                          key={dateStr}
                          onClick={() => setSelectedCalendarDay(date)}
                          style={{
                            background: isToday ? 'var(--accent-bg, var(--surface-sunken))' : 'var(--surface-sunken)',
                            border: isToday ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            transition: 'border-color var(--motion-base) var(--ease-out)',
                            minHeight: '85px',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = isToday ? 'var(--accent)' : 'var(--border-subtle)')}
                        >
                          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: isToday ? 'var(--accent)' : 'var(--text-primary)', textAlign: 'right' }}>
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
                                    color: 'var(--payroll-fg)',
                                    background: 'var(--payroll-bg)',
                                    padding: '0.1rem 0.25rem',
                                    borderRadius: 'var(--radius-xs)',
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
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
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Configured Shift Schemes</h2>
                  {loading ? (
                    <LoadingBlock label="Loading shift schemes…" />
                  ) : shiftTypes.length === 0 ? (
                    <EmptyState title="No custom shifts defined" message="Create a shift type to start configuring schedules." />
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                      {shiftTypes.map(type => (
                        <div key={type.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>{type.name}</h3>
                            <Badge tone="payroll">{type.startTime} - {type.endTime}</Badge>
                          </div>

                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', paddingBottom: '0.25rem' }}>
                            <span>Shift Allowance:</span>
                            <strong style={{ color: 'var(--success-fg)' }}>INR {type.shiftAllowance || 0} / shift</strong>
                          </div>

                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Weekly Offs:</span>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{type.weeklyOffs || 'Sunday'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Grace Period:</span>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{type.gracePeriod || 15} mins</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Min Work Hours:</span>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{type.minimumWorkHours || 8.0} hrs</span>
                            </div>
                            {((type.startDay && type.endDay && type.startDay !== type.endDay) || (type.startTime > type.endTime)) && (
                              <div style={{ color: 'var(--warning-fg)', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                                🌙 Overnight / Night Shift Setup
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {type.geoRestricted && (
                              <Badge tone="danger">📍 Geofenced ({type.allowedRadiusMeters}m)</Badge>
                            )}
                            {type.ipRestricted && (
                              <Badge tone="info">🌐 IP Restricted</Badge>
                            )}
                            {!type.geoRestricted && !type.ipRestricted && (
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>No boundary restrictions</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Geofence Simulator */}
                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Geofence Check-in Simulator</h2>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Simulate coordinates and IP checks to audit check-in safety bounds</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <TextField label="Latitude" value={simulator.latitude} onChange={v => setSimulator({ ...simulator, latitude: v })} />
                    <TextField label="Longitude" value={simulator.longitude} onChange={v => setSimulator({ ...simulator, longitude: v })} />
                    <TextField label="Client Check-in IP Address" value={simulator.clientIp} onChange={v => setSimulator({ ...simulator, clientIp: v })} />

                    <Button type="button" variant="primary" loading={simulating} onClick={runSimulation} fullWidth>
                      {simulating ? 'Auditing Boundary…' : 'Verify Boundary Constraints'}
                    </Button>
                  </div>

                  {simulationResult && (
                    <Banner
                      tone={simulationResult.allowed ? 'success' : 'danger'}
                      title={simulationResult.allowed ? '✓ Check-in Allowable' : '✕ Boundary Violation'}
                    >
                      {simulationResult.reason}
                    </Banner>
                  )}
                </div>
              </div>
            )}

            {/* ──── TAB 4: ROSTER CHANGE HISTORY & AUDIT LOGS ──── */}
            {activeTab === 'roster_history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Roster Assignment History List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Roster Assignment Change Logs</h2>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Historical tracking of all shift reassignments and overrides</p>
                  </div>
                  <DataTable
                    columns={historyColumns}
                    rows={assignments}
                    loading={loading}
                    rowKey={(ass) => ass.id}
                    emptyTitle="No roster changes"
                    emptyMessage="No historical roster changes recorded."
                  />
                </div>

                {/* Audit Logs Table */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>System Audit Logs</h2>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Real-time transactional audit trail of roster changes and system checks</p>
                  </div>
                  <DataTable
                    columns={auditColumns}
                    rows={auditLogs}
                    loading={loading}
                    rowKey={(log) => log.id}
                    emptyTitle="No audit logs"
                    emptyMessage="No system audit logs found."
                  />
                </div>

              </div>
            )}
          </>
        )}

        {/* ──── DRAWER: CALENDAR DAY DETAIL ──── */}
        <Drawer
          open={!!selectedCalendarDay}
          onClose={closeCalendarDay}
          title={selectedCalendarDay
            ? `Allocations: ${selectedCalendarDay.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`
            : ''}
          width={520}
          footer={<Button variant="ghost" onClick={closeCalendarDay}>Close</Button>}
        >
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 0 }}>List of employees custom-scheduled for this day</p>

          {/* Day-specific Filters */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingBottom: '0.75rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <Select
                value={popupFilterGender}
                onChange={setPopupFilterGender}
                placeholder="Filter Gender…"
                options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]}
              />
            </div>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <Select
                value={popupFilterLocation}
                onChange={setPopupFilterLocation}
                placeholder="Filter Location…"
                options={[
                  { value: 'Mumbai Office', label: 'Mumbai' },
                  { value: 'Bangalore Office', label: 'Bangalore' },
                  { value: 'Pune Office', label: 'Pune' },
                ]}
              />
            </div>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <Select
                value={popupFilterDept}
                onChange={setPopupFilterDept}
                placeholder="Filter Dept…"
                options={departments.map(d => ({ value: d.id, label: d.name }))}
              />
            </div>
          </div>

          {/* Employees List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {dayDetails.length === 0 ? (
              <EmptyState title="No matches" message="No custom-scheduled employees match the active filters on this day." />
            ) : (
              dayDetails.map(ass => (
                <div
                  key={ass.id}
                  className="glass-card"
                  style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
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
                    <Badge tone="payroll">{ass.shiftType.name}</Badge>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      {ass.shiftType.startTime} - {ass.shiftType.endTime}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Drawer>

        {/* Define Type Modal */}
        <Modal
          open={showTypeModal}
          onClose={() => { setShowTypeModal(false); setTypeSubmitted(false); setTypeError(''); }}
          title="Define Shift Type"
          width={480}
          footer={
            <>
              <Button variant="ghost" onClick={() => { setShowTypeModal(false); setTypeSubmitted(false); setTypeError(''); }}>Cancel</Button>
              <Button variant="primary" type="submit" form="shift-type-form">Create Shift</Button>
            </>
          }
        >
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '1rem' }}>Configure schedule bounds and shift allowances</p>

          <form id="shift-type-form" onSubmit={handleCreateType} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {typeError && <Banner tone="danger">{typeError}</Banner>}

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <TextField label="Shift Name" required placeholder="e.g. Night Roster" value={typeForm.name} onChange={v => setTypeForm({ ...typeForm, name: v })} validator={required('Name')} forceError={typeSubmitted} />
              <TextField label="Code" placeholder="e.g. NS01" value={typeForm.code} onChange={v => setTypeForm({ ...typeForm, code: v })} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <TextField label="Start Time" required placeholder="09:00" value={typeForm.startTime} onChange={v => setTypeForm({ ...typeForm, startTime: v })} validator={required('Start time')} forceError={typeSubmitted} />
              <TextField label="End Time" required placeholder="18:00" value={typeForm.endTime} onChange={v => setTypeForm({ ...typeForm, endTime: v })} validator={required('End time')} forceError={typeSubmitted} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Select label="Start Day" value={typeForm.startDay} onChange={v => setTypeForm({ ...typeForm, startDay: v })} options={DAYS.map(d => ({ value: d, label: d }))} />
              <Select label="End Day (Overnight)" value={typeForm.endDay} onChange={v => setTypeForm({ ...typeForm, endDay: v })} options={DAYS.map(d => ({ value: d, label: d }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <TextField label="Allowance" placeholder="200" value={typeForm.shiftAllowance} onChange={v => setTypeForm({ ...typeForm, shiftAllowance: v })} restrict="decimal" forceError={typeSubmitted} />
              <TextField label="Grace (min)" placeholder="15" value={typeForm.gracePeriod} onChange={v => setTypeForm({ ...typeForm, gracePeriod: v })} validator={integer('Grace period')} restrict="digits" forceError={typeSubmitted} />
              <TextField label="Min Hours" placeholder="8.0" value={typeForm.minimumWorkHours} onChange={v => setTypeForm({ ...typeForm, minimumWorkHours: v })} validator={nonNegative('Minimum work hours')} restrict="decimal" forceError={typeSubmitted} />
            </div>

            <TextField label="Weekly Offs (comma separated)" placeholder="Sunday" value={typeForm.weeklyOffs} onChange={v => setTypeForm({ ...typeForm, weeklyOffs: v })} />

            <div style={{ display: 'flex', gap: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
              <Checkbox label="Geofenced Check-in" checked={typeForm.geoRestricted} onChange={v => setTypeForm({ ...typeForm, geoRestricted: v })} />
              <Checkbox label="IP Restricted" checked={typeForm.ipRestricted} onChange={v => setTypeForm({ ...typeForm, ipRestricted: v })} />
            </div>

            {typeForm.geoRestricted && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <TextField label="Lat" value={typeForm.allowedLatitude} onChange={v => setTypeForm({ ...typeForm, allowedLatitude: v })} />
                <TextField label="Lng" value={typeForm.allowedLongitude} onChange={v => setTypeForm({ ...typeForm, allowedLongitude: v })} />
                <TextField label="Radius (m)" value={typeForm.allowedRadiusMeters} onChange={v => setTypeForm({ ...typeForm, allowedRadiusMeters: v })} restrict="digits" />
              </div>
            )}

            {typeForm.ipRestricted && (
              <div style={{ background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <TextField label="Allowed IP Substring (e.g. 192.168.1)" placeholder="192.168.1" value={typeForm.allowedIpRange} onChange={v => setTypeForm({ ...typeForm, allowedIpRange: v })} />
              </div>
            )}
          </form>
        </Modal>

      </main>
    </div>
  );
}
