/**
 * Simple in-memory rate limiter for Edge Functions
 * Tracks requests per user and per IP
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const userLimits = new Map<string, RateLimitEntry>();
const ipLimits = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of userLimits.entries()) {
    if (entry.resetAt < now) userLimits.delete(key);
  }
  for (const [key, entry] of ipLimits.entries()) {
    if (entry.resetAt < now) ipLimits.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Check if a request should be rate limited
 * @param identifier - User ID or IP address
 * @param limit - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 * @param type - Type of limit (user or ip)
 * @returns true if rate limit exceeded
 */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
  type: 'user' | 'ip' = 'user'
): { limited: boolean; remaining: number; resetAt: number } {
  const store = type === 'user' ? userLimits : ipLimits;
  const now = Date.now();
  const key = `${type}:${identifier}`;
  
  let entry = store.get(key);
  
  // Reset if window expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + windowMs
    };
    store.set(key, entry);
  }
  
  entry.count++;
  
  const limited = entry.count > limit;
  const remaining = Math.max(0, limit - entry.count);
  
  return {
    limited,
    remaining,
    resetAt: entry.resetAt
  };
}

/**
 * Get client IP from request headers
 */
export function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || req.headers.get('x-real-ip') 
    || 'unknown';
}

/**
 * Rate limit middleware response
 */
export function rateLimitResponse(resetAt: number, corsHeaders: Record<string, string>) {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({ 
      error: 'Rate limit exceeded. Please try again later.',
      retryAfter 
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Reset': new Date(resetAt).toISOString()
      }
    }
  );
}
