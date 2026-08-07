# Chrome extension

Build with `npm run build:extension`. In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `apps/chrome-extension/dist`.

Register a Chrome extension device in the dashboard. Open extension settings and enter the dashboard URL, Supabase URL, public anon key, device ID, and one-time device token. The token is revocable and is not a Facebook session. Test the connection.

Confirmation is default: the extension claims one job, verifies the exact Group path, checks for login/checkpoint/CAPTCHA/restriction states, opens the composer, inserts approved content, and displays its own review panel. Only **Approve & Publish** clicks Facebook's Post button. It then verifies an outcome before marking success. If verification is ambiguous, the job becomes `requires_attention` to prevent duplicates.

Autopilot requires an explicit acknowledgement, is constrained by session limits, remains visible, and stops on unexpected UI. It is not promised to be undetectable or stable; Facebook DOM changes can require updates to `src/selectors.ts`. Emergency stop pauses the registered device and removes the review panel.

For Chrome Web Store readiness, replace development branding/icon assets, provide privacy disclosures for device telemetry and optional screenshots, build a ZIP, run store validation, and justify the limited host permissions. Do not add cookie permissions.
