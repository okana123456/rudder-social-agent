import { NextResponse } from 'next/server';
export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'rudder-web',
    time: new Date().toISOString(),
    configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  });
}
