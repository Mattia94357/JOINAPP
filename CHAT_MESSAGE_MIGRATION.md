# Chat message migration

New messages are stored in `ChatMessage`, not inside `Chat.messages`.

Existing embedded messages are migrated automatically the first time a chat is read, listed, or written. The operation uses each legacy subdocument ID as an idempotency key and unsets the embedded array only after every message upsert succeeds.

For an explicit production rollout, run this before or after deploying the compatible API:

```powershell
cd backend
npm run migrate:chat-messages
```

The command is non-destructive and safe to rerun. Do not reset the database. Keep the compatibility code for at least one release after all environments report zero chats with `messages.0`.
