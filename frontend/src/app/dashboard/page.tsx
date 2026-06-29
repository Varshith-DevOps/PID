'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import { getPersonalizedDashboard } from '@/lib/api';
import {
  PageHeader, Badge, Button, Card, KpiBar, KpiPie,
  EmptyState, ErrorState, Skeleton,
} from '@/components/ui';
import { isOwnerRole } from '@/lib/platformRoles';

const money = (value: number) => `INR ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const shortDate = (value?: string) => {
  if (!value) return 'No date';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

// Maps a semantic "tone" to token-driven foreground/background CSS variables.
const toneToken = (tone: string): { fg: string; bg: string } => {
  if (tone === 'success') return { fg: 'var(--success-fg)', bg: 'var(--success-bg)' };
  if (tone === 'warning') return { fg: 'var(--warning-fg)', bg: 'var(--warning-bg)' };
  if (tone === 'danger') return { fg: 'var(--danger-fg)', bg: 'var(--danger-bg)' };
  if (tone === 'violet') return { fg: 'var(--leave-fg)', bg: 'var(--leave-bg)' };
  return { fg: 'var(--info-fg)', bg: 'var(--info-bg)' };
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
  const [error, setError] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/'); return; }
    // App-owner accounts live in the Admin Portal, not the tenant dashboard.
    if (isOwnerRole(user.role)) router.replace('/platform-admin');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(false);
      const data = await getPersonalizedDashboard();
      setDashboard(data);
    } catch (err) {
      console.error('Failed to load personalized dashboard:', err);
      setError(true);
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
        <style jsx global>{`
          .dashboard-shell { padding: 1.5rem; }
          .dashboard-shell .dash-wrap { max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.1rem; }
          .dashboard-shell .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
          .dashboard-shell .two-col { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr); gap: 1rem; align-items: start; }
          .dashboard-shell .three-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
          .dashboard-shell .list { display: flex; flex-direction: column; gap: 0.55rem; }
          .dashboard-shell .row-card {
            display: flex; justify-content: space-between; gap: 0.75rem; align-items: center;
            padding: 0.72rem 0.85rem;
            border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
            background: var(--surface-sunken);
          }
          .dashboard-shell .row-card:hover { border-color: var(--accent); }
          .dashboard-shell .row-main { min-width: 0; }
          .dashboard-shell .row-title { color: var(--text-primary); font-weight: 700; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .dashboard-shell .row-sub { color: var(--text-muted); font-size: 0.74rem; margin-top: 0.12rem; }
          .dashboard-shell .coach-card {
            background: var(--surface-sunken);
            border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
            padding: 0.95rem 1.05rem;
            transition: border-color var(--motion-base) var(--ease-out);
          }
          .dashboard-shell .coach-card:hover { border-color: var(--accent); }
          .dashboard-shell .quick-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.5rem; }
          @media (max-width: 980px) {
            .dashboard-shell { padding: 1rem; }
            .dashboard-shell .two-col { grid-template-columns: 1fr; }
          }
        `}</style>

        <div className="dash-wrap">
          <PageHeader
            title={getTitle(dashboard, user)}
            subtitle={getSubtitle(dashboard)}
            actions={(
              <>
                <Badge tone="info" dot>{dashboard?.dashboardType || user.role} view</Badge>
                <Button variant="ghost" size="sm" onClick={loadDashboard} loading={loading}>Refresh</Button>
              </>
            )}
          />

          {loading ? (
            <>
              <section className="metric-grid">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}><Skeleton height={18} width="60%" /><Skeleton height={32} width="40%" style={{ marginTop: '0.6rem' }} /></Card>
                ))}
              </section>
              <Card><Skeleton height={250} /></Card>
            </>
          ) : error ? (
            <Card>
              <ErrorState message="We couldn't load your dashboard. Please try again." onRetry={loadDashboard} />
            </Card>
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

function SmartMetric({ label, value, note, tone = 'blue' }: { label: string; value: string | number; note?: string; tone?: string; coach?: string }) {
  return (
    <div className="coach-card">
      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ marginTop: '0.4rem', fontSize: '1.7rem', fontWeight: 800, lineHeight: 1.1, wordBreak: 'break-word', color: toneToken(tone).fg }}>{value}</div>
      {note && <div style={{ marginTop: '0.35rem', color: 'var(--text-muted)', fontSize: '0.74rem' }}>{note}</div>}
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
        <Card title="Weekly attendance and effort">
          {weeklyData.length ? (
            <KpiBar data={weeklyData} xKey="date" bars={[{ key: 'hours', name: 'Hours', color: '#00A7B5' }]} height={250} />
          ) : (
            <EmptyState title="No attendance yet" message="Your weekly hours will appear here once logged." />
          )}
        </Card>

        <Card title="Team availability">
          <AvailabilityList rows={cards.teamAvailability || []} />
        </Card>
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
        <Card title="Individual team insight">
          <div className="list">
            {workload.length ? workload.map((member: any) => {
              const tone = member.health === 'STRONG' ? 'success' : member.health === 'AT_RISK' ? 'danger' : 'warning';
              return (
                <div key={member.id} className="coach-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div className="row-main">
                      <div className="row-title">{member.name}</div>
                      <div className="row-sub">{member.title} | {member.department}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: toneToken(tone).fg, fontWeight: 850 }}>{member.hours}h</div>
                      <div className="row-sub">{member.openTasks} tasks</div>
                    </div>
                  </div>
                </div>
              );
            }) : <EmptyState title="No direct reports" message="Team members will appear here once assigned." />}
          </div>
        </Card>

        <Card title="Team availability today">
          <AvailabilityList rows={cards.teamAvailability || []} />
        </Card>
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
        <Card title="Payroll readiness map">
          <KpiBar
            data={[
              { name: 'Salary', value: payroll.salaryReadiness || 0 },
              { name: 'Bank', value: payroll.bankReadiness || 0 },
              { name: 'Overall', value: focus.payrollReadiness || 0 },
            ]}
            xKey="name"
            bars={[{ key: 'value', name: 'Readiness %', color: '#10b981' }]}
            height={260}
          />
        </Card>

        <PanelList title="Payroll action queue" rows={[
          { title: 'Validate salary structures', sub: `${payroll.salaryReadiness || 0}% complete`, pill: payroll.salaryReadiness >= 95 ? 'Ready' : 'Fix', tone: payroll.salaryReadiness >= 95 ? 'success' : 'danger', coach: 'Every missing salary structure can block accurate payroll calculation.' },
          { title: 'Validate bank details', sub: `${payroll.bankReadiness || 0}% complete`, pill: payroll.bankReadiness >= 95 ? 'Ready' : 'Fix', tone: payroll.bankReadiness >= 95 ? 'success' : 'danger', coach: 'Bank file errors create payment delays. Resolve before payroll approval.' },
          { title: 'Pending reimbursements', sub: `${payroll.pendingReimbursements || 0} claims linked to finance flow`, pill: 'Review', tone: 'warning', coach: 'Approved reimbursements should be matched with payroll or payment run treatment.' },
        ]} empty="No payroll actions." />
      </section>

      <section className="three-col">
        <ChartPanel title="Department headcount" data={departmentData} dataKey="employees" nameKey="name" color="#182B6D" />
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
        <Card title="Workforce by department">
          {departmentData.length ? (
            <KpiBar data={departmentData} xKey="name" bars={[{ key: 'employees', name: 'Employees', color: '#00A7B5' }]} height={260} />
          ) : (
            <EmptyState title="No department data" />
          )}
        </Card>

        <Card title="Recruitment pipeline">
          {recruitmentData.length ? (
            <KpiPie data={recruitmentData} dataKey="count" nameKey="stage" height={260} />
          ) : (
            <EmptyState title="No active recruitment" message="Pipeline stages will appear here once candidates exist." />
          )}
        </Card>
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
  if (!rows.length) return <EmptyState title="No team members to show." />;
  return (
    <div className="list">
      {rows.map((row) => {
        const ok = row.status === 'AVAILABLE' || row.status === 'LATE_ONLINE';
        const tone = row.status === 'ON_LEAVE' ? 'warning' : ok ? 'success' : 'danger';
        const c = toneToken(tone);
        return (
          <div key={row.id} className="row-card">
            <div className="row-main">
              <div className="row-title">{row.name}</div>
              <div className="row-sub">{row.role} | {row.department}</div>
            </div>
            <Badge
              tone={tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'success'}
              dot
              style={{ background: c.bg, color: c.fg }}
            >
              {availabilityLabel[row.status] || row.status}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

function PanelList({ title, rows, empty }: { title: string; rows: any[]; empty: string }) {
  return (
    <Card title={title}>
      <div className="list">
        {rows.length ? rows.map((row, index) => {
          const c = toneToken(row.tone);
          return (
            <div key={`${row.title}-${index}`} className="coach-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                <div className="row-main">
                  <div className="row-title">{row.title}</div>
                  <div className="row-sub">{row.sub}</div>
                </div>
                <Badge
                  tone={row.tone === 'success' ? 'success' : row.tone === 'warning' ? 'warning' : row.tone === 'danger' ? 'danger' : row.tone === 'violet' ? 'leave' : 'info'}
                  style={{ background: c.bg, color: c.fg }}
                >
                  {row.pill}
                </Badge>
              </div>
            </div>
          );
        }) : <EmptyState title={empty} />}
      </div>
    </Card>
  );
}

function ChartPanel({ title, data, dataKey, nameKey, color }: { title: string; data: any[]; dataKey: string; nameKey: string; color?: string }) {
  return (
    <Card title={title}>
      {data.length ? (
        <KpiBar data={data} xKey={nameKey} bars={[{ key: dataKey, color: color || '#182B6D' }]} height={230} />
      ) : (
        <EmptyState title="No data" />
      )}
    </Card>
  );
}

function QuickLinks({ links }: { links: string[][] }) {
  return (
    <Card title="Quick actions">
      <div className="quick-grid">
        {links.map(([label, href]) => (
          <Button key={href} href={href} variant="ghost" size="sm" fullWidth>{label}</Button>
        ))}
      </div>
    </Card>
  );
}
