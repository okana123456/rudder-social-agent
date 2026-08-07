import { HttpError } from './http.ts';

export function requireServiceRole(request: Request) {
  const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supplied = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || supplied !== expected)
    throw new HttpError('Unauthorised service invocation', 401);
}
