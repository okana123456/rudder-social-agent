# Windows desktop agent

The Electron tray agent uses Supabase device records for coordination; it does not talk directly to the extension. It sends a heartbeat every 45 seconds, shows pending counts and Windows notifications, and provides Start, Pause, Resume, Open Dashboard, Launch Chrome, startup toggle, settings, and Quit.

Run `npm run dev:desktop` for development. Register a `desktop_agent` device in the dashboard, open tray **Connection settings**, and enter the Supabase public configuration and one-time device token. The token is encrypted with Electron `safeStorage` backed by Windows protection.

Build an installer on Windows with `npm run package:windows`. Output is under `apps/desktop-agent/release`. Code signing is strongly recommended for distribution; configure Electron Builder's Windows certificate environment without committing it. On graceful shutdown the agent stops heartbeats. It never marks jobs complete, so unfinished work stays pending or is recovered after lease expiry.
