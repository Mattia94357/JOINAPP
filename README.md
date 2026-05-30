# JoinApp

A Tinder-style activity matching app for people who want to join others' experiences. The design uses black, white, and gold for a premium modern look.

## Features
- Activity feed in swipeable card style
- Activity categories and details
- Participant list and host profile
- Authentication ready for MongoDB
- Chat-ready backend with real-time-ready structure

## Getting Started

1. Install dependencies:
   ```bash
   yarn install
   ```
2. Start the backend:
   ```bash
   yarn start:backend
   ```
3. Start the frontend:
   ```bash
   yarn start:frontend
   ```

## Backend
- `backend/src/index.ts`
- `backend/src/routes`
- `backend/src/models`
- `backend/.env.example`

## Frontend
- `frontend/App.tsx`
- `frontend/src/screens`
- `frontend/src/components`

## Notes
- Replace `MONGODB_URI` and `JWT_SECRET` in `backend/.env`.
- Backend is ready for MongoDB integration with models and routes.
- Frontend is built with Expo and can later be deployed to App Store / Play Store.
