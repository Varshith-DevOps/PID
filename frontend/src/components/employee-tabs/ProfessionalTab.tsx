'use client';
import InlineField from '@/components/InlineField';
import { required } from '@/lib/validators';
import { DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';

const experienceColumns: Column<any>[] = [
  { key: 'company', header: 'Company' },
  { key: 'designation', header: 'Designation' },
  { key: 'fromDate', header: 'From', render: (exp) => new Date(exp.fromDate).toLocaleDateString() },
  { key: 'toDate', header: 'To', render: (exp) => (exp.toDate ? new Date(exp.toDate).toLocaleDateString() : 'Present') },
];

const educationColumns: Column<any>[] = [
  { key: 'degree', header: 'Degree', render: (edu) => <>{edu.degree} {edu.specialization && `(${edu.specialization})`}</> },
  { key: 'institution', header: 'Institution' },
  { key: 'yearOfPassing', header: 'Year' },
  { key: 'percentage', header: '%', render: (edu) => edu.percentage || '-' },
];

export default function ProfessionalTab({ employee, canEdit, onSave }: any) {
  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          Professional Information
        </h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 2rem' }}>
        <InlineField label="Employee ID" value={employee.employeeId} fieldKey="employeeId" canEdit={false} onSave={onSave} />
        <InlineField label="Job Title" value={employee.jobTitle} fieldKey="jobTitle" canEdit={canEdit} onSave={onSave} validator={required('Job title')} />
        <InlineField label="Department" value={employee.department?.name} fieldKey="department" canEdit={false} onSave={onSave} />
        <InlineField label="Manager" value={employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : 'None'} fieldKey="manager" canEdit={false} onSave={onSave} />
        <InlineField label="Join Date" value={employee.joinDate?.split('T')[0] || ''} fieldKey="joinDate" canEdit={canEdit} onSave={onSave} type="date" />
        <InlineField label="Employment Type" value={employee.employmentType} fieldKey="employmentType" canEdit={canEdit} onSave={onSave} />
        <InlineField label="Account Stage" value={employee.accountStage} fieldKey="accountStage" canEdit={false} onSave={onSave} />
      </div>

      <h3 style={{ fontSize: '1rem', marginTop: '2rem', marginBottom: '1rem', color: 'var(--accent)' }}>Experience History</h3>
      <DataTable columns={experienceColumns} rows={employee.experience || []} rowKey={(exp) => exp.id} emptyTitle="No experience records found" />

      <h3 style={{ fontSize: '1rem', marginTop: '2rem', marginBottom: '1rem', color: 'var(--accent)' }}>Education</h3>
      <DataTable columns={educationColumns} rows={employee.education || []} rowKey={(edu) => edu.id} emptyTitle="No education records found" />
    </div>
  );
}
