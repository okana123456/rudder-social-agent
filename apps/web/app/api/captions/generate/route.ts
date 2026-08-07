import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase-server';
import { rateLimit } from '@/lib/security';
export async function POST(request: Request) {
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!process.env.OPTIONAL_AI_PROVIDER_URL || !process.env.OPTIONAL_AI_PROVIDER_KEY)
    return NextResponse.json(
      { error: 'Optional AI provider is not configured. Manual captions remain available.' },
      { status: 503 },
    );
  if (!rateLimit(`ai:${user.id}`, 10, 3600000))
    return NextResponse.json({ error: 'Generation rate limit reached' }, { status: 429 });
  const { brief, tone = 'professional' } = await request.json();
  if (typeof brief !== 'string' || brief.trim().length < 10 || brief.length > 2000)
    return NextResponse.json({ error: 'Brief must be 10–2,000 characters' }, { status: 400 });
  const response = await fetch(process.env.OPTIONAL_AI_PROVIDER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPTIONAL_AI_PROVIDER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: 'Write three concise Facebook caption variations. Do not invent factual claims.',
        },
        { role: 'user', content: `Tone: ${tone}\nBrief: ${brief}` },
      ],
      temperature: 0.7,
    }),
  });
  const result = await response.json();
  return NextResponse.json(
    response.ok
      ? { text: result.choices?.[0]?.message?.content ?? result.text }
      : { error: 'AI provider request failed' },
    { status: response.status },
  );
}
