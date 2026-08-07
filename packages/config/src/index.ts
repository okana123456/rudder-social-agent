import { z } from 'zod';

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});
const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  META_APP_ID: z.string().min(1),
  META_APP_SECRET: z.string().min(8),
  META_REDIRECT_URI: z.string().url(),
  META_GRAPH_VERSION: z.string().regex(/^v\d+\.\d+$/),
  TOKEN_ENCRYPTION_KEY: z.string().min(43),
});

export function validatePublicEnv(env: Record<string, string | undefined>) {
  return publicSchema.safeParse(env);
}
export function validateServerEnv(env: Record<string, string | undefined>) {
  return serverSchema.safeParse(env);
}
