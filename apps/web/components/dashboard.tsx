'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Archive,
  BarChart3,
  Bell,
  BookText,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileText,
  Gauge,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorSmartphone,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { browserClient, isConfigured } from '@/lib/supabase-browser';
import { create, list, organisation, update } from '@/lib/data';

const nav = [
  ['overview', 'Overview', LayoutDashboard],
  ['campaigns', 'Campaigns', Gauge],
  ['content', 'Content Library', ImageIcon],
  ['captions', 'Caption Library', BookText],
  ['composer', 'Composer', Send],
  ['calendar', 'Calendar', CalendarDays],
  ['facebook-pages', 'Facebook Pages', FileText],
  ['facebook-groups', 'Facebook Groups', Users],
  ['queue', 'Queue', ClipboardList],
  ['devices', 'Devices & Agent', MonitorSmartphone],
  ['analytics', 'Analytics', BarChart3],
  ['activity', 'Activity & Audit', ShieldCheck],
  ['settings', 'Settings', Settings],
] as const;
const labels = Object.fromEntries(nav.map(([id, label]) => [id, label]));
type Row = Record<string, any>;
function canonicalFacebookGroupUrl(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Enter the full Facebook Group URL.');
  }
  const supportedHosts = new Set([
    'facebook.com',
    'www.facebook.com',
    'web.facebook.com',
    'm.facebook.com',
  ]);
  const group = parsed.pathname.match(/^\/groups\/([^/?#]+)/i)?.[1];
  if (parsed.protocol !== 'https:' || !supportedHosts.has(parsed.hostname.toLowerCase()) || !group)
    throw new Error('Use the Group main-page URL, for example https://www.facebook.com/groups/123456.');
  return `https://www.facebook.com/groups/${group}`;
}
export function Dashboard({ section }: { section: string }) {
  const path = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState(false);
  const orgQ = useQuery({
    queryKey: ['organisation'],
    queryFn: organisation,
    enabled: isConfigured(),
  });
  const orgId = orgQ.data?.id as string | undefined;
  async function signOut() {
    if (isConfigured()) await browserClient().auth.signOut();
    router.push('/sign-in');
    router.refresh();
  }
  return (
    <div className={dark ? 'dark' : ''}>
      <div className="dashboard">
        <aside className={`sidebar ${menu ? 'open' : ''}`}>
          <div className="brand">
            <span className="brand-mark">R</span>Rudder
          </div>
          <nav className="nav" aria-label="Main navigation">
            {nav.map(([id, label, Icon]) => (
              <Link
                key={id}
                href={`/dashboard/${id}`}
                className={path.endsWith('/' + id) ? 'active' : ''}
                onClick={() => setMenu(false)}
              >
                <Icon size={17} />
                {label}
              </Link>
            ))}
          </nav>
          <div style={{ marginTop: 24, padding: '12px', fontSize: 12, color: '#8fa8bc' }}>
            Confirmation-first automation
            <br />
            Africa/Nairobi
          </div>
        </aside>
        <main className="main">
          <header className="topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                className="btn secondary mobile-menu"
                aria-label="Open navigation"
                onClick={() => setMenu(true)}
              >
                <Menu size={18} />
              </button>
              <span className="muted" style={{ fontSize: 14 }}>
                {orgQ.data?.name ?? 'Rudder workspace'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn secondary"
                aria-label="Toggle theme"
                onClick={() => setDark(!dark)}
              >
                {dark ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <Link className="btn secondary" aria-label="Notifications" href="/dashboard/activity">
                <Bell size={17} />
              </Link>
              <button className="btn secondary" onClick={signOut}>
                <LogOut size={17} />
                <span className="mobile-label">Sign out</span>
              </button>
            </div>
          </header>
          <div className="content">
            {!isConfigured() ? (
              <ConfigurationRequired />
            ) : orgQ.isLoading ? (
              <Loading />
            ) : !orgId ? (
              <NoWorkspace />
            ) : (
              <Section section={section} orgId={orgId} />
            )}
          </div>
        </main>
      </div>
      {menu && (
        <button
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 40, background: '#0008', border: 0 }}
        />
      )}
    </div>
  );
}
function PageHead({ section, action }: { section: string; action?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{labels[section] ?? 'Rudder'}</h1>
        <p className="muted" style={{ margin: 0 }}>
          Manage real publishing operations and review every outcome.
        </p>
      </div>
      {action}
    </div>
  );
}
function ConfigurationRequired() {
  return (
    <>
      <PageHead section="overview" />
      <div className="card panel">
        <h2>Connect Supabase to begin</h2>
        <p className="muted">
          The application is installed, but no project configuration is present. Copy the
          environment template, add your Supabase URL and public anon key, apply the migrations,
          then restart the app.
        </p>
        <Link className="btn" href="/onboarding">
          Open setup wizard
        </Link>
      </div>
    </>
  );
}
function NoWorkspace() {
  return (
    <>
      <PageHead section="overview" />
      <div className="card empty">
        <h2>No workspace yet</h2>
        <p>Finish onboarding to create your first organisation.</p>
        <Link className="btn" href="/onboarding">
          Start onboarding
        </Link>
      </div>
    </>
  );
}
function Loading() {
  return (
    <div className="card empty" role="status">
      Loading workspace…
    </div>
  );
}
function Section({ section, orgId }: { section: string; orgId: string }) {
  if (section === 'overview') return <Overview orgId={orgId} />;
  if (section === 'campaigns') return <Campaigns orgId={orgId} />;
  if (section === 'content') return <ContentLibrary orgId={orgId} />;
  if (section === 'captions') return <Captions orgId={orgId} />;
  if (section === 'composer') return <Composer orgId={orgId} />;
  if (section === 'calendar') return <Calendar orgId={orgId} />;
  if (section === 'facebook-pages') return <Pages orgId={orgId} />;
  if (section === 'facebook-groups') return <Groups orgId={orgId} />;
  if (section === 'queue') return <Queue orgId={orgId} />;
  if (section === 'devices') return <Devices orgId={orgId} />;
  if (section === 'analytics') return <Analytics orgId={orgId} />;
  if (section === 'activity') return <Activity orgId={orgId} />;
  if (section === 'settings') return <SettingsView orgId={orgId} />;
  return <div className="card empty">Section not found.</div>;
}
function useRows(table: string, orgId: string) {
  return useQuery<Row[]>({
    queryKey: [table, orgId],
    queryFn: async () => (await list(table, orgId)) as Row[],
    refetchInterval: table === 'publishing_jobs' || table === 'devices' ? 30000 : false,
  });
}
function Overview({ orgId }: { orgId: string }) {
  const jobs = useRows('publishing_jobs', orgId);
  const devices = useRows('devices', orgId);
  const rows = jobs.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const counts = {
    scheduled: rows.filter((r) => String(r.scheduled_for).startsWith(today)).length,
    published: rows.filter((r) => r.status === 'published').length,
    pending: rows.filter((r) =>
      ['scheduled', 'ready', 'claimed', 'publishing', 'awaiting_confirmation'].includes(r.status),
    ).length,
    failed: rows.filter((r) => ['failed', 'requires_attention'].includes(r.status)).length,
  };
  return (
    <>
      <PageHead
        section="overview"
        action={
          <Link href="/dashboard/composer" className="btn">
            <Plus size={16} />
            Create post
          </Link>
        }
      />
      <div className="grid metrics">
        {Object.entries(counts).map(([k, v]) => (
          <div className="card metric" key={k}>
            <div className="label">
              {k === 'scheduled' ? 'Scheduled today' : k[0]!.toUpperCase() + k.slice(1)}
            </div>
            <div className="value">{jobs.isLoading ? '—' : v}</div>
          </div>
        ))}
      </div>
      <div className="grid two-col">
        <div className="card panel">
          <div className="panel-head">
            <h2>Seven-day publishing</h2>
            <span className="muted">Internal statistics</span>
          </div>
          <MiniChart rows={rows} />
        </div>
        <div className="card panel">
          <div className="panel-head">
            <h2>Agent status</h2>
            <Link href="/dashboard/devices">
              <ChevronRight size={18} />
            </Link>
          </div>
          {devices.data?.length ? (
            devices.data.slice(0, 4).map((d) => (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <span>{d.name}</span>
                <Status
                  value={
                    Date.now() - new Date(d.last_heartbeat_at ?? 0).getTime() < 120000
                      ? 'online'
                      : 'offline'
                  }
                />
              </div>
            ))
          ) : (
            <Empty text="No registered devices" />
          )}
        </div>
      </div>
      <div className="card panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <h2>Next scheduled posts</h2>
          <Link href="/dashboard/queue">View queue</Link>
        </div>
        <DataTable
          rows={rows.filter((r) => ['scheduled', 'ready'].includes(r.status)).slice(0, 6)}
          columns={['status', 'scheduled_for', 'attempt_count', 'last_error_message']}
        />
      </div>
    </>
  );
}
function MiniChart({ rows }: { rows: Row[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const key = d.toISOString().slice(0, 10);
    return {
      key,
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      value: rows.filter((r) => r.status === 'published' && String(r.published_at).startsWith(key))
        .length,
    };
  });
  const max = Math.max(1, ...days.map((d) => d.value));
  return (
    <div className="chart">
      {days.map((d) => (
        <div className="bar-group" key={d.key}>
          <div
            className="bar"
            title={`${d.value} published`}
            style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }}
          />
          <small>{d.label}</small>
        </div>
      ))}
    </div>
  );
}
function Campaigns({ orgId }: { orgId: string }) {
  const q = useRows('campaigns', orgId);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  async function save(fd: FormData) {
    await create('campaigns', {
      organisation_id: orgId,
      name: fd.get('name'),
      description: fd.get('description'),
      category: fd.get('category'),
      timezone: fd.get('timezone'),
      starts_on: fd.get('starts_on'),
      ends_on: fd.get('ends_on') || null,
      daily_limit: Number(fd.get('daily_limit')),
      minimum_interval_minutes: Number(fd.get('interval')),
      created_by: (await browserClient().auth.getUser()).data.user!.id,
    });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ['campaigns'] });
  }
  return (
    <>
      <PageHead
        section="campaigns"
        action={
          <button className="btn" onClick={() => setOpen(true)}>
            <Plus size={16} />
            New campaign
          </button>
        }
      />
      <ResourceTable
        rows={q.data ?? []}
        columns={['name', 'category', 'status', 'starts_on', 'daily_limit']}
        actions={(r) => (
          <CampaignActions
            row={r}
            refresh={() => qc.invalidateQueries({ queryKey: ['campaigns'] })}
          />
        )}
      />
      {open && (
        <Modal title="Create campaign" close={() => setOpen(false)}>
          <Form action={save}>
            <Field name="name" label="Campaign name" required />
            <Field name="category" label="Category" defaultValue="General" />
            <Field name="description" label="Description" area span />
            <Field
              name="starts_on"
              label="Start date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
            <Field name="ends_on" label="End date" type="date" />
            <Field name="timezone" label="Time zone" defaultValue="Africa/Nairobi" required />
            <Field name="daily_limit" label="Daily limit" type="number" defaultValue="5" required />
            <Field
              name="interval"
              label="Minimum interval (minutes)"
              type="number"
              defaultValue="60"
              required
            />
          </Form>
        </Modal>
      )}
    </>
  );
}
function CampaignActions({ row, refresh }: { row: Row; refresh: () => void }) {
  async function setStatus(status: string) {
    await update('campaigns', row.id, { status });
    refresh();
  }
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {row.status === 'paused' ? (
        <button className="btn secondary" onClick={() => setStatus('active')}>
          Resume
        </button>
      ) : (
        <button className="btn secondary" onClick={() => setStatus('paused')}>
          Pause
        </button>
      )}
      <button className="btn secondary" onClick={() => setStatus('archived')}>
        <Archive size={14} />
      </button>
    </div>
  );
}
function ContentLibrary({ orgId }: { orgId: string }) {
  const q = useRows('media_assets', orgId);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 104857600) throw new Error(`${file.name} exceeds 100 MB`);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        const path = `${orgId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const db = browserClient();
        const stored = await db.storage
          .from('media')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (stored.error) throw stored.error;
        const user = (await db.auth.getUser()).data.user!;
        await create('media_assets', {
          organisation_id: orgId,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          byte_size: file.size,
          sha256: hash,
          created_by: user.id,
        });
      }
      qc.invalidateQueries({ queryKey: ['media_assets'] });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        section="content"
        action={
          <label className="btn">
            <Plus size={16} />
            {busy ? 'Uploading…' : 'Upload files'}
            <input
              hidden
              type="file"
              multiple
              accept="image/*,video/mp4,application/pdf"
              onChange={(e) => upload(e.target.files)}
              disabled={busy}
            />
          </label>
        }
      />
      <div className="notice" style={{ marginBottom: 16 }}>
        Private Supabase Storage · images, MP4 video, and PDF · 100 MB per file · duplicate
        detection by SHA-256
      </div>
      <ResourceTable
        rows={q.data ?? []}
        columns={['file_name', 'mime_type', 'byte_size', 'folder', 'created_at']}
        empty="No media uploaded yet."
      />
    </>
  );
}
function Captions({ orgId }: { orgId: string }) {
  const q = useRows('captions', orgId);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  async function save(fd: FormData) {
    const body = String(fd.get('body') ?? '').trim();
    if (!body) throw new Error('Caption body cannot be blank');
    await create('captions', {
      organisation_id: orgId,
      title: fd.get('title'),
      body,
      call_to_action: fd.get('cta'),
      link: fd.get('link') || null,
      hashtags: String(fd.get('hashtags') ?? '')
        .split(/\s+/)
        .filter(Boolean),
      tags: String(fd.get('tags') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      created_by: (await browserClient().auth.getUser()).data.user!.id,
    });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ['captions'] });
  }
  return (
    <>
      <PageHead
        section="captions"
        action={
          <button className="btn" onClick={() => setOpen(true)}>
            <Plus size={16} />
            New caption
          </button>
        }
      />
      <ResourceTable
        rows={q.data ?? []}
        columns={['title', 'body', 'category', 'created_at']}
        empty="Your approved captions will appear here."
      />
      {open && (
        <Modal title="Create caption" close={() => setOpen(false)}>
          <Form action={save}>
            <Field name="title" label="Title" required />
            <Field name="body" label="Caption body" area span required />
            <Field name="cta" label="Call to action" />
            <Field name="link" label="Link" type="url" />
            <Field name="hashtags" label="Hashtags (space-separated)" />
            <Field name="tags" label="Tags (comma-separated)" />
          </Form>
        </Modal>
      )}
    </>
  );
}
function Composer({ orgId }: { orgId: string }) {
  const campaigns = useRows('campaigns', orgId),
    captions = useRows('captions', orgId),
    destinations = useRows('destinations', orgId),
    media = useRows('media_assets', orgId);
  const [message, setMessage] = useState('');
  async function submit(fd: FormData) {
    setMessage('');
    const ids = fd.getAll('destinations').map(String);
    const { error } = await browserClient().rpc('schedule_post', {
      p_organisation_id: orgId,
      p_campaign_id: fd.get('campaign') || null,
      p_caption_id: fd.get('caption') || null,
      p_caption_override: String(fd.get('override') || '') || null,
      p_destination_ids: ids,
      p_media_ids: fd.getAll('media').map(String),
      p_scheduled_for: new Date(String(fd.get('scheduled'))).toISOString(),
      p_timezone: 'Africa/Nairobi',
      p_mode: fd.get('mode'),
    });
    setMessage(error ? error.message : 'Post queued successfully.');
  }
  return (
    <>
      <PageHead section="composer" />
      <div className="card panel">
        <form className="form-grid" action={submit}>
          <SelectField name="campaign" label="Campaign" rows={campaigns.data ?? []} />
          <SelectField name="caption" label="Saved caption" rows={captions.data ?? []} />
          <Field name="override" label="Caption override (optional)" area span />
          <Field
            name="scheduled"
            label="Schedule time"
            type="datetime-local"
            defaultValue={new Date(Date.now() + 3600000).toISOString().slice(0, 16)}
            required
          />
          <div className="field">
            <label>Operating mode</label>
            <select name="mode" defaultValue="confirmation">
              <option value="confirmation">Confirmation (recommended)</option>
              <option value="autopilot">Autopilot (requires device acknowledgement)</option>
            </select>
          </div>
          <CheckList
            name="destinations"
            label="Destinations"
            rows={destinations.data ?? []}
            required
          />
          <CheckList
            name="media"
            label="Media (optional)"
            rows={(media.data ?? []).map((r) => ({ ...r, name: r.file_name }))}
          />
          <div className="span-2 notice">
            Group posts default to confirmation mode. The extension prepares the post; you approve
            the final click.
          </div>
          {message && (
            <div className="span-2" role="status">
              {message}
            </div>
          )}
          <button className="btn span-2">Submit to queue</button>
        </form>
      </div>
    </>
  );
}
function Calendar({ orgId }: { orgId: string }) {
  const jobs = useRows('publishing_jobs', orgId);
  const [view, setView] = useState('month');
  return (
    <>
      <PageHead section="calendar" />
      <div className="toolbar">
        {['month', 'week', 'agenda'].map((v) => (
          <button
            className={`btn ${view === v ? '' : 'secondary'}`}
            onClick={() => setView(v)}
            key={v}
          >
            {v[0]!.toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
      <div className="card panel">
        <h2>{view[0]!.toUpperCase() + view.slice(1)} schedule</h2>
        <DataTable
          rows={jobs.data ?? []}
          columns={['scheduled_for', 'status', 'attempt_count', 'external_post_url']}
        />
      </div>
    </>
  );
}
function Pages({ orgId }: { orgId: string }) {
  const q = useRows('facebook_page_connections', orgId);
  return (
    <>
      <PageHead
        section="facebook-pages"
        action={
          <a className="btn" href={`/api/meta/connect?organisation=${orgId}`}>
            Connect Meta
          </a>
        }
      />
      <div className="notice" style={{ marginBottom: 16 }}>
        Uses Meta’s official Graph API. Page tokens are encrypted and exchanged server-side; app
        secrets never enter the browser.
      </div>
      <ResourceTable
        rows={q.data ?? []}
        columns={['page_name', 'page_id', 'status', 'permissions', 'token_expires_at']}
        empty="No Facebook Pages connected."
      />
    </>
  );
}
function Groups({ orgId }: { orgId: string }) {
  const q = useRows('facebook_groups', orgId);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  async function save(fd: FormData) {
    const group = await create('facebook_groups', {
      organisation_id: orgId,
      name: fd.get('name'),
      url: canonicalFacebookGroupUrl(fd.get('url')),
      rules_notes: fd.get('notes'),
      promotions_allowed: fd.get('promotions') === 'on',
      approval_required: fd.get('approval') === 'on',
      confirmation_only: true,
      created_by: (await browserClient().auth.getUser()).data.user!.id,
    });
    await create('destinations', {
      organisation_id: orgId,
      kind: 'group',
      group_id: group.id,
      name: group.name,
    });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ['facebook_groups'] });
  }
  return (
    <>
      <PageHead
        section="facebook-groups"
        action={
          <button className="btn" onClick={() => setOpen(true)}>
            <Plus size={16} />
            Add group
          </button>
        }
      />
      <div className="notice" style={{ marginBottom: 16 }}>
        Only add groups where you are allowed to post. Rudder does not scrape your membership list
        or store Facebook sessions.
      </div>
      <ResourceTable
        rows={q.data ?? []}
        columns={[
          'name',
          'url',
          'active',
          'confirmation_only',
          'promotions_allowed',
          'excluded_until',
        ]}
        empty="No approved groups added."
      />
      {open && (
        <Modal title="Add approved group" close={() => setOpen(false)}>
          <Form action={save}>
            <Field name="name" label="Group name" required />
            <Field name="url" label="Facebook Group URL" type="url" required />
            <Field name="notes" label="Rules and notes" area span />
            <Check name="promotions" label="Promotions are allowed" />
            <Check name="approval" label="Posts require admin approval" />
          </Form>
        </Modal>
      )}
    </>
  );
}
function Queue({ orgId }: { orgId: string }) {
  const q = useRows('publishing_jobs', orgId);
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const rows = (q.data ?? []).filter((r) => filter === 'all' || r.status === filter);
  async function act(id: string, action: string) {
    const { error } = await browserClient().rpc('job_action', { p_job_id: id, p_action: action });
    if (error) alert(error.message);
    qc.invalidateQueries({ queryKey: ['publishing_jobs'] });
  }
  return (
    <>
      <PageHead
        section="queue"
        action={
          <button className="btn secondary" onClick={() => q.refetch()}>
            <RefreshCw size={15} />
            Refresh
          </button>
        }
      />
      <div className="toolbar">
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {[
            'draft',
            'scheduled',
            'ready',
            'claimed',
            'awaiting_confirmation',
            'publishing',
            'published',
            'failed',
            'skipped',
            'cancelled',
            'requires_attention',
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <ResourceTable
        rows={rows}
        columns={[
          'status',
          'scheduled_for',
          'attempt_count',
          'assigned_device_id',
          'last_error_code',
          'published_at',
        ]}
        actions={(r) => (
          <div style={{ display: 'flex', gap: 5 }}>
            {['failed', 'requires_attention'].includes(r.status) && (
              <button className="btn secondary" onClick={() => act(r.id, 'retry')}>
                Retry
              </button>
            )}
            {!['published', 'cancelled', 'skipped'].includes(r.status) && (
              <>
                <button className="btn secondary" onClick={() => act(r.id, 'skip')}>
                  Skip
                </button>
                <button className="btn secondary" onClick={() => act(r.id, 'cancel')}>
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      />
    </>
  );
}
function Devices({ orgId }: { orgId: string }) {
  const q = useRows('devices', orgId);
  const [token, setToken] = useState('');
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  async function save(fd: FormData) {
    const { data, error } = await browserClient().rpc('register_device', {
      p_organisation_id: orgId,
      p_name: fd.get('name'),
      p_type: fd.get('type'),
      p_os: navigator.platform,
      p_version: '1.0.0',
    });
    if (error) throw error;
    setToken(data.deviceToken);
    setOpen(false);
    qc.invalidateQueries({ queryKey: ['devices'] });
  }
  const rows = (q.data ?? []).map((d) => ({
    ...d,
    online:
      Date.now() - new Date(d.last_heartbeat_at ?? 0).getTime() < 120000 ? 'online' : 'offline',
  }));
  return (
    <>
      <PageHead
        section="devices"
        action={
          <button className="btn" onClick={() => setOpen(true)}>
            <Plus size={16} />
            Register device
          </button>
        }
      />
      {token && (
        <div className="notice" style={{ marginBottom: 16 }}>
          Copy this one-time device token into the extension or desktop agent now:{' '}
          <code>{token}</code>
        </div>
      )}
      <ResourceTable
        rows={rows}
        columns={[
          'name',
          'type',
          'online',
          'last_heartbeat_at',
          'mode',
          'completed_today',
          'recent_error',
        ]}
        empty="No devices registered."
      />
      {open && (
        <Modal title="Register device" close={() => setOpen(false)}>
          <Form action={save}>
            <Field name="name" label="Device name" required />
            <div className="field">
              <label>Type</label>
              <select name="type">
                <option value="chrome_extension">Chrome extension</option>
                <option value="desktop_agent">Desktop agent</option>
              </select>
            </div>
          </Form>
        </Modal>
      )}
    </>
  );
}
function Analytics({ orgId }: { orgId: string }) {
  const q = useRows('publishing_jobs', orgId);
  const rows = q.data ?? [];
  const published = rows.filter((r) => r.status === 'published').length,
    failed = rows.filter((r) => ['failed', 'requires_attention'].includes(r.status)).length,
    total = published + failed;
  return (
    <>
      <PageHead section="analytics" />
      <div className="grid metrics">
        <Metric label="Published" value={published} />
        <Metric
          label="Success rate"
          value={total ? `${Math.round((published / total) * 100)}%` : '—'}
        />
        <Metric
          label="Failure rate"
          value={total ? `${Math.round((failed / total) * 100)}%` : '—'}
        />
        <Metric
          label="Total attempts"
          value={rows.reduce((n, r) => n + (r.attempt_count ?? 0), 0)}
        />
      </div>
      <div className="card panel" style={{ marginTop: 16 }}>
        <h2>Publishing-time distribution</h2>
        <MiniChart rows={rows} />
        <p className="muted">
          These are Rudder’s internal delivery statistics. Facebook engagement is shown only when
          returned by Meta.
        </p>
      </div>
    </>
  );
}
function Activity({ orgId }: { orgId: string }) {
  const q = useRows('activity_logs', orgId);
  const [search, setSearch] = useState('');
  const rows = (q.data ?? []).filter((r) =>
    JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHead section="activity" />
      <div className="toolbar">
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 12 }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Search activity"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <ResourceTable
        rows={rows}
        columns={['created_at', 'action', 'entity_type', 'summary', 'actor_id']}
      />
    </>
  );
}
function SettingsView({ orgId }: { orgId: string }) {
  const q = useRows('system_settings', orgId);
  const settings = q.data?.[0];
  const qc = useQueryClient();
  async function save(fd: FormData) {
    await update('system_settings', orgId, {
      default_mode: fd.get('mode'),
      daily_limit: Number(fd.get('daily')),
      minimum_interval_minutes: Number(fd.get('interval')),
      heartbeat_timeout_seconds: Number(fd.get('timeout')),
    });
    qc.invalidateQueries({ queryKey: ['system_settings'] });
  }
  async function exportData() {
    const response = await fetch(`/api/account/export?organisation=${orgId}`);
    if (!response.ok) return alert((await response.json()).error ?? 'Export failed');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = `rudder-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function deleteAccount() {
    const confirmation = prompt(
      'Type DELETE MY RUDDER ACCOUNT to permanently delete this organisation and your account.',
    );
    if (!confirmation) return;
    const response = await fetch('/api/account/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organisationId: orgId, confirmation }),
    });
    const result = await response.json();
    if (!response.ok) return alert(result.error ?? 'Deletion failed');
    location.href = '/sign-in';
  }
  return (
    <>
      <PageHead section="settings" />
      <div className="grid two-col">
        <div className="card panel">
          <h2>Publishing defaults</h2>
          <Form action={save}>
            <div className="field">
              <label>Default mode</label>
              <select name="mode" defaultValue={settings?.default_mode ?? 'confirmation'}>
                <option value="confirmation">Confirmation</option>
                <option value="autopilot">Autopilot</option>
              </select>
            </div>
            <Field
              name="daily"
              label="Daily limit"
              type="number"
              defaultValue={String(settings?.daily_limit ?? 10)}
            />
            <Field
              name="interval"
              label="Minimum interval (minutes)"
              type="number"
              defaultValue={String(settings?.minimum_interval_minutes ?? 60)}
            />
            <Field
              name="timeout"
              label="Offline timeout (seconds)"
              type="number"
              defaultValue={String(settings?.heartbeat_timeout_seconds ?? 120)}
            />
          </Form>
        </div>
        <div className="card panel">
          <h2>Security & data</h2>
          <p className="muted">
            Tokens are server-only. Group sessions remain inside Chrome. Data export and account
            deletion require an owner-confirmed server operation.
          </p>
          <button className="btn secondary" onClick={exportData}>
            Export organisation data
          </button>
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '20px 0' }} />
          <button className="btn danger" onClick={deleteAccount}>
            Delete account and organisation
          </button>
        </div>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card metric">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
function Status({ value }: { value: string }) {
  return <span className={`badge ${value}`}>{value.replaceAll('_', ' ')}</span>;
}
function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
function DataTable({
  rows,
  columns,
  actions,
}: {
  rows: Row[];
  columns: string[];
  actions?: ((r: Row) => React.ReactNode) | undefined;
}) {
  if (!rows.length) return <Empty text="No records yet." />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c.replaceAll('_', ' ')}</th>
            ))}
            {actions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i}>
              {columns.map((c) => (
                <td key={c}>
                  {c === 'status' || c === 'online' ? (
                    <Status value={String(r[c] ?? '—')} />
                  ) : (
                    format(r[c])
                  )}
                </td>
              ))}
              {actions && <td>{actions(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function ResourceTable({
  rows,
  columns,
  actions,
  empty,
}: {
  rows: Row[];
  columns: string[];
  actions?: ((r: Row) => React.ReactNode) | undefined;
  empty?: string;
}) {
  return (
    <div className="card panel">
      <DataTable rows={rows} columns={columns} actions={actions} />
      {!rows.length && empty && <span className="sr-only">{empty}</span>}
    </div>
  );
}
function format(v: any) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.join(', ') || '—';
  const s = String(v);
  if (/^\d{4}-\d\d-\d\dT/.test(s)) return new Date(s).toLocaleString();
  if (s.length > 90) return s.slice(0, 87) + '…';
  return s;
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="modal card">
        <div className="panel-head">
          <h2>{title}</h2>
          <button className="btn secondary" onClick={close} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Form({
  action,
  children,
}: {
  action: (fd: FormData) => Promise<void>;
  children: React.ReactNode;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await action(new FormData(e.currentTarget));
        } catch (x) {
          setError(x instanceof Error ? x.message : 'Could not save');
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      {error && <div className="error span-2">{error}</div>}
      <button className="btn span-2" disabled={busy}>
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
function Field({
  name,
  label,
  type = 'text',
  defaultValue,
  required,
  area,
  span,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  area?: boolean;
  span?: boolean;
}) {
  return (
    <div className={`field ${span ? 'span-2' : ''}`}>
      <label htmlFor={name}>{label}</label>
      {area ? (
        <textarea id={name} name={name} rows={5} required={required} defaultValue={defaultValue} />
      ) : (
        <input id={name} name={name} type={type} required={required} defaultValue={defaultValue} />
      )}
    </div>
  );
}
function Check({ name, label }: { name: string; label: string }) {
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input type="checkbox" name={name} />
      {label}
    </label>
  );
}
function SelectField({ name, label, rows }: { name: string; label: string; rows: Row[] }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select name={name}>
        <option value="">None</option>
        {rows.map((r) => (
          <option value={r.id} key={r.id}>
            {r.name ?? r.title}
          </option>
        ))}
      </select>
    </div>
  );
}
function CheckList({
  name,
  label,
  rows,
  required,
}: {
  name: string;
  label: string;
  rows: Row[];
  required?: boolean;
}) {
  return (
    <fieldset className="field">
      <label>{label}</label>
      <div className="card" style={{ padding: 12, maxHeight: 150, overflow: 'auto' }}>
        {rows.length ? (
          rows.map((r, i) => (
            <label key={r.id} style={{ display: 'flex', gap: 8, padding: 5 }}>
              <input type="checkbox" name={name} value={r.id} required={required && i === 0} />
              {r.name}
            </label>
          ))
        ) : (
          <span className="muted">None available</span>
        )}
      </div>
    </fieldset>
  );
}
