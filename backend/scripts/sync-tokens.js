const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const backendEnvPath = path.resolve(__dirname, '../.env');
const aiEnvPath = path.resolve(__dirname, '../../ai-recruitment-service/.env');

function getOrGenerateToken(envPath) {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^HRMS_SERVICE_TOKEN=(.*)$/m) || content.match(/^AI_RECRUITMENT_SERVICE_TOKEN=(.*)$/m);
    if (match && match[1].trim().length >= 32) {
      return match[1].trim();
    }
  }
  return null;
}

function updateEnvFile(envPath, token) {
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  if (content.includes('HRMS_SERVICE_TOKEN=')) {
    content = content.replace(/^HRMS_SERVICE_TOKEN=.*$/m, `HRMS_SERVICE_TOKEN=${token}`);
  } else {
    content += `\nHRMS_SERVICE_TOKEN=${token}\n`;
  }

  if (content.includes('AI_RECRUITMENT_SERVICE_TOKEN=')) {
    content = content.replace(/^AI_RECRUITMENT_SERVICE_TOKEN=.*$/m, `AI_RECRUITMENT_SERVICE_TOKEN=${token}`);
  } else if (envPath === backendEnvPath) {
    content += `\nAI_RECRUITMENT_SERVICE_TOKEN=${token}\n`;
  }

  fs.writeFileSync(envPath, content, 'utf8');
}

const token = getOrGenerateToken(backendEnvPath) || getOrGenerateToken(aiEnvPath) || crypto.randomBytes(32).toString('base64url');
updateEnvFile(backendEnvPath, token);
updateEnvFile(aiEnvPath, token);

console.log('✅ Synchronized HRMS_SERVICE_TOKEN across backend and ai-recruitment-service.');
