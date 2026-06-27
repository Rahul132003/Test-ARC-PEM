/**
 * License management for Project Expense Manager.
 *
 * Flow:
 *  1. Admin runs scripts/keygen.js to sign a payload with the RSA-2048 private key → .lic file.
 *  2. Client imports the .lic file (or pastes the text) on first launch.
 *  3. On activation the key is verified against the public key, then stored encrypted with
 *     AES-256-GCM in <userData>/license.dat. The encryption key is derived from this machine's
 *     UUID + hostname, so copying license.dat to a machine with a different hostname fails.
 *  4. On every launch getLicenseStatus() decrypts and re-verifies the stored key.
 *
 * Grace period: GRACE_DAYS after expiry the app still opens (red banner shown).
 * Warning:      WARN_DAYS before expiry an amber/orange banner is shown.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { app } from 'electron';
import { machineIdSync } from 'node-machine-id';

// Public key baked into the app binary — safe to ship.
// Licenses cannot be forged without the private key (scripts/license-private.pem).
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvPJmDOm9Q3IlGPJ/sZ8Y
H0ALN1Q4qAaSiFY6DewxwZ1x80M0rAg62Stc0LOkkac1qSs1JJlI2sH7fOSYmxC+
NfXrZkE9nxbRV2a/LvTpiMtTyfmq0b3sgeu+tMMKENH891+HsdiIHr3ho5daU9g6
z9UH9sI6Iwk1sQsC0Gi7ufxhAQ5GjBYO72p5dRuO/7oRRq1ews5hWqboZaJnno4X
eDiojPvDBAHM1uwUsxywVTAIaR+QOsSTrPY2jLgEWoY1UQ6l48R76umDWoHRYpba
xtvpgvCgChGFGAKsQfGgJk2tzqIKbaxwgd6D4TTil8Zlhbwx7GpbTSIi11u+Wmkc
8QIDAQAB
-----END PUBLIC KEY-----`;

const GRACE_DAYS = 7;   // Days app still opens after expiry before hard lock
const WARN_DAYS  = 30;  // Days before expiry to start showing warning banner
const ENC_SALT   = 'hashxlabs-expense-v1';

export type PlanTier = 'solo' | 'studio' | 'enterprise';

export interface PlanFeatures {
  tallyExport:     boolean; // All exports incl. Tally CSV
  gstReport:       boolean; // GST Purchase Register page
  pendingPayments: boolean; // Pending Payments Report page
  pinLock:         boolean; // PIN lock & security
  customBranding:  boolean; // Custom branding on PDF reports
  dbSharing:       boolean; // Multi-user database sharing
  machineTransfer: boolean; // Machine transfer support
}

export const PLAN_LIMITS: Record<PlanTier, { maxProjects: number; maxSeats: number; priceMonthly: number }> = {
  solo:       { maxProjects: 10,  maxSeats: 1,  priceMonthly: 2499 },
  studio:     { maxProjects: 30,  maxSeats: 5,  priceMonthly: 4999 },
  enterprise: { maxProjects: 50,  maxSeats: 10, priceMonthly: 9999 },
};

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  solo: {
    tallyExport:     true,
    gstReport:       true,
    pendingPayments: false,
    pinLock:         true,
    customBranding:  false,
    dbSharing:       false,
    machineTransfer: false,
  },
  studio: {
    tallyExport:     true,
    gstReport:       true,
    pendingPayments: true,
    pinLock:         true,
    customBranding:  false,
    dbSharing:       true,
    machineTransfer: false,
  },
  enterprise: {
    tallyExport:     true,
    gstReport:       true,
    pendingPayments: true,
    pinLock:         true,
    customBranding:  true,
    dbSharing:       true,
    machineTransfer: true,
  },
};

export const PLAN_DISPLAY_NAMES: Record<PlanTier, string> = {
  solo:       'Solo',
  studio:     'Studio',
  enterprise: 'Enterprise',
};

// Maps external / legacy plan names (from admin dashboards, older keygens) → internal tier.
// Any unrecognised name falls back to 'solo'.
const PLAN_NAME_MAP: Record<string, PlanTier> = {
  solo:         'solo',
  basic:        'solo',
  starter:      'solo',
  individual:   'solo',
  professional: 'studio',
  pro:          'studio',
  studio:       'studio',
  team:         'studio',
  business:     'studio',
  enterprise:   'enterprise',
  ultimate:     'enterprise',
  corporate:    'enterprise',
};

function normalisePlan(raw: string | undefined): PlanTier {
  if (!raw) return 'solo';
  return PLAN_NAME_MAP[raw.toLowerCase()] ?? 'solo';
}

export interface LicensePayload {
  client:    string;
  email:     string;
  seats:     number;
  expiry:    string; // YYYY-MM-DD
  issued:    string; // YYYY-MM-DD
  machineId: string; // Machine this license is locked to (checked at activation time)
  plan?:     string; // Raw plan name from keygen — normalised via normalisePlan() at runtime
}

interface StoredLicense {
  key: string;
  machineId: string;
  hostname: string;
  activatedAt: string;
}

export interface LicenseStatus {
  valid:          boolean;
  trial?:         boolean; // true when running on the free trial (no activated license)
  trialDaysLeft?: number;  // Days remaining in the trial period
  client?:        string;
  email?:         string;
  seats?:         number;
  expiry?:        string;
  daysLeft?:      number;  // Negative = inside grace period past expiry
  inGracePeriod?: boolean;
  showWarning?:   boolean; // true when daysLeft <= WARN_DAYS
  machineId?:     string;  // Always returned so LicensePage can show it even when invalid
  error?:         string;
  // Plan tier fields — populated for valid licenses
  plan?:        PlanTier;
  maxProjects?: number;
  maxSeats?:    number;
  features?:    PlanFeatures;
}

// ── File paths ─────────────────────────────────────────────────────────────────
const licensePath   = () => path.join(app.getPath('userData'), 'license.dat');
const machineIdPath = () => path.join(app.getPath('userData'), '.machine-id');

// ── Machine ID ─────────────────────────────────────────────────────────────────
/**
 * Returns a stable random UUID for this installation.
 * Generated once on first run and persisted to .machine-id.
 * Combined with os.hostname() it forms the AES key material, so copying
 * both files to a machine with a different hostname will fail to decrypt.
 */
export function getMachineId(): string {
  const p = machineIdPath();
  // Return persisted ID if it exists — preserves backward compat for already-activated licenses.
  try {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8').trim();
  } catch (_) {}
  // New install: use hardware-bound ID so it survives userData path changes and reinstalls.
  let id: string;
  try {
    id = machineIdSync(false);
  } catch (_) {
    id = crypto.randomBytes(16).toString('hex');
  }
  try { fs.writeFileSync(p, id, 'utf-8'); } catch (_) {}
  return id;
}

// ── AES-256-GCM encryption ─────────────────────────────────────────────────────
/**
 * Derives a 32-byte AES key from machineId + hostname using scrypt.
 * Different hostname → different key → license.dat from another machine fails to decrypt.
 */
function deriveKey(machineId: string): Buffer {
  const material = `${machineId}:${os.hostname()}`;
  return crypto.scryptSync(material, ENC_SALT, 32) as Buffer;
}

function encrypt(data: StoredLicense, machineId: string): string {
  const key = deriveKey(machineId);
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const buf = Buffer.concat([cipher.update(JSON.stringify(data), 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `ENC.${iv.toString('base64')}.${tag.toString('base64')}.${buf.toString('base64')}`;
}

function decrypt(raw: string, machineId: string): StoredLicense | null {
  try {
    // All current installations write the ENC. prefix. Reject anything else.
    if (!raw.startsWith('ENC.')) return null;

    const parts = raw.split('.');
    if (parts.length !== 4) return null;
    const [, ivB64, tagB64, dataB64] = parts;
    const key      = deriveKey(machineId);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return JSON.parse(dec.toString('utf-8')) as StoredLicense;
  } catch {
    return null;
  }
}

// ── RSA signature verification + expiry ───────────────────────────────────────
/**
 * Verifies the RSA-SHA256 signature on a license key, checks machine binding, and expiry.
 * Key format: base64(JSON payload) + "." + base64(RSA signature)
 *
 * @param key              The raw license key string (from .lic file or paste).
 * @param currentMachineId If provided, verifies that payload.machineId matches this machine.
 */
export function verifyLicenseKey(key: string, currentMachineId?: string): {
  valid: boolean;
  payload?: LicensePayload;
  daysLeft?: number;
  inGracePeriod?: boolean;
  error?: string;
} {
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

    const payload: LicensePayload = JSON.parse(
      Buffer.from(payloadB64, 'base64').toString('utf-8')
    );

    const expiryMs    = new Date(payload.expiry + 'T23:59:59').getTime();
    const graceMs     = expiryMs + GRACE_DAYS * 86_400_000;
    const now         = Date.now();
    // Math.floor: a key expiring today shows daysLeft = 0, not 1
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
  } catch {
    return { valid: false, error: 'Failed to read license key' };
  }
}

// ── Activate ───────────────────────────────────────────────────────────────────
/**
 * Validates a license key and, if valid, stores it encrypted in license.dat.
 * After this call, getLicenseStatus() will return valid = true on this machine.
 */
export function activateLicense(key: string): { success: boolean; client?: string; error?: string } {
  const machineId = getMachineId();
  const result = verifyLicenseKey(key, machineId);
  if (!result.valid || !result.payload) {
    return { success: false, error: result.error };
  }
  const stored: StoredLicense = {
    key: key.trim(),
    machineId,
    hostname: os.hostname(),
    activatedAt: new Date().toISOString().split('T')[0],
  };

  fs.writeFileSync(licensePath(), encrypt(stored, machineId), 'utf-8');
  return { success: true, client: result.payload.client };
}

// ── Status ─────────────────────────────────────────────────────────────────────
/**
 * Reads and validates the stored license on every app launch.
 * Always returns machineId so LicensePage can display it even when the license is invalid.
 */
export function getLicenseStatus(): LicenseStatus {
  const machineId = getMachineId();

  try {
    const lp = licensePath();
    // No license file → prompt for activation
    if (!fs.existsSync(lp)) {
      return {
        valid: false,
        machineId,
        error: 'No license found. Please activate your license to continue.',
      };
    }

    const raw    = fs.readFileSync(lp, 'utf-8');
    const stored = decrypt(raw, machineId);

    if (!stored) {
      return {
        valid: false,
        machineId,
        error: 'License file is corrupted or belongs to a different machine. Please re-import your .lic file.',
      };
    }

    if (stored.machineId !== machineId) {
      return {
        valid: false,
        machineId,
        error: 'This license was activated on a different machine. Re-import your .lic file to activate here.',
      };
    }

    const result = verifyLicenseKey(stored.key, machineId);
    if (!result.valid || !result.payload) {
      return { valid: false, machineId, error: result.error };
    }

    const p    = result.payload;
    const tier = normalisePlan(p.plan); // maps "professional", "pro", etc. → internal tier
    return {
      valid: true,
      client: p.client,
      email: p.email,
      seats: p.seats,
      expiry: p.expiry,
      daysLeft: result.daysLeft,
      inGracePeriod: result.inGracePeriod ?? false,
      showWarning: (result.daysLeft ?? 999) <= WARN_DAYS,
      machineId,
      plan:        tier,
      maxProjects: PLAN_LIMITS[tier].maxProjects,
      maxSeats:    PLAN_LIMITS[tier].maxSeats,
      features:    PLAN_FEATURES[tier],
    };
  } catch {
    return { valid: false, machineId, error: 'License file is corrupted' };
  }
}

// ── Deactivate ─────────────────────────────────────────────────────────────────
/** Removes the stored license file, effectively deactivating this machine. */
export function deactivateLicense(): void {
  try { fs.unlinkSync(licensePath()); } catch (_) {}
}
