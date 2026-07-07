# JOIN deployment

JOIN uses Vercel for the frontend and Render for the Node/Express API. Cloudflare tunnels are only useful for short local experiments and are not part of the production setup.

## 1. MongoDB Atlas

1. Create an Atlas database user with access only to the JOIN database.
2. In Atlas Network Access, allow Render's outbound IPs if you use an IP allowlist. For a first deployment, Atlas's documented temporary access option can help with diagnosis; restrict it again afterwards.
3. Copy the connection string and set it as Render's `MONGODB_URI`.

Never commit the URI, database password, JWT secret, or SMTP credentials.

## 2. Deploy the backend to Render

1. Push this repository to the Git provider connected to Render.
2. In Render, create a **Blueprint** from the repository and select `render.yaml`, or create a Web Service manually with:
   - Root directory: `backend`
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
3. Add these Render environment variables:

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | Atlas connection string |
   | `JWT_SECRET` | Unique random value, at least 32 characters |
   | `FRONTEND_URL` | Your Vercel production URL, for example `https://your-frontend.vercel.app` |
   | `SMTP_HOST` | SMTP hostname (optional until reset email is enabled) |
   | `SMTP_PORT` | SMTP port, typically `587` or `465` |
   | `SMTP_SECURE` | `true` for implicit TLS (usually port 465), otherwise `false` |
   | `SMTP_USER` | SMTP username |
   | `SMTP_PASS` | SMTP password or provider app password |
   | `MAIL_FROM` | Sender address, for example `JOIN <no-reply@example.com>` |

`FRONTEND_URL` may contain a comma-separated list of exact approved frontend origins when you intentionally need more than one Vercel domain. Keep it limited to domains you control.

4. After deployment, open:

   `https://your-backend-name.onrender.com/api/health`

   It must return:

   ```json
   { "status": "ok", "service": "JOIN API" }
   ```

## 3. Point Vercel at Render

Keep the existing Vercel project for the frontend.

1. Open **Vercel Project Settings → Environment Variables**.
2. Set this variable for Production (and Preview if desired):

   ```text
   EXPO_PUBLIC_API_URL=https://your-backend-name.onrender.com
   ```

3. Redeploy the Vercel frontend after saving the variable.
4. Update Render's `FRONTEND_URL` to the exact Vercel production origin. This enables CORS for the deployed app.

The React Native Web client reads this value through Expo configuration; API URLs are not hardcoded in individual screen components.

## Local development

Backend:

```powershell
cd backend
npm install
npm run dev
```

Frontend:

```powershell
cd frontend
npm install
npx expo start
```

For a web export:

```powershell
cd frontend
npm run build
npm run serve:web
```

Use `frontend/.env` locally with an API URL appropriate to your network, for example `http://localhost:4000`. Do not commit local credentials or temporary tunnel URLs.

## Phone testing

For normal testing, use Expo with `EXPO_PUBLIC_API_URL` set to the Render URL. A physical phone can then reach the same permanent API without a tunnel.

For browser testing on a phone, use the Vercel URL after the Vercel environment variable is configured and redeployed. The phone can be on mobile data or Wi-Fi because both Vercel and Render are public HTTPS services.

## Local backend + Cloudflare Quick Tunnel workflow

Use this only when you want the Vercel frontend to talk to the backend running on your notebook. This is a development workflow; Render remains the permanent backend host.

The idea:

1. Backend runs locally at `http://localhost:4000`.
2. Cloudflare Quick Tunnel exposes that local backend with a temporary `https://*.trycloudflare.com` URL.
3. The web app first tries to read `/runtime-config.json`.
4. If that file contains a real `apiUrl`, JOIN uses it as the API base URL.
5. If the runtime file is missing, invalid, or still has the placeholder URL, JOIN falls back to `EXPO_PUBLIC_API_URL`.

This keeps API URL logic centralized in the frontend API config. Components should not hardcode tunnel URLs.

### One-command helper

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-dev-tunnel.ps1
```

The script will:

- start `npm run dev` inside `backend`;
- start `cloudflared tunnel --url http://localhost:4000`;
- capture the generated `trycloudflare.com` URL;
- update `frontend/public/runtime-config.json` with:

  ```json
  {
    "apiUrl": "https://your-new-url.trycloudflare.com"
  }
  ```

- also update `frontend/.env` as a fallback with:

  ```text
  EXPO_PUBLIC_API_URL=https://your-new-url.trycloudflare.com
  ```

- save the latest tunnel URL to `scripts/.last-api-url`;
- print the health-check URL to test.

Keep the tunnel window open. When it closes, the Cloudflare URL stops working. The next tunnel run usually creates a new URL.

### Runtime config on Vercel

The web app fetches this file on startup:

```text
/runtime-config.json
```

For local web builds, changing `frontend/public/runtime-config.json` and refreshing the app is enough.

For Vercel, static deployments are immutable. That means Vercel cannot patch only `runtime-config.json` inside an existing deployment. You still need a Vercel deployment for the hosted `/runtime-config.json` file to change, but you no longer need to change Vercel environment variables or rebuild API URLs into app code.

Helper:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-runtime-config-to-vercel.ps1
```

The helper reads the latest tunnel URL and starts a Vercel production deploy from the frontend folder. It also explains the limitation before doing anything.

### Optional: update Vercel environment fallback

The runtime config should be preferred for this workflow. If you still want to update the Vercel fallback environment variable:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\update-vercel-api-url.ps1
```

Manual Vercel steps:

1. Open **Vercel Project Settings → Environment Variables**.
2. Set `EXPO_PUBLIC_API_URL` to the new Cloudflare tunnel URL.
3. Redeploy the Vercel frontend.

### Simple fallback helper

If you just want two terminal windows and manual copying:

```bat
scripts\start-join-dev.bat
```

This opens:

- backend dev server;
- Cloudflare Quick Tunnel.

Then copy the new `https://*.trycloudflare.com` URL into Vercel as `EXPO_PUBLIC_API_URL` and redeploy.

### Test the tunnel

Local backend:

```text
http://localhost:4000/api/health
```

Cloudflare backend:

```text
https://your-new-url.trycloudflare.com/api/health
```

Expected response:

```json
{ "status": "ok", "service": "JOIN API" }
```

### Common tunnel errors

#### `cloudflared` is not installed

Install it with:

```powershell
winget install --id Cloudflare.cloudflared
```

Then open a new terminal and run the script again.

#### Backend is not running

Check the backend terminal for TypeScript, MongoDB, or `.env` errors. The tunnel can exist while the backend behind it is broken, so always test `/api/health`.

#### Browser shows a CORS error

For this workflow, the local backend must allow the Vercel frontend origin. Set `FRONTEND_URL` in `backend/.env` to your exact Vercel URL, then restart `npm run dev`.

#### Vercel is still using the old API URL

Open:

```text
https://your-vercel-app.vercel.app/runtime-config.json
```

If it still shows the old URL, the deployed static file has not changed. Run the runtime deploy helper or deploy the frontend again.

If `/runtime-config.json` is missing or invalid, JOIN falls back to `EXPO_PUBLIC_API_URL`. Vercel embeds `EXPO_PUBLIC_API_URL` at build time, so changing that env variable still requires a redeploy.

#### Tunnel URL changed

Cloudflare Quick Tunnel URLs are temporary. Run the tunnel script again, update `runtime-config.json`, then deploy the updated runtime file to Vercel if you are testing from the hosted frontend.

## Troubleshooting

### The frontend says it cannot connect

- Confirm `EXPO_PUBLIC_API_URL` in Vercel is the Render URL, with no trailing path such as `/api`.
- Redeploy Vercel after changing the value; Expo public variables are embedded at build time.
- Confirm `GET /api/health` succeeds on the Render URL.

### Browser shows a CORS error

- Set Render `FRONTEND_URL` to the exact Vercel origin, including `https://` and without a trailing slash.
- If you use Vercel preview URLs, add only the exact preview origins you intend to test as comma-separated values in `FRONTEND_URL`.
- Localhost and private LAN origins are accepted only while `NODE_ENV=development`.

### Login or activity data fails on Render

- Check Render logs for MongoDB connection errors.
- Verify the Atlas connection string and the Atlas network allowlist.
- Confirm `JWT_SECRET` is set to a strong production value.

### Password reset emails do not arrive

- Configure all SMTP variables in Render.
- Use an SMTP provider app password when the provider requires one.
- Verify `MAIL_FROM` is an approved sender for that provider.
