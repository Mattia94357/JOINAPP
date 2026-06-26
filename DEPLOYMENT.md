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
