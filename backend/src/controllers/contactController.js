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

module.exports = {
  submitContactRequest,
  getContactRequests
};
