'use client';
import InlineField from '@/components/InlineField';

export default function PersonalTab({ employee, canEdit, onSave, shouldMask }: any) {
  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Personal Information
        </h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 2rem' }}>
        <InlineField label="First Name" value={employee.firstName} fieldKey="firstName" canEdit={canEdit} onSave={onSave} />
        <InlineField label="Last Name" value={employee.lastName} fieldKey="lastName" canEdit={canEdit} onSave={onSave} />
        <InlineField label="Email" value={employee.email} fieldKey="email" canEdit={canEdit} onSave={onSave} masked={shouldMask} maskType="email" />
        <InlineField label="Phone" value={employee.phone} fieldKey="phone" canEdit={canEdit} onSave={onSave} masked={shouldMask} maskType="phone" />
        <InlineField label="Date of Birth" value={employee.dateOfBirth?.split('T')[0] || ''} fieldKey="dateOfBirth" canEdit={canEdit} onSave={onSave} type="date" />
        <InlineField label="Gender" value={employee.gender} fieldKey="gender" canEdit={canEdit} onSave={onSave} />
        <InlineField label="Blood Group" value={employee.bloodGroup} fieldKey="bloodGroup" canEdit={canEdit} onSave={onSave} />
        <InlineField label="Marital Status" value={employee.maritalStatus} fieldKey="maritalStatus" canEdit={canEdit} onSave={onSave} />
        <InlineField label="Nationality" value={employee.nationality} fieldKey="nationality" canEdit={canEdit} onSave={onSave} />
        <InlineField label="Personal Email" value={employee.personalEmail} fieldKey="personalEmail" canEdit={canEdit} onSave={onSave} />
        <InlineField label="PAN Number" value={employee.panNumber} fieldKey="panNumber" canEdit={canEdit} onSave={onSave} masked={shouldMask} maskType="pan" />
        <InlineField label="Aadhar Number" value={employee.aadharNumber} fieldKey="aadharNumber" canEdit={canEdit} onSave={onSave} masked={shouldMask} maskType="aadhar" />
      </div>

      <h3 style={{ fontSize: '1rem', marginTop: '2rem', marginBottom: '1rem', color: 'var(--accent-cyan)' }}>Emergency Contact</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 2rem' }}>
        <InlineField label="Contact Name" value={employee.emergencyContactName} fieldKey="emergencyContactName" canEdit={canEdit} onSave={onSave} />
        <InlineField label="Relation" value={employee.emergencyContactRelation} fieldKey="emergencyContactRelation" canEdit={canEdit} onSave={onSave} />
        <InlineField label="Contact Phone" value={employee.emergencyContactPhone} fieldKey="emergencyContactPhone" canEdit={canEdit} onSave={onSave} masked={shouldMask} maskType="phone" />
      </div>
    </div>
  );
}
