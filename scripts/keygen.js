/**
 * License Key Generator — HashX Labs (admin-only tool)
 *
 * Generates a signed .lic file that is emailed to the client.
 * The client imports it on first launch to activate the software.
 *
 * Machine binding model:
 *   --machineId is embedded in the signed payload. When the client activates,
 *   the app checks that the license's machineId matches their machine's UUID.
 *   The client's Machine ID is shown on the License screen and in Settings.
 *
 * Usage:
 *   node scripts/keygen.js \
 *     --client  "ABC Architects" \
 *     --email   "info@abc.com" \
 *     --seats   2 \
 *     --expiry  2027-04-25 \
 *     --machineId "a1b2c3d4e5f6..."   ← copy from client's License screen
 *
 * Output:
 *   licenses/<slug>-<expiry>.lic — email this file to the client.
 *
 * IMPORTANT: Keep scripts/license-private.pem SECRET. Never commit it to git.
 *            Anyone with the private key can generate valid licenses.
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// ── Parse CLI arguments ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get  = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] ?? null : null;
};

const client    = get('--client');
const email     = get('--email')  || '';
const seats     = parseInt(get('--seats') || '1', 10);
const expiry    = get('--expiry');
const machineId = get('--machineId');
const plan      = get('--plan') || 'solo';

const VALID_PLANS = ['solo', 'studio', 'enterprise'];

if (!client || !expiry || !machineId) {
  console.error('\nUsage:');
  console.error('  node scripts/keygen.js \\');
  console.error('    --client    "Client Name" \\');
  console.error('    --email     "client@email.com" \\');
  console.error('    --seats     2 \\');
  console.error('    --expiry    YYYY-MM-DD \\');
  console.error('    --machineId "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\');
  console.error('    --plan      solo|studio|enterprise\n');
  console.error('Get the Machine ID from the client\'s License screen or Settings → License.\n');
  process.exit(1);
}

if (!VALID_PLANS.includes(plan)) {
  console.error(`Error: --plan must be one of: ${VALID_PLANS.join(', ')}\n`);
  process.exit(1);
}

const PLAN_LIMITS = {
  solo:       { maxProjects: 10,  maxSeats: 1,  priceMonthly: 2499 },
  studio:     { maxProjects: 30,  maxSeats: 5,  priceMonthly: 4999 },
  enterprise: { maxProjects: 50,  maxSeats: 10, priceMonthly: 9999 },
};

if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
  console.error('Error: --expiry must be in YYYY-MM-DD format, e.g. 2027-04-25\n');
  process.exit(1);
}

const expiryDate = new Date(expiry);
if (isNaN(expiryDate.getTime())) {
  console.error('Error: --expiry is not a valid date\n');
  process.exit(1);
}

if (expiryDate < new Date()) {
  console.error('Warning: --expiry is in the past. The generated license will be expired immediately.\n');
}

// ── Load private key ───────────────────────────────────────────────────────────
const privateKeyPath = path.join(__dirname, 'license-private.pem');
if (!fs.existsSync(privateKeyPath)) {
  console.error('Error: Private key not found at scripts/license-private.pem');
  console.error('Generate it once with:');
  console.error('  openssl genrsa -out scripts/license-private.pem 2048');
  console.error('  openssl rsa -in scripts/license-private.pem -pubout -out scripts/license-public.pem\n');
  process.exit(1);
}
const privateKey = fs.readFileSync(privateKeyPath, 'utf-8');

// ── Build and sign payload ─────────────────────────────────────────────────────
const limits  = PLAN_LIMITS[plan];
const payload = {
  client,
  email,
  seats,
  expiry,
  machineId,
  plan,
  issued: new Date().toISOString().split('T')[0],
};

const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64');

const sign = crypto.createSign('RSA-SHA256');
sign.update(payloadB64);
const sigB64 = sign.sign(privateKey, 'base64');

const licenseKey = `${payloadB64}.${sigB64}`;

// ── Save .lic file ─────────────────────────────────────────────────────────────
const licDir = path.join(__dirname, '..', 'licenses');
if (!fs.existsSync(licDir)) fs.mkdirSync(licDir);

const slug     = client.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const filename = `${slug}-${expiry}.lic`;
const outPath  = path.join(licDir, filename);

fs.writeFileSync(outPath, licenseKey, 'utf-8');

// ── Summary ────────────────────────────────────────────────────────────────────
console.log('\n✅  License Generated Successfully\n');
console.log(`   Client      : ${client}`);
console.log(`   Email       : ${email || '—'}`);
console.log(`   Plan        : ${plan.toUpperCase()} (₹${limits.priceMonthly.toLocaleString('en-IN')}/month)`);
console.log(`   Seats       : ${seats} (max ${limits.maxSeats} for ${plan})`);
console.log(`   Max Projects: ${limits.maxProjects}`);
console.log(`   Machine ID  : ${machineId}`);
console.log(`   Expires     : ${expiry}`);
console.log(`   Issued      : ${payload.issued}`);
console.log(`\n   File        : licenses/${filename}`);
console.log('\n   Email this .lic file to the client. They import it on first launch.\n');
