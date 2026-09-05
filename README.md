# Chess Platform ♟️

> A full-stack, real-time multiplayer chess platform with AI bots, Elo ratings, and a cosmetics shop.

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://chess-brown-beta.vercel.app)

## Overview
This project is a comprehensive, full-stack real-time multiplayer chess platform. It allows users to play against others worldwide, challenge AI bots with distinct personas, and climb the Elo rating ladder. With integrated OAuth, social features like friends and live spectating, and a robust cosmetics economy driven by daily challenges, it offers a complete and modern chess experience.

## Features
- **Real-Time PvP Chess**: Low-latency gameplay powered by WebSockets (Socket.io).
- **AI Opponents**: Play against various difficulties using Stockfish WASM, featuring unique persona-based bots.
- **Matchmaking & Lobbies**: Queue for random matchmaking or create private game rooms.
- **Authentication**: Secure login via Google/GitHub OAuth, as well as traditional email/password auth.
- **Social & Friends System**: Add friends, track their online status, and send game invites.
- **Elo Rating System**: Competitive ranking tracking `bestRating` and current Elo per user.
- **Game History & Review**: Save match PGNs to analyze past games and moves.
- **Leaderboards**: Compete globally for the top ranking.
- **Cosmetics Shop**: Earn `chess-coins` to unlock and equip custom board themes and piece sets.
- **Daily Challenges**: Maintain a daily challenge streak to earn bonus rewards.
- **Live Spectating & Chat**: Watch active games and chat with other players in real time.

## Tech Stack

### Frontend
- **React 19** & **React DOM** - UI Library
- **Vite** - Bundler and Dev Server
- **React-Chessboard** - Interactive chessboard component
- **Chess.js** - Chess logic, move validation, and PGN generation
- **Socket.io-Client** - Real-time WebSocket communication
- **React-Router-DOM** - Client-side routing
- **Lucide React** - Icon library

### Backend
- **Node.js** & **Express** - REST API and server framework
- **Socket.io** - Real-time event and state management
- **Passport.js** - Authentication middleware (OAuth for Google/GitHub)
- **Prisma** - Next-generation ORM for Node.js
- **Zod** - Schema validation for incoming requests
- **Chess.js** & **Stockfish WASM** - Server-side game validation and AI move generation
- **Bcrypt** - Password hashing for email/password accounts
- **JSONWebToken (JWT)** - Short-lived access tokens (verified on each API/socket request) paired with HTTP-only cookie refresh tokens for session renewal

### Database
- **PostgreSQL** (hosted on Supabase) - Relational database for persistent storage

### Deployment
- **Frontend**: Vercel
- **Backend**: Render
- **Database**: Supabase

## Architecture
The application uses a split-deployment microservices architecture:
- **Client App (Vercel)**: A static single-page application (SPA) optimized for fast global content delivery.
- **Server App (Render)**: A stateful Node.js backend. Render is chosen over serverless platforms (like Vercel Functions) because Socket.io requires a **persistent, long-lived process** to maintain WebSocket connections — serverless functions that spin up and down per-request cannot sustain them.
- **Database (Supabase)**: A remote PostgreSQL database providing scalable and reliable data storage.

## Getting Started / Local Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [PostgreSQL](https://www.postgresql.org/) (Local instance or cloud provider like Supabase)

### 1. Clone the Repository
```bash
git clone https://github.com/Arnav-Chauhan-5/Chess.git
cd Chess
```

### 2. Setup the Server (Backend)
Navigate to the server directory and install dependencies:
```bash
cd server
npm install
```

Create a `server/.env` file with the following variables (all are read via `process.env` by the server):
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/chessdb"

# JWT — use strong, random strings in production
JWT_SECRET="your_jwt_access_token_secret"
JWT_REFRESH_SECRET="your_jwt_refresh_token_secret"

# OAuth providers
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"

# Server's own public URL — used to construct OAuth callback URLs (passport.js)
API_URL="http://localhost:3000"

# Client's public URL — used for CORS origin and OAuth success/failure redirects
CLIENT_URL="http://localhost:5173"
```

Initialize the database schema using Prisma:
```bash
npx prisma generate
npx prisma db push
```

Start the backend development server:
```bash
npm run dev
```

### 3. Setup the Client (Frontend)
Open a new terminal, navigate to the client directory, and install dependencies:
```bash
cd client
npm install
```

Create a `client/.env` file (Vite only exposes `VITE_`-prefixed variables to the browser):
```env
# Backend API base URL — consumed via import.meta.env.VITE_API_URL in client/src/config.js
VITE_API_URL="http://localhost:3000"
```

Start the frontend development server:
```bash
npm run dev
```

The app should now be running at `http://localhost:5173`.

## Project Structure
```text
.
├── client/                 # React frontend application
│   ├── public/             # Static assets (images, icons, etc.)
│   └── src/                # React components, hooks, pages, and styles
│
└── server/                 # Node.js/Express backend
    ├── prisma/             # Prisma schema and database migrations
    ├── src/                # Express controllers, Socket.io events, auth, and models
    └── scripts/            # Utility and seeding scripts
```

## Deployment
- **Frontend (Client)** is automatically deployed to **[Vercel](https://vercel.com)**.
- **Backend (Server)** is hosted on **[Render](https://render.com)** to support persistent WebSocket connections.
- **Database** is managed on **[Supabase](https://supabase.com)**.

🔗 **[View Live Demo](https://chess-brown-beta.vercel.app)**

## Screenshots

### Lobby & Matchmaking
![Lobby — player stats, matchmaking queue, and AI bot roster](docs/screenshots/lobby.png)

### In-Game Match
![Game Room — live board, move list with opening detection, chat, and clocks](docs/screenshots/game.png)

### Cosmetics Shop
![Shop — board themes purchasable with Chess Coins earned from daily challenges](docs/screenshots/shop.png)

## License
This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.

## Contact / Author
- **Name**: Arnav Chauhan
- **GitHub**: [@Arnav-Chauhan-5](https://github.com/Arnav-Chauhan-5)
