/**
 * @fileoverview Document management controller.
 * Handles file upload, retrieval, download, and deletion for employee documents.
 * @module controllers/documentController
 */

const prisma = require('../config/database');
const fs = require('fs');
const fileStorage = require('../services/fileStorage');
const { canAccessEmployee } = require('../services/accessControl');
const { logPayrollEvent } = require('../services/auditService');

const getEmployeeDocuments = async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!(await canAccessEmployee(req.user, employeeId))) {
      return res.status(403).json({ error: 'Access denied for requested employee documents' });
    }

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
    if (!(await canAccessEmployee(req.user, employeeId))) {
      return res.status(403).json({ error: 'Access denied. You cannot upload documents for this employee.' });
    }

    // Disk in dev/test, S3 in prod — fileName/filePath are stored on the record.
    const { fileName, filePath } = await fileStorage.persist(req.file, 'documents');

    const document = await prisma.document.create({
      data: {
        name: name || req.file.originalname,
        type: type || 'OTHER',
        description: description || null,
        fileName,
        filePath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        employeeId,
        uploadedBy: req.user?.id,
      },
    });

    await logPayrollEvent({
      userEmail: req.user?.email || req.user?.id || 'system',
      action: 'DOCUMENT_UPLOADED',
      entity: 'Document',
      entityId: document.id,
      newDetails: { employeeId, name: document.name, type: document.type, mimeType: document.mimeType, fileSize: document.fileSize },
      ipAddress: req.ip,
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
    if (!(await canAccessEmployee(req.user, document.employeeId))) {
      return res.status(403).json({ error: 'Access denied. You cannot delete this document.' });
    }

    // Removes the S3 object or the on-disk file (path validated under the upload root).
    await fileStorage.remove(document.filePath);

    await prisma.document.delete({ where: { id } });
    await logPayrollEvent({
      userEmail: req.user?.email || req.user?.id || 'system',
      action: 'DOCUMENT_DELETED',
      entity: 'Document',
      entityId: id,
      oldDetails: { employeeId: document.employeeId, name: document.name, type: document.type },
      ipAddress: req.ip,
    });
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
    if (!(await canAccessEmployee(req.user, document.employeeId))) {
      return res.status(403).json({ error: 'Access denied. You cannot download this document.' });
    }

    const dl = await fileStorage.getDownload(document.filePath);
    // Disk: validated path must exist. S3: short-lived presigned redirect.
    if (!dl.redirectUrl && (!dl.localPath || !fs.existsSync(dl.localPath))) {
      return res.status(404).json({ error: 'File not found' });
    }

    await logPayrollEvent({
      userEmail: req.user?.email || req.user?.id || 'system',
      action: 'DOCUMENT_DOWNLOADED',
      entity: 'Document',
      entityId: id,
      newDetails: { employeeId: document.employeeId, name: document.name, type: document.type },
      ipAddress: req.ip,
    });

    if (dl.redirectUrl) return res.redirect(dl.redirectUrl);
    res.download(dl.localPath, document.name);
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
