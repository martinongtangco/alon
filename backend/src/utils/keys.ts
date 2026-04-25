import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DEV_KEY_FILE = path.join(process.cwd(), '.dev-keys.json');

function loadOrGenerateKeys(): { privateKey: string; publicKey: string } {
  // Production: always load from environment variables
  if (process.env.ADMIN_PRIVATE_KEY && process.env.ADMIN_PUBLIC_KEY) {
    return {
      privateKey: process.env.ADMIN_PRIVATE_KEY,
      publicKey: process.env.ADMIN_PUBLIC_KEY,
    };
  }

  // Dev: reuse keys from disk so token validity survives server restarts
  if (process.env.NODE_ENV !== 'production' && fs.existsSync(DEV_KEY_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(DEV_KEY_FILE, 'utf-8'));
      if (saved.privateKey && saved.publicKey) return saved;
    } catch {
      // Corrupt file — fall through and regenerate
    }
  }

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  if (process.env.NODE_ENV !== 'production') {
    fs.writeFileSync(DEV_KEY_FILE, JSON.stringify({ privateKey, publicKey }), { mode: 0o600 });
    console.log('[keys] Generated new dev RSA key pair — saved to .dev-keys.json');
  }

  return { privateKey, publicKey };
}

const keys = loadOrGenerateKeys();

export const getPrivateKey = () => keys.privateKey;
export const getPublicKey = () => keys.publicKey;
