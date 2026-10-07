# Image storage rollout

JOIN stores new profile, Moment, and activity-cover images in Cloudflare R2. MongoDB contains only public URLs, opaque storage prefixes, MIME type, byte size, and dimensions. Image bytes and R2 credentials never reach MongoDB or the frontend.

## Production configuration

Set these backend-only variables:

- `IMAGE_STORAGE_PROVIDER=r2`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_BASE_URL` — the HTTPS custom domain or public R2 delivery base for the bucket

Production startup fails with the exact missing variable names when this configuration is incomplete. Cloudinary variables are not read. For explicit local development only, `IMAGE_STORAGE_PROVIDER=local` remains available with optional `IMAGE_LOCAL_DIR` and `IMAGE_PUBLIC_BASE_URL`; production never falls back to local disk.

## Processing and object layout

The backend validates JPEG, PNG, or WebP bytes before Sharp normalizes output to WebP. Profile uploads create `avatar.webp` at 512×512 and `thumb.webp` at 128×128. Activity covers create a 1200×675 `cover.webp`. Moments retain their aspect ratio and are limited to 1920px on the longest side without enlargement. Every object receives `Cache-Control: public, max-age=31536000, immutable`.

Normal object prefixes use cryptographically random identifiers under `profiles/`, `moments/`, or `activities/`; user identifiers and client filenames are not included. Migration-only prefixes use a one-way hash of the internal deterministic migration key so retries overwrite the same objects without exposing database IDs.

## Cloudflare setup

1. Create an R2 bucket and keep its name for `R2_BUCKET_NAME`.
2. Create an R2 API token scoped to object read/write for that bucket. Copy its Access Key ID and Secret Access Key once.
3. Copy the Cloudflare account ID.
4. Configure public delivery for the bucket, preferably with a custom domain, and set its HTTPS origin as `R2_PUBLIC_BASE_URL` without a trailing object path.
5. Add the six variables above to Render and redeploy. Do not add R2 credentials to Expo or other frontend configuration.

## Safe migration sequence

1. Back up MongoDB and verify the R2 configuration.
2. Deploy/build the R2-capable backend.
3. Run `npm run migrate:image-assets` from `backend` with the production environment.
4. Re-run it. A successful second run reports zero migrated records, confirming idempotency.
5. Verify sampled users and Moments before considering the rollout complete.

The migration uploads a legacy data URI before atomically writing metadata and unsetting the legacy field. A failed upload leaves the original database value intact. Existing Cloudinary and external HTTPS metadata continues to render from its stored URL and does not require immediate re-upload. Cleanup deliberately skips legacy Cloudinary/external objects because JOIN no longer holds those provider credentials.

Provider deletion remains best-effort after MongoDB no longer references an R2 asset. Profile replacement uploads the new main/thumbnail pair and saves MongoDB before deleting the old prefix. Moment/account deletion and failed database writes use the same reference-aware cleanup path; a cleanup outage is logged without corrupting database state.

## Upload cost and abuse controls

Before enabling R2 uploads, set `IMAGE_UPLOADS_ENABLED=true` explicitly and review the defaults in `backend/.env.example`. Set it to `false` to stop all new profile, Moment, and activity-cover uploads with a retryable 503; existing images continue to render. The backend rejects malformed safeguard configuration at startup. MongoDB-backed counters enforce 20 accepted image files per user per UTC day, 5 upload requests per user and 20 per IP per fixed 10-minute bucket, 1,000 files and 1 GB of processed output globally per UTC day, and 100 stored image assets per account. A profile replacement counts against daily upload cost but not additional stored-asset capacity. A Moment is at most three images; a profile or activity-cover request is one image. The daily counters are conservative: failed provider/DB attempts still count, to prevent repeated failures from generating unlimited cost. Existing rate limits and authentication remain in force.

Limits use UTC bucket boundaries, not sliding windows. Repeated rejected requests do not increment file/byte counters, but successful short-window admissions count even if later validation/storage fails. A per-user Mongo lease serializes storage-cap checks, and request claims collapse concurrent retries for Moment and activity client request IDs. The native activity composer sends a stable ID for retries; older clients without an ID remain subject to the quotas. Profile retries of identical bytes return the existing image. Processed output is capped before any R2 write: profile avatar 2 MB, thumbnail 300 KB, activity cover 4 MB, Moment image 5 MB. Input decoding retains the existing MIME/dimension/byte checks.

Alert on `[images] Upload safeguard reached` and `[images] Global daily upload safeguard reached`; these log only the safeguard category and UTC bucket, not IPs, user IDs, image content, keys, or credentials. Configure Cloudflare R2 spend/usage notifications in the Cloudflare dashboard, and monitor object count, stored bytes, Class A operations, and egress. Suggested starting warnings: 50%, 75%, and 90% of the intended monthly storage/request budget, plus any unexpected daily spike. Treat the application global limit as a backstop, not a substitute for account-level billing alerts.

Account signup has its own IP rate limit but no email verification. An attacker with many accounts and IPs can consume the global daily budget until it trips. Keep the global limit and Cloudflare alerts enabled; email verification is a separate product/security change, not part of this upload rollout. MongoDB availability is required for quota admission: failures fail closed via the central error handler; uploads are not allowed through without a counter reservation. A crashed process may leave a per-user lease for up to 10 minutes, after which it can be reclaimed. For emergency cost containment, set `IMAGE_UPLOADS_ENABLED=false` and restart/redeploy the backend configuration; do not remove existing R2 objects as part of the kill-switch operation.
