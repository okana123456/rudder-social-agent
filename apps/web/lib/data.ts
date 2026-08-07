import { browserClient } from './supabase-browser';
export async function organisation() {
  const db = browserClient();
  const { data, error } = await db
    .from('organisations')
    .select('*')
    .is('archived_at', null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export async function list(table: string, orgId: string) {
  const db = browserClient();
  const { data, error } = await db
    .from(table)
    .select('*')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}
export async function create(table: string, value: Record<string, unknown>) {
  const { data, error } = await browserClient().from(table).insert(value).select().single();
  if (error) throw error;
  return data;
}
export async function update(table: string, id: string, value: Record<string, unknown>) {
  const { data, error } = await browserClient()
    .from(table)
    .update(value)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
