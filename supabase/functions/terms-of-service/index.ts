import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CatchMap Terms of Service</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 720px; margin: 0 auto; padding: 24px; color: #111; }
    h1 { font-size: 1.5rem; }
    h2 { font-size: 1.1rem; margin-top: 1.5rem; }
    p, li { color: #333; }
    .muted { color: #666; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>CatchMap: Fishing Spots &amp; Log — Terms of Service</h1>
  <p class="muted">Last updated: July 10, 2026</p>
  <p>These Terms govern your use of CatchMap ("the app"). By using the app, you agree to these Terms.</p>
  <h2>The service</h2>
  <p>CatchMap helps anglers discover fishing spots, view conditions and bite forecasts, and log catches. Map data, species information, and forecasts are provided for general guidance only — not as professional fishing, safety, or legal advice.</p>
  <h2>Your account</h2>
  <ul>
    <li>An account is optional. Without an account, catch data stays on your device only.</li>
    <li>You are responsible for keeping your sign-in credentials secure.</li>
    <li>You may delete your account at any time in Settings. Deletion permanently removes your cloud catches, photos, and waypoints.</li>
  </ul>
  <h2>Your content</h2>
  <ul>
    <li>You retain ownership of catch logs and photos you create.</li>
    <li>When you opt in to community contribution on a catch, you grant us permission to use anonymized species, lure, and approximate-area data to improve community bite insights. Your name and exact GPS are never shared.</li>
    <li>Do not upload unlawful, harmful, or misleading content.</li>
  </ul>
  <h2>CatchMap Pro (optional)</h2>
  <p>CatchMap Pro is an auto-renewing monthly subscription that unlocks hosted Catch AI (chat, photo species ID, coach enhancement), cloud backup, offline maps, trip planner, pattern alerts, and related features. Subscriptions renew automatically each month until cancelled in your App Store or Google Play account settings. AI requests are subject to a daily fair-use limit. Refunds are handled by Apple or Google per their store policies.</p>
  <h2>Catch AI</h2>
  <p>Free users can use the map and local catch log without AI. Pro subscribers use hosted AI through CatchMap servers (Google Gemini). You must not abuse AI features or attempt to bypass usage limits.</p>
  <h2>Acceptable use</h2>
  <ul>
    <li>Do not misuse, reverse engineer, or overload the service.</li>
    <li>Do not rely on the app as your only source of navigation, weather, or fishing regulations.</li>
    <li>Always follow local fishing laws, licenses, and safety practices.</li>
  </ul>
  <h2>Disclaimers</h2>
  <p>The app is provided "as is" without warranties. We do not guarantee forecast accuracy, spot availability, or uninterrupted service. To the fullest extent permitted by law, we are not liable for indirect or consequential damages arising from your use of the app.</p>
  <h2>Changes</h2>
  <p>We may update these Terms or the app. Continued use after changes means you accept the updated Terms.</p>
  <h2>Contact</h2>
  <p>Settings → Send feedback in the app, or email <a href="mailto:support@catchmap.app">support@catchmap.app</a></p>
</body>
</html>`;

Deno.serve(() => {
  return new Response(HTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
