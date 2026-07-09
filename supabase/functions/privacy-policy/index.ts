import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CatchMap Privacy Policy</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 720px; margin: 0 auto; padding: 24px; color: #111; }
    h1 { font-size: 1.5rem; }
    h2 { font-size: 1.1rem; margin-top: 1.5rem; }
    p, li { color: #333; }
    .muted { color: #666; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>CatchMap: Fishing Spots &amp; Log — Privacy Policy</h1>
  <p class="muted">Last updated: July 9, 2026</p>
  <p>CatchMap helps anglers discover fishing spots, view conditions, and log catches. This policy explains what data the app collects and how we use it.</p>
  <h2>Information we collect</h2>
  <ul>
    <li><strong>Location (optional)</strong> — Used to show nearby fishing spots on the map. Not sold or used for advertising.</li>
    <li><strong>Account (optional)</strong> — Email and password if you sign in for cloud backup. Managed by Supabase Auth.</li>
    <li><strong>Catch logs</strong> — Stored <strong>locally on your device</strong> by default. When signed in, catches and photos may sync to your private cloud account (protected by row-level security).</li>
    <li><strong>Community contribution (opt-in per catch)</strong> — If you enable sharing on a catch log, anonymized species, lure, and approximate area data may contribute to community bite insights. Your name and exact GPS are never shared.</li>
    <li><strong>Photos (optional)</strong> — Stored on your device; uploaded to private cloud storage only when signed in and attached to a catch. If you use Catch AI species identification, photos are sent directly to Google Gemini using <strong>your own API key</strong> stored on your device — CatchMap does not host or pay for AI processing.</li>
    <li><strong>Map &amp; species data</strong> — Loaded from our backend over HTTPS.</li>
    <li><strong>Personal patterns</strong> — Bite fingerprints, trip feedback, and pattern-match alerts are computed on your device from your catch history.</li>
    <li><strong>Feedback (optional)</strong> — Message, category, app version, platform, optional email.</li>
    <li><strong>Crash diagnostics (optional)</strong> — If enabled, anonymous crash reports may be sent to help fix stability issues. No catch content or exact location is included.</li>
  </ul>
  <h2>Information we do not collect</h2>
  <ul>
    <li>No sale of personal data</li>
    <li>No advertising identifiers</li>
    <li>No exact GPS in community aggregates</li>
  </ul>
  <h2>Your choices</h2>
  <ul>
    <li>Use the app without an account — all catches stay local-only.</li>
    <li>Sign in to back up catches and waypoints across devices.</li>
    <li>Toggle community contribution per catch when logging.</li>
    <li>Delete local-only catches in Settings.</li>
    <li>Delete your account in Settings to permanently remove cloud data and your sign-in.</li>
  </ul>
  <h2>Contact</h2>
  <p>Settings → Send feedback in the app, or email <a href="mailto:support@catchmap.app">support@catchmap.app</a></p>
</body>
</html>`;

Deno.serve(() => {
  return new Response(HTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
