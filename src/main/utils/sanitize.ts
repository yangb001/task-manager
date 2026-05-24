const SENSITIVE_KEYS = ['password', 'token', 'api_key', 'secret', 'authorization', 'api_key_var'];

export function sanitizeForLog(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLog(item));
  }

  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s))) {
      result[key] = '***REDACTED***';
    } else {
      result[key] = sanitizeForLog(obj[key]);
    }
  }
  return result;
}
