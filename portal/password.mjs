import {webcrypto as crypto} from 'node:crypto';
const encoder = new TextEncoder();
const hex = value => [...new Uint8Array(value)].map(n => n.toString(16).padStart(2, '0')).join('');
const equal = (a, b) => { let diff = a.length ^ b.length; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0); return diff === 0; };
const pattern = /^pbkdf2-sha256:600000:([a-f0-9]{32}):([a-f0-9]{64})$/;
export const validCredentialHash = value => typeof value === 'string' && (/^[a-f0-9]{64}$/.test(value) || pattern.test(value));
async function derive(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', iterations: 600000,
    salt: Uint8Array.from(salt.match(/../g), byte => parseInt(byte, 16))}, key, 256));
}
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new Error('管理密码需要 12–128 个字符');
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return `pbkdf2-sha256:600000:${salt}:${await derive(password, salt)}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128 || !validCredentialHash(stored)) return false;
  const parts = pattern.exec(stored);
  if (parts) return equal(await derive(password, parts[1]), parts[2]);
  // Existing SHA-256 credentials are supported only for generated high-entropy keys.
  return password.length >= 43 && equal(hex(await crypto.subtle.digest('SHA-256', encoder.encode(password))), stored);
}
