const prisma = require('../config/database');

/**
 * Update company customization details (logo, customInfo) and submit/update KYC details.
 * PUT /api/platform/organization/company
 */
const updateCompanyCustomizationAndKYC = async (req, res) => {
  try {
    const { companyId } = req.user;
    if (!companyId) {
      return res.status(400).json({ error: 'User is not associated with any company.' });
    }

    const {
      logoUrl,
      customInfo,
      cin,
      gstin,
      directorName,
      directorPan,
      directorDin,
      signingAuthorityName,
      signingAuthorityEmail,
      signingAuthorityPhone,
      contactPersonName,
      contactPersonEmail,
      contactPersonPhone,
      demoCallDate
    } = req.body;

    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    // Prepare update data
    const updateData = {};
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (customInfo !== undefined) updateData.customInfo = customInfo;
    if (cin !== undefined) updateData.cin = cin;
    if (gstin !== undefined) updateData.gstin = gstin;
    if (directorName !== undefined) updateData.directorName = directorName;
    if (directorPan !== undefined) updateData.directorPan = directorPan;
    if (directorDin !== undefined) updateData.directorDin = directorDin;
    if (signingAuthorityName !== undefined) updateData.signingAuthorityName = signingAuthorityName;
    if (signingAuthorityEmail !== undefined) updateData.signingAuthorityEmail = signingAuthorityEmail;
    if (signingAuthorityPhone !== undefined) updateData.signingAuthorityPhone = signingAuthorityPhone;
    if (contactPersonName !== undefined) updateData.contactPersonName = contactPersonName;
    if (contactPersonEmail !== undefined) updateData.contactPersonEmail = contactPersonEmail;
    if (contactPersonPhone !== undefined) updateData.contactPersonPhone = contactPersonPhone;
    if (demoCallDate !== undefined) updateData.demoCallScheduledAt = new Date(demoCallDate);

    // Resubmitting KYC details after a rejection or an info request moves the
    // company back into the review queue (PENDING) and clears the reviewer note.
    if (company.kycStatus === 'REJECTED' || company.kycStatus === 'NEEDS_INFO') {
      updateData.kycStatus = 'PENDING';
      updateData.kycRemarks = null;
    }

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: updateData
    });

    res.json({
      message: 'Company settings updated successfully',
      company: {
        id: updatedCompany.id,
        name: updatedCompany.name,
        logoUrl: updatedCompany.logoUrl,
        customInfo: updatedCompany.customInfo,
        kycStatus: updatedCompany.kycStatus,
        cin: updatedCompany.cin,
        gstin: updatedCompany.gstin,
      }
    });
  } catch (error) {
    console.error('[UPDATE COMPANY ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to update company information' });
  }
};

module.exports = {
  updateCompanyCustomizationAndKYC
};
