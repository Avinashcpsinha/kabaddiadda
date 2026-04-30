# Kabaddiadda Mobile (Expo)

React Native app for fans, players, and scorers. Talks to the same Supabase
project as the web app, so users see the same data, the same scores, the same
notifications.

## Run

```bash
pnpm install                       # at the monorepo root
cp apps/mobile/.env.example apps/mobile/.env
# fill in EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
pnpm dev:mobile
```

Open the QR code with Expo Go on your phone, or run on a simulator with `i`
(iOS) / `a` (Android).

## Phase 0 status

Stub only — landing screen + sign-in flow connected to Supabase. Phase 4 will
build out the fan feed, live match view, and offline-first scoring console.
