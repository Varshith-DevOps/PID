'use client';
import InlineField from '@/components/InlineField';
import { required } from '@/lib/validators';

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

      <h3 style={{ fontSize: '1rem', marginTop: '2rem', marginBottom: '1rem', color: 'var(--accent-cyan)' }}>Experience History</h3>
      {employee.experience?.length > 0 ? (
        <table className="data-table">
          <thead><tr><th>Company</th><th>Designation</th><th>From</th><th>To</th></tr></thead>
          <tbody>
            {employee.experience.map((exp: any) => (
              <tr key={exp.id}>
                <td>{exp.company}</td><td>{exp.designation}</td>
                <td>{new Date(exp.fromDate).toLocaleDateString()}</td>
                <td>{exp.toDate ? new Date(exp.toDate).toLocaleDateString() : 'Present'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p style={{ color: 'var(--text-muted)' }}>No experience records found.</p>}

      <h3 style={{ fontSize: '1rem', marginTop: '2rem', marginBottom: '1rem', color: 'var(--accent-cyan)' }}>Education</h3>
      {employee.education?.length > 0 ? (
        <table className="data-table">
          <thead><tr><th>Degree</th><th>Institution</th><th>Year</th><th>%</th></tr></thead>
          <tbody>
            {employee.education.map((edu: any) => (
              <tr key={edu.id}>
                <td>{edu.degree} {edu.specialization && `(${edu.specialization})`}</td>
                <td>{edu.institution}</td><td>{edu.yearOfPassing}</td><td>{edu.percentage || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p style={{ color: 'var(--text-muted)' }}>No education records found.</p>}
    </div>
  );
}
