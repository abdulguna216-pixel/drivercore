import type { Request } from 'express';
import { createHmac } from 'node:crypto';
import { db } from '../utils/db.js';

export function fingerprint(value: string) {
  return createHmac('sha256', process.env.JWT_SECRET!).update(value).digest('hex');
}
export type SecurityType = 'LOGIN_FAILED' | 'LOGIN_SUCCESS' | 'LOGOUT' | 'INVALID_SESSION' | 'ACCESS_DENIED' | 'CSRF_DENIED' | 'RATE_LIMITED' | 'USER_CREATED' | 'USER_CHANGED' | 'PASSWORD_CHANGED' | 'UPLOAD_REJECTED' | 'STORAGE_LIMIT' | 'SERVER_ERROR';
export async function audit(req: Request, type: SecurityType, targetId?: string, status?: number) {
  const address = fingerprint(req.ip || req.socket.remoteAddress || 'unknown');
  // Persist only explicitly permitted fields. Never log request bodies, headers or errors.
  const data = { type, actorId: req.user?.id, targetId, fingerprint: address, requestId: req.securityRequestId || 'system', status };
  console.log(JSON.stringify({ kind: 'security', ...data }));
  try {
    await db.securityEvent.create({ data });
    const immediate = ['USER_CHANGED', 'PASSWORD_CHANGED', 'STORAGE_LIMIT', 'SERVER_ERROR'].includes(type);
    const suspicious = ['LOGIN_FAILED', 'INVALID_SESSION', 'ACCESS_DENIED', 'CSRF_DENIED', 'RATE_LIMITED', 'UPLOAD_REJECTED'].includes(type);
    if (!immediate && !suspicious) return;
    const count = immediate ? 1 : await db.securityEvent.count({ where: { type, fingerprint: address, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } } });
    if (count < 10 && !immediate) return;
    const key = `${type}:${address}:${Math.floor(Date.now() / (15 * 60 * 1000))}`;
    const alert = await db.securityAlert.upsert({ where: { key }, create: { key, type, severity: immediate ? 'HIGH' : 'MEDIUM', count }, update: { count, acknowledgedAt: null } });
    console.warn(JSON.stringify({ kind: 'security_alert', id: alert.id, type, count }));
  } catch {
    // The fallback is structured and contains no exception data or secrets.
    console.error(JSON.stringify({ kind: 'security_audit_unavailable', type, requestId: data.requestId }));
  }
}
