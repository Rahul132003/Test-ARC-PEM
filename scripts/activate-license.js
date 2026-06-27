const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { machineIdSync } = require('node-machine-id');

function getMachineId() {
  const mid = machineIdSync();
  const host = os.hostname();
  return crypto.createHash('sha256').update(`${mid}-${host}`).digest('hex');
}

function encrypt(data, machineId) {
  const key = crypto.createHash('sha256').update(machineId).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const payload = JSON.stringify(data);
  let enc = cipher.update(payload, 'utf-8');
  enc = Buffer.concat([enc, cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

app.whenReady().then(() => {
  try {
    const licPath = path.join(__dirname, '../licenses/rahul-2027-06-09.lic');
    const keyStr = fs.readFileSync(licPath, 'utf-8').trim();
    
    const mid = getMachineId();
    const stored = { key: keyStr, activatedAt: new Date().toISOString() };
    
    const targetPath = path.join(app.getPath('userData'), 'license.dat');
    fs.writeFileSync(targetPath, encrypt(stored, mid), 'utf-8');
    
    console.log('Successfully activated license at', targetPath);
  } catch (err) {
    console.error('Failed to activate:', err);
  }
  app.quit();
});
