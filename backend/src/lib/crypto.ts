import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export interface EncryptedValue {
  encrypted: true;
  iv: string;
  tag: string;
  data: string;
  maskedValue: string;
}

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY is required to encrypt tenant secrets');
  }

  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  if (/^[A-Za-z0-9+/=]{44}$/.test(raw)) return Buffer.from(raw, 'base64');

  return crypto.createHash('sha256').update(raw).digest();
}

export function maskSecret(value: string): string {
  if (!value) return '';
  const tail = value.slice(-4);
  return `${'•'.repeat(8)}${tail}`;
}

export function encryptSecret(value: string): EncryptedValue {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encrypted: true,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
    maskedValue: maskSecret(value),
  };
}

export function isEncryptedValue(value: unknown): value is EncryptedValue {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as { encrypted?: unknown }).encrypted === true &&
    typeof (value as { iv?: unknown }).iv === 'string' &&
    typeof (value as { tag?: unknown }).tag === 'string' &&
    typeof (value as { data?: unknown }).data === 'string',
  );
}

export function decryptSecret(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!isEncryptedValue(value)) return undefined;

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(value.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(value.data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
