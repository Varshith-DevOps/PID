const { renderOfferLetterHtml } = require('../src/templates/offerLetterTemplate');

describe('Offer letter template', () => {
  it('omits the offer-expiry clause when no offer expiry date is set', () => {
    const html = renderOfferLetterHtml({
      offer: {
        offeredCtc: 1200000,
        offeredSalary: 1200000,
        joiningDate: '2099-08-01',
        offerExpiryDate: null,
      },
      applicant: { fullName: 'Template Candidate', email: 'template@example.com', phone: '9000000012' },
      job: { title: 'Template Role', location: 'Bengaluru', employmentType: 'FULL_TIME', department: { name: 'Engineering' } },
      company: { name: 'PID HCMS' },
    });

    expect(html).not.toContain('This offer is valid until');
    expect(html).not.toContain('Invalid Date');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
  });

  it('renders the offer-expiry clause when an offer expiry date is set', () => {
    const html = renderOfferLetterHtml({
      offer: {
        offeredCtc: 1200000,
        offeredSalary: 1200000,
        joiningDate: '2099-08-01',
        offerExpiryDate: '2099-07-25',
      },
      applicant: { fullName: 'Template Candidate', email: 'template@example.com', phone: '9000000012' },
      job: { title: 'Template Role', location: 'Bengaluru', employmentType: 'FULL_TIME', department: { name: 'Engineering' } },
      company: { name: 'PID HCMS' },
    });

    expect(html).toContain('This offer is valid until');
    expect(html).toContain('25 July 2099');
  });
});
