import { Dashboard } from '@/components/dashboard';
export default async function Page({ params }: { params: Promise<{ section?: string[] }> }) {
  const value = await params;
  return <Dashboard section={value.section?.[0] ?? 'overview'} />;
}
