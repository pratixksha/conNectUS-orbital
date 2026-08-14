# conNectUS

A social app built for NUS students to discover, plan, and join hangouts on campus — built as part of **NUS Orbital 2026 (Apollo level)**.

## What it does

NUS students struggle to spontaneously meet up with people who share their interests or faculty, and existing tools (Telegram groups, NUSync, LinkedIn) aren't built for real-time, location-based social discovery. conNectUS solves this with:

- **Live Hangouts Map** — see and join hangouts happening around campus in real time
- **Faculty & interest-based recommendations** — a recommendation engine that surfaces relevant hangouts and people based on your faculty and interests
- **Real-time chat** — message other students directly within the app
- **Friends system** — add friends, see mutual connections
- **Event reminders** — automatic notifications before a hangout starts, powered by Supabase Edge Functions
- **Communities** — join faculty, CCA, or interest-based groups to discover hangouts and connect with like-minded students
  
## Tech stack

| Layer | Tech |
|---|---|
| Mobile app | React Native (Expo) |
| Backend / DB | Supabase (Postgres, Auth, Realtime, Edge Functions) |
| Push notifications | Firebase Cloud Messaging |
| Maps | Google Maps SDK |
| Calendar integration | expo-calendar |
| Testing | Jest / jest-expo |

## Testing

Unit and integration tests written with Jest / jest-expo, covering core flows including hangout creation, chat, friend requests. 

## Releases

See the [Releases](../../releases) page for the latest APK build.

