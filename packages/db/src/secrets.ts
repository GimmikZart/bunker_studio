import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type EncryptedSecret = { version: 1; nonce: string; ciphertext: string; authTag: string };

function masterKey(raw: string): Buffer {
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('STUDIO_MASTER_KEY must be a base64-encoded 32-byte key.');
  return key;
}

export function encryptSecret(secret: string, encodedMasterKey: string): EncryptedSecret {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey(encodedMasterKey), nonce);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return {
    version: 1,
    nonce: nonce.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptSecret(payload: EncryptedSecret, encodedMasterKey: string): string {
  if (payload.version !== 1 || !payload.nonce)
    throw new Error('Unsupported encrypted secret payload.');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    masterKey(encodedMasterKey),
    Buffer.from(payload.nonce, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
