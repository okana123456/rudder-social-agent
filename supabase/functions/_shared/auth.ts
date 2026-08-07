import { HttpError } from './http.ts';

export function requireCronSecret(request: Request) {
  const expected = Deno.env.get('RUDDER_CRON_SECRET');
  const supplied = request.headers.get('x-rudder-cron-secret');
  if (!expected || supplied !== expected)
    throw new HttpError('Unauthorised scheduled invocation', 401);
}
