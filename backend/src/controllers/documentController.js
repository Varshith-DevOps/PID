const prisma = require('../config/database');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const getEmployeeDocuments = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const documents = await prisma.document.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const uploadDocument = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { name, type, description } = req.body;
    
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const document = await prisma.document.create({
      data: {
        name: name || req.file.originalname,
        type: type || 'OTHER',
        description: description || null,
        fileName: req.file.filename,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        employeeId,
        uploadedBy: req.user?.id,
      },
    });

    res.status(201).json(document);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) return res.status(404).json({ error: 'Document not found' });

    const filePath = path.resolve(document.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.document.delete({ where: { id } });
    res.json({ message: 'Document deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) return res.status(404).json({ error: 'Document not found' });

    const filePath = path.resolve(document.filePath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

    res.download(filePath, document.name);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getEmployeeDocuments,
  uploadDocument,
  deleteDocument,
  downloadDocument,
};