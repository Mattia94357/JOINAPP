# Image storage rollout

JOIN stores new profile and Moment images as provider URLs, unpredictable object keys, and bounded metadata. Image bytes are no longer written to MongoDB.

## Production configuration

Set `IMAGE_STORAGE_PROVIDER=cloudinary` plus `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. `CLOUDINARY_FOLDER` is optional and defaults to `join`. Startup fails in production if this configuration is absent; secrets stay server-side.

For explicit local development only, set `IMAGE_STORAGE_PROVIDER=local`. Optional `IMAGE_LOCAL_DIR` controls the directory and `IMAGE_PUBLIC_BASE_URL` controls the public URL (defaults to `http://localhost:4000/uploads`). This fallback is rejected in production and still stores files rather than base64.

## Safe migration sequence

1. Back up MongoDB and provider configuration.
2. Deploy/build code with the migration available, but keep existing app traffic on the previous release.
3. Run `npm run migrate:image-assets` from `backend` with the production environment.
4. Re-run the command. A successful second run reports zero migrated records, confirming idempotency.
5. Verify sampled users and Moments, then deploy the new API.

The migration uploads each data URI before atomically writing asset metadata and unsetting the legacy field. A failed upload leaves the original database value intact. Deterministic migration keys make retries safe. Existing HTTPS-only external development records are preserved as `legacy-external` metadata without server-side fetching (avoiding SSRF); they should be replaced by managed uploads over time because an external host can observe image requests.

Provider deletion is best-effort after the database no longer references an asset. Cleanup checks both User and Moment collections first, so shared or retried references are not deleted. A provider outage cannot block Moment/account deletion; failed object cleanup is logged for operational retry.
