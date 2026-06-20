# Custom Domain Setup Guide

This guide walks through connecting the custom domain `dev.peercoachingnetwork.com` to the Firebase Hosting dev project (`peer-coaching-network-dev`).

## Prerequisites

- Ownership of the domain `peercoachingnetwork.com`
- Access to the domain's DNS management panel
- Owner/Editor role on the [Firebase Console](https://console.firebase.google.com/project/peer-coaching-network-dev) project
- Owner/Editor role on the [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=peer-coaching-network-dev) project

---

## Step 1 — Firebase Hosting: Connect Custom Domain

1. Open [Firebase Console → Hosting](https://console.firebase.google.com/project/peer-coaching-network-dev/hosting/sites).
2. Click **"Add custom domain"**.
3. Enter: `dev.peercoachingnetwork.com`
4. Firebase will display:
   - A **TXT record** for domain ownership verification.
   - **Two A records** (IP addresses) for pointing the domain to Firebase Hosting.
5. Note down all three records — you will add them in the next step.

---

## Step 2 — DNS Configuration

In your DNS provider's management panel for `peercoachingnetwork.com`, add the following records.

### 2a. Domain Verification (TXT Record)

| Record Type | Host / Name | Value                              | TTL  |
|-------------|-------------|------------------------------------|------|
| `TXT`       | `dev`       | *(verification string from Firebase)* | 3600 |

> **Note**: Some DNS providers require the full hostname `dev.peercoachingnetwork.com.` (with trailing dot) instead of just `dev`.

### 2b. Hosting A Records

| Record Type | Host / Name | Value                                     | TTL  |
|-------------|-------------|-------------------------------------------|------|
| `A`         | `dev`       | *(1st IP address from Firebase — e.g. 151.101.1.195)*  | 3600 |
| `A`         | `dev`       | *(2nd IP address from Firebase — e.g. 151.101.65.195)* | 3600 |

> **Important**: The exact IP addresses are provided by Firebase during the custom domain setup wizard. Do not use the example IPs above.

### Cloudflare Users

If your DNS provider is **Cloudflare**, set the proxy status to **"DNS Only"** (grey cloud ☁️) for the A records. Firebase needs direct DNS resolution to provision and renew the SSL certificate. After the SSL certificate is provisioned, you can optionally switch back to proxied mode.

### DNS Propagation

After adding the DNS records:
- Propagation typically completes within **minutes** but can take up to **48 hours**.
- Firebase will auto-provision a **free SSL certificate** once DNS is verified.
- Monitor progress in the Firebase Console → Hosting → Custom domains panel.

---

## Step 3 — Firebase Auth: Authorize the Custom Domain

1. Open [Firebase Console → Authentication → Settings](https://console.firebase.google.com/project/peer-coaching-network-dev/authentication/settings).
2. Scroll to **"Authorized domains"**.
3. Click **"Add domain"** and add: `dev.peercoachingnetwork.com`
4. Verify these domains are already present:
   - `peer-coaching-network-dev.firebaseapp.com`
   - `peer-coaching-network-dev.web.app`
   - `localhost`

> **Why?** Firebase Auth blocks sign-in requests from domains not in this list. Without this step, Google Sign-In will fail on the custom domain with an `auth/unauthorized-domain` error.

---

## Step 4 — Google Cloud Console: Update OAuth Credentials

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=peer-coaching-network-dev).
2. Under **OAuth 2.0 Client IDs**, click on the **Web client** used by Firebase Auth.
3. Under **"Authorized JavaScript origins"**, click **"Add URI"** and add:
   ```
   https://dev.peercoachingnetwork.com
   ```
4. Under **"Authorized redirect URIs"**, click **"Add URI"** and add:
   ```
   https://dev.peercoachingnetwork.com/__/auth/handler
   ```
5. Verify these existing entries are still present:

   **JavaScript origins:**
   - `https://peer-coaching-network-dev.firebaseapp.com`
   - `http://localhost` *(for local development)*
   - `http://localhost:5173` *(Vite dev server)*

   **Redirect URIs:**
   - `https://peer-coaching-network-dev.firebaseapp.com/__/auth/handler`

6. Click **"Save"**.

> **Why?** Google OAuth validates that sign-in requests originate from authorized domains. Without this step, the Google Sign-In popup will show an `redirect_uri_mismatch` error.

---

## Step 5 — Local Environment Configuration

Update your local `.env.dev` file to use the custom domain as the `authDomain`:

```bash
# Before
VITE_FIREBASE_AUTH_DOMAIN="peer-coaching-network-dev.firebaseapp.com"

# After
VITE_FIREBASE_AUTH_DOMAIN="dev.peercoachingnetwork.com"
```

If setting up a new development environment, copy the example file:

```bash
cp .env.dev.example .env.dev
# Then fill in the API key, app ID, and messaging sender ID from Firebase Console
```

---

## Step 6 — Deploy & Verify

Build and deploy the application:

```bash
make build
npx -y firebase-tools@latest deploy --only hosting
```

### Verification Checklist

| Check | URL | Expected |
|---|---|---|
| Page loads with SSL | `https://dev.peercoachingnetwork.com` | ✅ Valid HTTPS, app renders |
| Google Sign-In works | Click "Sign in with Google" | ✅ Popup shows custom domain, sign-in succeeds |
| Firestore connection | Sign in → Dashboard loads | ✅ Coach data loads from Firestore |
| Calendar integration | Book a session | ✅ Google Calendar event created |
| Default domain still works | `https://peer-coaching-network-dev.web.app` | ✅ App still accessible |
| Local dev works | `http://localhost:5173` (via `make dev`) | ✅ App runs locally |

---

## Troubleshooting

### SSL Certificate Not Provisioning
- Ensure DNS A records point directly to Firebase (not proxied through Cloudflare).
- Wait up to 48 hours for DNS propagation.
- Check Firebase Console → Hosting for status updates.

### `auth/unauthorized-domain` Error
- Verify the custom domain is in Firebase Auth → Authorized domains (Step 3).

### `redirect_uri_mismatch` Error  
- Verify the redirect URI `https://dev.peercoachingnetwork.com/__/auth/handler` is in Google Cloud Console (Step 4).
- Changes to OAuth credentials can take up to 5 minutes to propagate.

### Sign-In Popup Blocked
- Ensure browser pop-up blocker is not blocking the sign-in window.
- The app uses `signInWithPopup` — not redirect-based auth.

---

## Authorized Domains Summary

After completing setup, these domains should allow access to the application:

| Domain | Purpose |
|---|---|
| `dev.peercoachingnetwork.com` | Custom domain for dev environment |
| `peer-coaching-network-dev.web.app` | Default Firebase Hosting domain |
| `peer-coaching-network-dev.firebaseapp.com` | Default Firebase Auth domain |
| `localhost` / `localhost:5173` | Local development |
