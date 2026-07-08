# JOIN deployment

JOIN production is deployed with Vercel for the frontend, Render for the Node/Express API, and MongoDB Atlas for the database.

## Production architecture

- Frontend: `https://frontend-self-three-86.vercel.app`
- Backend: `https://joinapp.onrender.com`
- Database: MongoDB Atlas

## 1. MongoDB Atlas

1. Create an Atlas database user with access only to the JOIN database.
2. In Atlas Network Access, allow Render's outbound IPs if you use an IP allowlist.
3. Copy the connection string and set it as Render's `MONGODB_URI`.

Never commit the URI, database password, JWT secret, or SMTP credentials.

## 2. Backend on Render

Create or update the Render web service with:

- Root directory: `backend`
- Build command: `npm install --include=dev && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`

Required Render environment variables:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas connection string |
| `JWT_SECRET` | Unique random value, at least 32 characters |
| `FRONTEND_URL` | Exact Vercel frontend origin |
| `SMTP_HOST` | SMTP hostname, optional until reset email is enabled |
| `SMTP_PORT` | SMTP port, typically `587` or `465` |
| `SMTP_SECURE` | `true` for implicit TLS, usually port 465, otherwise `false` |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password or provider app password |
| `MAIL_FROM` | Sender address, for example `JOIN <no-reply@example.com>` |

`FRONTEND_URL` may contain a comma-separated list of exact approved frontend origins when you intentionally need more than one Vercel domain. Keep it limited to domains you control.

Backend health check:

```text
https://joinapp.onrender.com/api/health
```

Expected response:

```json
{ "status": "ok", "service": "JOIN API" }
```

## 3. Frontend on Vercel

Production frontend:

```text
https://frontend-self-three-86.vercel.app
```

In Vercel Project Settings > Environment Variables, set:

```text
EXPO_PUBLIC_API_URL=https://joinapp.onrender.com
```

Redeploy the Vercel frontend after saving the variable. Expo public variables are embedded at build time, so changing this value requires a new Vercel deployment.

The React Native Web client reads this value through Expo configuration; API URLs must not be hardcoded in individual screen components.

## 4. Local development

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

Use `frontend/.env` locally with:

```text
EXPO_PUBLIC_API_URL=https://joinapp.onrender.com
```

If you are intentionally running the backend locally, use `http://localhost:4000` for local browser testing only. Do not commit local credentials.

## 5. Phone testing

For normal testing, use Expo or the Vercel URL with `EXPO_PUBLIC_API_URL` set to the Render URL. A physical phone can reach both Vercel and Render over public HTTPS.

## Troubleshooting

### The frontend says it cannot connect

- Confirm `EXPO_PUBLIC_API_URL` in Vercel is `https://joinapp.onrender.com`, with no trailing `/api`.
- Redeploy Vercel after changing the value.
- Confirm `GET https://joinapp.onrender.com/api/health` succeeds.

### Browser shows a CORS error

- Set Render `FRONTEND_URL` to the exact Vercel origin, including `https://` and without a trailing slash.
- If you use Vercel preview URLs, add only the exact preview origins you intend to test as comma-separated values in `FRONTEND_URL`.
- Localhost and private LAN origins are accepted only while `NODE_ENV=development`.

### Login or activity data fails on Render

- Check Render logs for MongoDB connection errors.
- Verify the Atlas connection string and Atlas network allowlist.
- Confirm `JWT_SECRET` is set to a strong production value.

### Password reset emails do not arrive

- Configure all SMTP variables in Render.
- Use an SMTP provider app password when the provider requires one.
- Verify `MAIL_FROM` is an approved sender for that provider.
