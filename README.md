<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/61989762-59fb-44b8-a05f-25d7c76028c4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy [.env.example](.env.example) to `.env` and configure the Supabase URL, service-role key, session secret, and one-time administrator bootstrap password.
3. Run the app:
   `npm run dev`

## Passkey / Fingerprint Authentication

Passkey registration requires an active employee session established with the existing Employee ID and password login. After signing in, open **Employee Authentication** and use **Register Fingerprint** in the Device Passkeys panel.

Deployment requirements:

- Serve the app over HTTPS. WebAuthn does not work in production over plain HTTP.
- Set `WEBAUTHN_RP_ID` to the deployed hostname only, for example `incubator.example.com`.
- Set `WEBAUTHN_ORIGINS` to the exact HTTPS origin, for example `https://incubator.example.com`.
- Set `APP_URL` to the same deployed HTTPS origin.
- Android passkey testing requires Android Chrome or a compatible Chromium browser and an enrolled screen lock / fingerprint or other platform biometric.

The server stores only credential IDs, public keys, counters, transports, and passkey metadata in Supabase. It never receives or stores fingerprint images or biometric samples. Password login remains available as the backup method.
