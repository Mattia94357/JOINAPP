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
- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`

Required Render environment variables:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas connection string |
| `JWT_SECRET` | Unique random value, at least 32 characters |
| `CORS_ORIGINS` | Comma-separated exact HTTPS web origins allowed to call the API |
| `PUBLIC_APP_URL` | One canonical HTTPS web/app URL; never a comma-separated list |
| `PASSWORD_RESET_BASE_URL` | One HTTPS base used to construct reset links |
| `SMTP_HOST` | SMTP hostname, optional until reset email is enabled |
| `SMTP_PORT` | SMTP port, typically `587` or `465` |
| `SMTP_SECURE` | `true` for implicit TLS, usually port 465, otherwise `false` |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password or provider app password |
| `MAIL_FROM` | Sender address, for example `JOIN <no-reply@example.com>` |
| `IMAGE_STORAGE_PROVIDER` | `cloudinary` in production |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary server API key |
| `CLOUDINARY_API_SECRET` | Cloudinary server API secret |
| `EXPO_PROJECT_ID` | Same real UUID as the frontend EAS project |
| `EXPO_PUSH_ENABLED` | Keep `false` until credentials/device verification are complete |
| `EXPO_ACCESS_TOKEN` | Optional server-only Expo access token when enhanced security is enabled |

`CORS_ORIGINS` may contain multiple exact origins. `PUBLIC_APP_URL` and
`PASSWORD_RESET_BASE_URL` must each contain one URL. Production startup rejects
missing, malformed, or non-HTTPS values.

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

- Set Render `CORS_ORIGINS` to the exact Vercel origin, including `https://` and without a path.
- If you use Vercel preview URLs, add only exact preview origins you intend to test as comma-separated values in `CORS_ORIGINS`.
- Localhost and private LAN origins are accepted only while `NODE_ENV=development`.

### Login or activity data fails on Render

- Check Render logs for MongoDB connection errors.
- Verify the Atlas connection string and Atlas network allowlist.
- Confirm `JWT_SECRET` is set to a strong production value.

### Password reset emails do not arrive

- Configure all SMTP variables in Render.
- Use an SMTP provider app password when the provider requires one.
- Verify `MAIL_FROM` is an approved sender for that provider.

## 6. Native release environment

EAS builds run from `frontend`. Preview and production profiles intentionally
fail before build when any release identity, project, API, or policy value is
missing. Configure the following in the matching EAS environment rather than
committing values or secrets:

```text
EXPO_PUBLIC_API_URL=https://your-api.example
EXPO_PUBLIC_APP_URL=https://your-owned-link-domain.example
EXPO_PUBLIC_EAS_PROJECT_ID=real-eas-project-uuid
EXPO_IOS_BUNDLE_IDENTIFIER=your.registered.bundle.identifier
EXPO_ANDROID_PACKAGE=your.registered.android.package
PRIVACY_POLICY_URL=https://...
TERMS_URL=https://...
COMMUNITY_GUIDELINES_URL=https://...
SUPPORT_URL=https://...
DELETE_ACCOUNT_URL=https://...
```

Link the project from `frontend` with `eas init` after choosing the owning Expo
account. Set backend `EXPO_PROJECT_ID` to that same UUID before enabling push.
Do not run a store build until the SDK migration and asset checklist in
`NATIVE_RELEASE_READINESS.md` are complete.
