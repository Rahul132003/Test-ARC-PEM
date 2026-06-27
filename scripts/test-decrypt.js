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

function decrypt(raw, machineId) {
  try {
    if (!raw.startsWith('ENC.')) return null;

    const parts = raw.split('.');
    if (parts.length !== 4) return null;
    const [, ivB64, tagB64, dataB64] = parts;
    const key = deriveKey(machineId);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return JSON.parse(dec.toString('utf-8'));
  } catch (err) {
    return { error: err.message };
  }
}

const lp = 'C:\\Users\\RAHUL VASHISTH\\AppData\\Roaming\\arch-budget-calculator\\license.dat';
const raw = fs.readFileSync(lp, 'utf-8');
const decrypted = decrypt(raw, machineId);
console.log('Decrypted License:', decrypted);

// Now test verification logic
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvPJmDOm9Q3IlGPJ/sZ8Y
H0ALN1Q4qAaSiFY6DewxwZ1x80M0rAg62Stc0LOkkac1qSs1JJlI2sH7fOSYmxC+
NfXrZkE9nxbRV2a/LvTpiMtTyfmq0b3sgeu+tMMKENH891+HsdiIHr3ho5daU9g6
z9UH9sI6Iwk1sQsC0Gi7ufxhAQ5GjBYO72p5dRuO/7oRRq1ews5hWqboZaJnno4X
eDiojPvDBAHM1uwUsxywVTAIaR+QOsSTrPY2jLgEWoY1UQ6l48R76umDWoHRYpba
xtvpgvCgChGFGAKsQfGgJk2tzqIKbaxwgd6D4TTil8Zlhbwx7GpbTSIi11u+Wmkc
8QIDAQAB
-----END PUBLIC KEY-----`;

function verifyLicenseKey(key, currentMachineId) {
  try {
    const trimmed = key.trim();
    const dot = trimmed.lastIndexOf('.');
    if (dot === -1) return { valid: false, error: 'Invalid license format' };

    const payloadB64 = trimmed.slice(0, dot);
    const sigB64     = trimmed.slice(dot + 1);

    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(payloadB64);
    const ok = verify.verify(PUBLIC_KEY, sigB64, 'base64');
    if (!ok) return { valid: false, error: 'License key is invalid or has been tampered with' };

    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64').toString('utf-8')
    );

    const expiryMs    = new Date(payload.expiry + 'T23:59:59').getTime();
    const graceMs     = expiryMs + 7 * 86_400_000;
    const now         = Date.now();
    const daysLeft    = Math.floor((expiryMs - now) / 86_400_000);
    const inGrace     = now > expiryMs && now <= graceMs;

    if (currentMachineId && payload.machineId && payload.machineId !== currentMachineId) {
      return {
        valid: false,
        error: `This license is locked to a different Machine ID (${payload.machineId}). It cannot be used on this computer.`,
      };
    }

    if (now > graceMs) {
      return {
        valid: false,
        error: `License expired on ${payload.expiry}. Grace period has ended. Contact HashX Labs to renew.`,
      };
    }

    return { valid: true, payload, daysLeft, inGracePeriod: inGrace };
  } catch (err) {
    return { valid: false, error: 'Failed to read license key ' + err.message };
  }
}

if (decrypted && decrypted.key) {
  const result = verifyLicenseKey(decrypted.key, machineId);
  console.log('Verify Result:', result);
}
