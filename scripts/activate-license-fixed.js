const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

const machineId = fs.readFileSync('C:\\Users\\RAHUL VASHISTH\\AppData\\Roaming\\arch-budget-calculator\\.machine-id', 'utf-8').trim();

const ENC_SALT = 'hashxlabs-expense-v1';

function deriveKey(machineId) {
  const material = `${machineId}:${os.hostname()}`;
  return crypto.scryptSync(material, ENC_SALT, 32);
}

function encrypt(data, machineId) {
  const key = deriveKey(machineId);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const payload = JSON.stringify(data);
  const enc = Buffer.concat([cipher.update(payload, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return `ENC.${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

const licPath = path.join(__dirname, '../licenses/rahul-2027-06-09.lic');
const keyStr = fs.readFileSync(licPath, 'utf-8').trim();

const stored = {
  key: keyStr,
  machineId: machineId,
  hostname: os.hostname(),
  activatedAt: new Date().toISOString().split('T')[0]
};

const targetPath = 'C:\\Users\\RAHUL VASHISTH\\AppData\\Roaming\\arch-budget-calculator\\license.dat';
fs.writeFileSync(targetPath, encrypt(stored, machineId), 'utf-8');

console.log('Successfully activated at', targetPath);
