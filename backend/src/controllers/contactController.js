const prisma = require('../config/database');

/**
 * Submit a contact or product demo request.
 * POST /api/contact
 */
const submitContactRequest = async (req, res) => {
  try {
    const { name, email, phone, companyName, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const request = await prisma.contactRequest.create({
      data: {
        name,
        email,
        phone: phone || null,
        companyName: companyName || null,
        message,
        status: 'PENDING'
      }
    });

    res.status(201).json({
      message: 'Contact request submitted successfully. Our team will get back to you shortly.',
      request
    });
  } catch (error) {
    console.error('[SUBMIT CONTACT ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to submit contact request' });
  }
};

/**
 * Retrieve all contact/demo requests.
 * GET /api/contact
 */
const getContactRequests = async (req, res) => {
  try {
    const requests = await prisma.contactRequest.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error) {
    console.error('[GET CONTACT REQUESTS ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to retrieve contact requests' });
  }
};

/**
 * Update a contact/demo request (e.g. status).
 * PUT /api/contact/:id
 */
const updateContactRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, name, email, phone, companyName, message } = req.body;
    
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (companyName !== undefined) updateData.companyName = companyName;
    if (message !== undefined) updateData.message = message;

    const request = await prisma.contactRequest.update({
      where: { id },
      data: updateData
    });
    res.json(request);
  } catch (error) {
    console.error('[UPDATE CONTACT REQUEST ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to update contact request' });
  }
};

/**
 * Delete a contact/demo request.
 * DELETE /api/contact/:id
 */
const deleteContactRequest = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.contactRequest.delete({
      where: { id }
    });
    res.json({ message: 'Contact request deleted successfully.' });
  } catch (error) {
    console.error('[DELETE CONTACT REQUEST ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to delete contact request' });
  }
};

module.exports = {
  submitContactRequest,
  getContactRequests,
  updateContactRequest,
  deleteContactRequest
};
