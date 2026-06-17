'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import { getPersonalizedDashboard } from '@/lib/api';

const money = (value: number) => `INR ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const shortDate = (value?: string) => {
  if (!value) return 'No date';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const toneColor = (tone: string) => {
  if (tone === 'success') return '#10b981';
  if (tone === 'warning') return '#f59e0b';
  if (tone === 'danger') return '#ef4444';
  if (tone === 'violet') return '#8b5cf6';
  return '#3b82f6';
};

const availabilityLabel: Record<string, string> = {
  AVAILABLE: 'Available',
  LATE_ONLINE: 'Late, online',
  ON_LEAVE: 'On leave',
  SIGNED_OUT: 'Signed out',
  NOT_CHECKED_IN: 'Not checked in',
};

const coaching = {
  attendanceGood: 'Great consistency today. Keep the rhythm steady and acknowledge the team for showing up on time.',
  attendanceLow: 'Attendance needs attention. Check leave coverage, late arrivals, and whether managers need to follow up.',
  employeeHoursGood: 'You are pacing well this week. Nice work keeping your contribution visible through logged hours.',
  employeeHoursLow: 'A small improvement is available here. Log project time daily so your effort is easy to recognize.',
  tasksGood: 'Task load looks healthy. Keep closing work in small batches and update project status before handoff.',
  tasksHigh: 'You have a heavy task queue. Reconfirm priorities with your manager and move blocked items out of the way.',
  payrollGood: 'Payroll readiness is strong. Keep bank, salary, and statutory inputs locked before processing.',
  payrollRisk: 'Payroll needs cleanup before closure. Focus on salary structures, bank details, and pending reimbursements.',
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await getPersonalizedDashboard();
      setDashboard(data);
    } catch (err) {
      console.error('Failed to load personalized dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const departmentData = useMemo(() => dashboard?.cards?.departments || [], [dashboard]);
  const recruitmentData = useMemo(() => dashboard?.cards?.recruitment || [], [dashboard]);
  const availabilityData = useMemo(() => dashboard?.cards?.teamAvailability || [], [dashboard]);

  if (authLoading || !user) {
    return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content dashboard-shell">
        <style jsx>{`
          .dashboard-shell { padding: 1.5rem; }
          .dash-wrap { max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem; }
          .dash-hero {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 1rem;
            align-items: stretch;
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.82));
            border: 1px solid rgba(148, 163, 184, 0.18);
            border-radius: 8px;
            padding: 1.2rem;
          }
          .dash-title { margin: 0; color: white; font-size: 1.55rem; line-height: 1.2; font-weight: 850; letter-spacing: 0; }
          .dash-subtitle { margin: 0.35rem 0 0; color: var(--text-secondary); font-size: 0.82rem; max-width: 760px; }
          .dash-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; justify-content: flex-end; }
          .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0.8rem; }
          .coach-card {
            position: relative;
            background: rgba(15, 23, 42, 0.78);
            border: 1px solid rgba(148, 163, 184, 0.16);
            border-radius: 8px;
            padding: 1rem;
            min-height: 120px;
            transition: border-color 0.18s ease, transform 0.18s ease, background 0.18s ease;
          }
          .coach-card:hover { transform: translateY(-2px); border-color: rgba(96, 165, 250, 0.55); background: rgba(15, 23, 42, 0.94); }
          .coach-tip {
            position: absolute;
            left: 0.75rem;
            right: 0.75rem;
            bottom: calc(100% + 0.5rem);
            opacity: 0;
            pointer-events: none;
            transform: translateY(6px);
            transition: opacity 0.18s ease, transform 0.18s ease;
            background: #0f172a;
            border: 1px solid rgba(96, 165, 250, 0.38);
            border-radius: 8px;
            padding: 0.7rem;
            color: rgba(255, 255, 255, 0.9);
            font-size: 0.74rem;
            line-height: 1.45;
            z-index: 20;
            box-shadow: 0 14px 38px rgba(0, 0, 0, 0.36);
          }
          .coach-card:hover .coach-tip { opacity: 1; transform: translateY(0); }
          .metric-label { color: var(--text-secondary); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0; font-weight: 750; }
          .metric-value { margin-top: 0.35rem; font-size: 1.65rem; color: white; font-weight: 850; line-height: 1.1; word-break: break-word; }
          .metric-note { margin-top: 0.35rem; color: var(--text-muted); font-size: 0.72rem; }
          .panel {
            background: rgba(15, 23, 42, 0.72);
            border: 1px solid rgba(148, 163, 184, 0.16);
            border-radius: 8px;
            padding: 1rem;
            min-width: 0;
          }
          .panel-title { color: white; font-size: 0.98rem; font-weight: 800; margin: 0 0 0.75rem; }
          .two-col { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr); gap: 1rem; align-items: start; }
          .three-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
          .list { display: flex; flex-direction: column; gap: 0.55rem; }
          .row-card {
            position: relative;
            display: flex;
            justify-content: space-between;
            gap: 0.75rem;
            align-items: center;
            padding: 0.72rem;
            border: 1px solid rgba(148, 163, 184, 0.12);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.025);
          }
          .row-card:hover { border-color: rgba(96, 165, 250, 0.42); }
          .row-main { min-width: 0; }
          .row-title { color: white; font-weight: 750; font-size: 0.82rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .row-sub { color: var(--text-muted); font-size: 0.72rem; margin-top: 0.12rem; }
          .pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 0.22rem 0.5rem; font-size: 0.67rem; font-weight: 800; white-space: nowrap; }
          .quick-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.5rem; }
          .quick-link {
            color: white;
            border: 1px solid rgba(148, 163, 184, 0.14);
            background: rgba(255,255,255,0.03);
            border-radius: 8px;
            padding: 0.65rem;
            font-size: 0.76rem;
            font-weight: 750;
            text-align: center;
          }
          .quick-link:hover { border-color: rgba(96, 165, 250, 0.5); background: rgba(37, 99, 235, 0.12); }
          .empty { color: var(--text-muted); font-size: 0.76rem; padding: 1rem; text-align: center; border: 1px dashed rgba(148,163,184,0.2); border-radius: 8px; }
          @media (max-width: 980px) {
            .dashboard-shell { padding: 1rem; }
            .dash-hero, .two-col { grid-template-columns: 1fr; }
            .dash-actions { justify-content: flex-start; }
          }
        `}</style>

        <div className="dash-wrap">
          <header className="dash-hero">
            <div>
              <h1 className="dash-title">{getTitle(dashboard, user)}</h1>
              <p className="dash-subtitle">{getSubtitle(dashboard)}</p>
            </div>
            <div className="dash-actions">
              <span className="pill" style={{ background: 'rgba(59,130,246,0.14)', color: '#93c5fd' }}>
                {dashboard?.dashboardType || user.role} view
              </span>
              <button className="btn btn-neutral btn-sm" onClick={loadDashboard}>Refresh</button>
            </div>
          </header>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <div className="loading-spinner" />
            </div>
          ) : dashboard?.dashboardType === 'EMPLOYEE' ? (
            <EmployeeDashboardView dashboard={dashboard} />
          ) : dashboard?.dashboardType === 'MANAGER' ? (
            <ManagerDashboardView dashboard={dashboard} />
          ) : dashboard?.dashboardType === 'PAYROLL' ? (
            <PayrollDashboardView dashboard={dashboard} departmentData={departmentData} />
          ) : (
            <AdminHrDashboardView dashboard={dashboard} departmentData={departmentData} recruitmentData={recruitmentData} availabilityData={availabilityData} />
          )}
        </div>
      </main>
    </div>
  );
}

function getTitle(dashboard: any, user: any) {
  const name = dashboard?.user?.name || user?.name || 'there';
  if (dashboard?.dashboardType === 'EMPLOYEE') return `Welcome back, ${name}`;
  if (dashboard?.dashboardType === 'MANAGER') return `${name}'s team command center`;
  if (dashboard?.dashboardType === 'PAYROLL') return 'Payroll control room';
  if (dashboard?.dashboardType === 'HR') return 'HR people operations cockpit';
  return 'Admin executive dashboard';
}

function getSubtitle(dashboard: any) {
  if (dashboard?.dashboardType === 'EMPLOYEE') return 'Attendance, leave balance, assigned work, team availability, birthdays, and project progress in one focused view.';
  if (dashboard?.dashboardType === 'MANAGER') return 'Team availability, individual workload, pending approvals, and task risk with hover insights for each person.';
  if (dashboard?.dashboardType === 'PAYROLL') return 'Payroll readiness, current run status, statutory inputs, and finance blockers for the payroll team.';
  if (dashboard?.dashboardType === 'HR') return 'Workforce health, hiring movement, people availability, leave pressure, and employee lifecycle signals.';
  return 'Organization health, attendance, payroll, recruitment, projects, and governance signals for fast decisions.';
}

function SmartMetric({ label, value, note, tone = 'blue', coach }: { label: string; value: string | number; note?: string; tone?: string; coach: string }) {
  return (
    <div className="coach-card">
      <div className="coach-tip">{coach}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: toneColor(tone) }}>{value}</div>
      {note && <div className="metric-note">{note}</div>}
    </div>
  );
}

function EmployeeDashboardView({ dashboard }: { dashboard: any }) {
  const focus = dashboard.focus || {};
  const cards = dashboard.cards || {};
  const weeklyData = (cards.attendanceHistory || []).slice().reverse().map((row: any) => ({
    date: shortDate(row.date),
    hours: row.workHours || 0,
  }));

  const taskCoach = focus.assignedTasks <= 5 ? coaching.tasksGood : coaching.tasksHigh;
  const hoursCoach = focus.weeklyHours >= 32 ? coaching.employeeHoursGood : coaching.employeeHoursLow;

  return (
    <>
      <section className="metric-grid">
        <SmartMetric label="Today attendance" value={focus.attendanceStatus || 'ABSENT'} tone={focus.attendanceStatus === 'PRESENT' ? 'success' : 'warning'} note={focus.checkIn ? `Checked in ${new Date(focus.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'No check-in yet'} coach={focus.attendanceStatus === 'PRESENT' ? 'Great start today. Keep your checkout clean so payroll and attendance stay accurate.' : 'You still have a chance to recover the day. Check in, regularize if needed, and keep your manager informed.'} />
        <SmartMetric label="This week hours" value={`${focus.weeklyHours || 0}h`} tone={focus.weeklyHours >= 32 ? 'success' : 'warning'} note="Timesheet based contribution" coach={hoursCoach} />
        <SmartMetric label="Leave balance" value={`${focus.leaveBalance || 0} days`} tone={focus.leaveBalance > 5 ? 'blue' : 'warning'} note="Available quota across leave types" coach={focus.leaveBalance > 5 ? 'You have a healthy leave balance. Plan time off early so the team can cover smoothly.' : 'Your leave balance is getting tight. Check future plans before applying for longer breaks.'} />
        <SmartMetric label="Assigned work" value={focus.assignedTasks || 0} tone={focus.assignedTasks <= 5 ? 'success' : 'danger'} note={`${focus.pendingTasks || 0} open tasks`} coach={taskCoach} />
      </section>

      <section className="two-col">
        <div className="panel">
          <h2 className="panel-title">Weekly attendance and effort</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(148,163,184,0.25)' }} />
              <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h2 className="panel-title">Team availability</h2>
          <AvailabilityList rows={cards.teamAvailability || []} />
        </div>
      </section>

      <section className="three-col">
        <PanelList title="Assigned project status" rows={(cards.projects || []).map((project: any) => ({
          title: project.name,
          sub: `${project.progress}% complete | ${project.openTasks} open tasks`,
          pill: project.status,
          tone: project.progress >= 70 ? 'success' : 'warning',
          coach: project.progress >= 70 ? 'This project is moving well. Keep status updates crisp so stakeholders stay confident.' : 'This project needs visible progress. Close small tasks first and flag dependencies early.',
        }))} empty="No active project allocations." />
        <PanelList title="Tasks needing attention" rows={(cards.tasks || []).map((task: any) => ({
          title: task.title,
          sub: `${task.project} | Due ${shortDate(task.deadline)}`,
          pill: task.status.replaceAll('_', ' '),
          tone: task.status === 'COMPLETED' ? 'success' : 'blue',
          coach: task.actualHours >= task.estimatedHours && task.estimatedHours > 0 ? 'This task may exceed estimate. Add a note so expectations stay aligned.' : 'Good task hygiene. Update status as soon as progress changes.',
        }))} empty="No active tasks assigned." />
        <PanelList title="Birthdays nearby" rows={(cards.birthdays || []).map((person: any) => ({
          title: person.name,
          sub: person.department,
          pill: person.dayLabel,
          tone: 'violet',
          coach: 'A thoughtful birthday note is a small culture win. HRMS can help people feel remembered.',
        }))} empty="No birthdays in the next 30 days." />
      </section>
    </>
  );
}

function ManagerDashboardView({ dashboard }: { dashboard: any }) {
  const focus = dashboard.focus || {};
  const cards = dashboard.cards || {};
  const workload = cards.workload || [];

  return (
    <>
      <section className="metric-grid">
        <SmartMetric label="Team size" value={focus.teamSize || 0} tone="blue" note="Direct reports" coach="Your team map is the starting point. Hover individual cards below to see workload and follow-up suggestions." />
        <SmartMetric label="Available now" value={`${focus.teamAvailability || 0}%`} tone={focus.teamAvailability >= 75 ? 'success' : 'warning'} note="Checked-in team members" coach={focus.teamAvailability >= 75 ? coaching.attendanceGood : coaching.attendanceLow} />
        <SmartMetric label="Open team tasks" value={focus.openTeamTasks || 0} tone={focus.openTeamTasks <= 12 ? 'success' : 'danger'} note="Across direct reports" coach={focus.openTeamTasks <= 12 ? 'Team task volume is manageable. Keep blockers visible and protect focus time.' : 'Task load is high. Rebalance assignments and clarify the top three priorities today.'} />
        <SmartMetric label="Pending approvals" value={(focus.pendingTeamLeaves || 0) + (focus.pendingOvertime || 0)} tone="warning" note="Leaves plus overtime" coach="Approvals are employee experience moments. Clear them quickly so payroll and planning stay accurate." />
      </section>

      <section className="two-col">
        <div className="panel">
          <h2 className="panel-title">Individual team insight</h2>
          <div className="list">
            {workload.length ? workload.map((member: any) => (
              <div key={member.id} className="coach-card" style={{ minHeight: '86px' }}>
                <div className="coach-tip">{member.health === 'STRONG' ? `${member.name} is meeting expectations. Recognize the consistency and keep priorities clear.` : member.health === 'AT_RISK' ? `${member.name} may be overloaded. Review deadlines, split work, or remove blockers.` : member.health === 'UNDER_UTILIZED' ? `${member.name} has capacity. Assign meaningful work or verify timesheets are current.` : `${member.name} is steady. A quick check-in can keep momentum clean.`}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div className="row-main">
                    <div className="row-title">{member.name}</div>
                    <div className="row-sub">{member.title} | {member.department}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: toneColor(member.health === 'STRONG' ? 'success' : member.health === 'AT_RISK' ? 'danger' : 'warning'), fontWeight: 850 }}>{member.hours}h</div>
                    <div className="row-sub">{member.openTasks} tasks</div>
                  </div>
                </div>
              </div>
            )) : <div className="empty">No direct reports found.</div>}
          </div>
        </div>

        <div className="panel">
          <h2 className="panel-title">Team availability today</h2>
          <AvailabilityList rows={cards.teamAvailability || []} />
        </div>
      </section>

      <section className="three-col">
        <PanelList title="Task risk queue" rows={(cards.teamTasks || []).map((task: any) => ({
          title: task.title,
          sub: `${task.assignee} | ${task.project} | Due ${shortDate(task.deadline)}`,
          pill: task.status.replaceAll('_', ' '),
          tone: task.status === 'IN_PROGRESS' ? 'blue' : 'warning',
          coach: `Hover insight: ${task.assignee} owns this task. Confirm the next update before ${shortDate(task.deadline)}.`,
        }))} empty="No team tasks at risk." />
        <PanelList title="Leave requests" rows={(cards.pendingLeaves || []).map((leave: any) => ({
          title: leave.employee,
          sub: `${shortDate(leave.startDate)} to ${shortDate(leave.endDate)} | ${leave.days} days`,
          pill: leave.leaveType,
          tone: 'warning',
          coach: 'Review team coverage before approving. Fast approval improves trust and planning accuracy.',
        }))} empty="No pending team leave requests." />
        <PanelList title="Upcoming birthdays" rows={(cards.birthdays || []).map((person: any) => ({
          title: person.name,
          sub: person.department,
          pill: person.dayLabel,
          tone: 'violet',
          coach: 'A quick manager note here can do more for morale than a long meeting.',
        }))} empty="No birthdays in the next 30 days." />
      </section>
    </>
  );
}

function PayrollDashboardView({ dashboard, departmentData }: { dashboard: any; departmentData: any[] }) {
  const payroll = dashboard.payroll || {};
  const focus = dashboard.focus || {};

  return (
    <>
      <section className="metric-grid">
        <SmartMetric label="Payroll status" value={payroll.status || 'NOT_RUN'} tone={payroll.status === 'APPROVED' || payroll.status === 'COMPLETED' ? 'success' : 'warning'} note={`${payroll.employeeCount || 0} records in latest run`} coach={payroll.status === 'NOT_RUN' ? 'Payroll has not run for the selected period. Complete readiness checks before generating salary.' : 'Payroll exists. Validate exceptions before approving or processing.'} />
        <SmartMetric label="Net salary" value={money(payroll.net || 0)} tone="blue" note="Latest/current run" coach="Net salary should reconcile with bank advice, payslips, and statutory deductions before release." />
        <SmartMetric label="Salary readiness" value={`${payroll.salaryReadiness || 0}%`} tone={payroll.salaryReadiness >= 95 ? 'success' : 'danger'} note="Active employees with structures" coach={payroll.salaryReadiness >= 95 ? coaching.payrollGood : coaching.payrollRisk} />
        <SmartMetric label="Bank readiness" value={`${payroll.bankReadiness || 0}%`} tone={payroll.bankReadiness >= 95 ? 'success' : 'danger'} note="Active employees with bank details" coach={payroll.bankReadiness >= 95 ? 'Bank master readiness is strong. Keep account updates audit logged.' : 'Bank details are incomplete. Fix before generating payment files.'} />
      </section>

      <section className="two-col">
        <div className="panel">
          <h2 className="panel-title">Payroll readiness map</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={[
              { name: 'Salary', value: payroll.salaryReadiness || 0 },
              { name: 'Bank', value: payroll.bankReadiness || 0 },
              { name: 'Overall', value: focus.payrollReadiness || 0 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(148,163,184,0.25)' }} />
              <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <PanelList title="Payroll action queue" rows={[
          { title: 'Validate salary structures', sub: `${payroll.salaryReadiness || 0}% complete`, pill: payroll.salaryReadiness >= 95 ? 'Ready' : 'Fix', tone: payroll.salaryReadiness >= 95 ? 'success' : 'danger', coach: 'Every missing salary structure can block accurate payroll calculation.' },
          { title: 'Validate bank details', sub: `${payroll.bankReadiness || 0}% complete`, pill: payroll.bankReadiness >= 95 ? 'Ready' : 'Fix', tone: payroll.bankReadiness >= 95 ? 'success' : 'danger', coach: 'Bank file errors create payment delays. Resolve before payroll approval.' },
          { title: 'Pending reimbursements', sub: `${payroll.pendingReimbursements || 0} claims linked to finance flow`, pill: 'Review', tone: 'warning', coach: 'Approved reimbursements should be matched with payroll or payment run treatment.' },
        ]} empty="No payroll actions." />
      </section>

      <section className="three-col">
        <ChartPanel title="Department headcount" data={departmentData} dataKey="employees" nameKey="name" />
        <QuickLinks links={[['Payroll', '/payroll'], ['Payslips', '/payslips'], ['Reports', '/dashboard/admin/reports'], ['Employees', '/employees']]} />
        <PanelList title="Upcoming birthdays" rows={(dashboard.cards?.birthdays || []).map((person: any) => ({ title: person.name, sub: person.department, pill: person.dayLabel, tone: 'violet', coach: 'Payroll teams can help HR spot lifecycle events and communication moments.' }))} empty="No birthdays nearby." />
      </section>
    </>
  );
}

function AdminHrDashboardView({ dashboard, departmentData, recruitmentData }: { dashboard: any; departmentData: any[]; recruitmentData: any[]; availabilityData: any[] }) {
  const org = dashboard.organization || {};
  const focus = dashboard.focus || {};

  return (
    <>
      <section className="metric-grid">
        <SmartMetric label="Attendance rate" value={`${org.attendanceRate || 0}%`} tone={org.attendanceRate >= 85 ? 'success' : 'warning'} note={`${org.presentToday || 0}/${org.activeEmployees || 0} present today`} coach={org.attendanceRate >= 85 ? coaching.attendanceGood : coaching.attendanceLow} />
        <SmartMetric label="Pending leaves" value={focus.pendingLeaves || 0} tone={focus.pendingLeaves === 0 ? 'success' : 'warning'} note="Awaiting approval" coach={focus.pendingLeaves === 0 ? 'Leave approvals are clean. Nice operational discipline.' : 'Pending leave approvals affect payroll, staffing, and employee trust. Clear the queue today.'} />
        <SmartMetric label="Active projects" value={focus.activeProjects || 0} tone="blue" note={`${focus.openTasks || 0} open tasks`} coach="Project and people data are connected. Watch workload before it becomes attrition risk." />
        <SmartMetric label="Payroll readiness" value={`${focus.payrollReadiness || 0}%`} tone={focus.payrollReadiness >= 95 ? 'success' : 'danger'} note={dashboard.payroll?.status || 'NOT_RUN'} coach={focus.payrollReadiness >= 95 ? coaching.payrollGood : coaching.payrollRisk} />
      </section>

      <section className="two-col">
        <div className="panel">
          <h2 className="panel-title">Workforce by department</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={departmentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(148,163,184,0.25)' }} />
              <Bar dataKey="employees" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h2 className="panel-title">Recruitment pipeline</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={recruitmentData} dataKey="count" nameKey="stage" innerRadius={58} outerRadius={88}>
                {recruitmentData.map((_: any, index: number) => <Cell key={index} fill={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][index % 5]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(148,163,184,0.25)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="three-col">
        <PanelList title="Recent hires" rows={(dashboard.cards?.recentHires || []).map((hire: any) => ({
          title: hire.name,
          sub: `${hire.title} | ${hire.department}`,
          pill: shortDate(hire.joinDate),
          tone: 'success',
          coach: 'New hire experience is fragile. Check onboarding progress and manager connection.',
        }))} empty="No recent hires found." />
        <PanelList title="Upcoming birthdays" rows={(dashboard.cards?.birthdays || []).map((person: any) => ({
          title: person.name,
          sub: person.department,
          pill: person.dayLabel,
          tone: 'violet',
          coach: 'Recognition moments improve belonging. A small note from HR or leadership lands well.',
        }))} empty="No birthdays in the next 30 days." />
        <QuickLinks links={[['Employees', '/employees'], ['Attendance', '/attendance'], ['Leave', '/leave'], ['Payroll', '/payroll'], ['Audit Center', '/dashboard/admin/reports'], ['Projects', '/projects']]} />
      </section>
    </>
  );
}

function AvailabilityList({ rows }: { rows: any[] }) {
  if (!rows.length) return <div className="empty">No team members to show.</div>;
  return (
    <div className="list">
      {rows.map((row) => {
        const ok = row.status === 'AVAILABLE' || row.status === 'LATE_ONLINE';
        const tone = row.status === 'ON_LEAVE' ? 'warning' : ok ? 'success' : 'danger';
        return (
          <div key={row.id} className="row-card">
            <div className="row-main">
              <div className="row-title">{row.name}</div>
              <div className="row-sub">{row.role} | {row.department}</div>
            </div>
            <span className="pill" style={{ background: `${toneColor(tone)}22`, color: toneColor(tone) }}>
              {availabilityLabel[row.status] || row.status}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PanelList({ title, rows, empty }: { title: string; rows: any[]; empty: string }) {
  return (
    <div className="panel">
      <h2 className="panel-title">{title}</h2>
      <div className="list">
        {rows.length ? rows.map((row, index) => (
          <div key={`${row.title}-${index}`} className="coach-card" style={{ minHeight: '86px' }}>
            <div className="coach-tip">{row.coach}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
              <div className="row-main">
                <div className="row-title">{row.title}</div>
                <div className="row-sub">{row.sub}</div>
              </div>
              <span className="pill" style={{ background: `${toneColor(row.tone)}22`, color: toneColor(row.tone) }}>{row.pill}</span>
            </div>
          </div>
        )) : <div className="empty">{empty}</div>}
      </div>
    </div>
  );
}

function ChartPanel({ title, data, dataKey, nameKey }: { title: string; data: any[]; dataKey: string; nameKey: string }) {
  return (
    <div className="panel">
      <h2 className="panel-title">{title}</h2>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
          <XAxis dataKey={nameKey} tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(148,163,184,0.25)' }} />
          <Bar dataKey={dataKey} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function QuickLinks({ links }: { links: string[][] }) {
  return (
    <div className="panel">
      <h2 className="panel-title">Quick actions</h2>
      <div className="quick-grid">
        {links.map(([label, href]) => (
          <Link key={href} className="quick-link" href={href}>{label}</Link>
        ))}
      </div>
    </div>
  );
}
