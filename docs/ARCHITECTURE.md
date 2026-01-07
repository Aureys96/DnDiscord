# DnD Voice Chat - Architecture Reference

> **For Claude Agents:** Read this document before starting implementation. Update it after completing significant features.

## Quick Reference

| Component | Location | Description |
|-----------|----------|-------------|
| Server | `packages/server/` | Fastify + Socket.IO backend |
| Client | `packages/client/` | React + Zustand frontend |
| Shared | `packages/shared/` | Zod schemas + utilities |
| Database | `data/dnd.db` | SQLite file |
| Tests | `packages/server/src/*.test.ts` | Jest integration tests |

---

## 1. Project Overview

**DnD Voice Chat** is a self-hosted Discord-like application for tabletop RPG sessions.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Zustand 5, Tailwind CSS, Vite 7 |
| Backend | Fastify 4, Socket.IO 4, SQLite (better-sqlite3) |
| Voice | WebRTC P2P mesh (max 6 users) |
| Auth | JWT (24h expiry), bcrypt |
| Validation | Zod schemas |

### Current Features (Milestones 1-12)
- User authentication (DM/Player roles)
- Global and room-scoped chat
- Direct messaging with unread counts
- Dice rolling with D&D notation
- WebRTC voice chat with VAD
- Push-to-talk mode
- YouTube music player (DM-controlled)

---

## 2. Monorepo Structure

```
/home/aureys/DnDiscord/
├── package.json              # Workspace root
├── CLAUDE.md                 # Developer guidelines
├── docs/
│   └── ARCHITECTURE.md       # This file
└── packages/
    ├── shared/               # Shared types & utilities
    │   └── src/
    │       ├── types.ts      # Zod schemas
    │       └── dice.ts       # Dice roller
    ├── server/               # Backend
    │   └── src/
    │       ├── index.ts      # Entry point
    │       ├── db/           # Database
    │       ├── routes/       # REST API
    │       ├── socket/       # Socket.IO handlers
    │       ├── middleware/   # Auth middleware
    │       └── services/     # YouTube service
    └── client/               # Frontend
        └── src/
            ├── pages/        # Route components
            ├── components/   # UI components
            ├── stores/       # Zustand stores
            └── lib/          # Utilities & managers
```

---

## 3. Database Schema

**Location:** `packages/server/src/db/schema.sql`

### Tables

#### users
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('dm', 'player')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### rooms
```sql
CREATE TABLE rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### messages
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER REFERENCES rooms(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  type TEXT NOT NULL CHECK(type IN ('room', 'global', 'dm', 'roll')),
  recipient_id INTEGER REFERENCES users(id),
  roll_result TEXT  -- JSON for dice rolls
);
```

#### conversations
```sql
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user1_id INTEGER NOT NULL REFERENCES users(id),
  user2_id INTEGER NOT NULL REFERENCES users(id),
  last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user1_id, user2_id)
);
-- Note: Always stores smaller ID as user1_id for consistency
```

#### conversation_reads
```sql
CREATE TABLE conversation_reads (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(conversation_id, user_id)
);
```

### Default User
- Username: `admin`, Password: `admin123`, Role: `dm`
- Auto-created on first database init

---

## 4. Shared Types (Zod Schemas)

**Location:** `packages/shared/src/types.ts`

### Key Schemas

```typescript
// User & Auth
UserRoleSchema = z.enum(["dm", "player"])
UserSchema = z.object({ id, username, role, createdAt? })
LoginRequestSchema = z.object({ username: min(3), password: min(6) })
RegisterRequestSchema = z.object({ username, password, role? })

// Rooms
RoomSchema = z.object({ id, name, createdBy, createdAt, creatorUsername? })
CreateRoomRequestSchema = z.object({ name: min(1).max(50) })

// Messages
MessageTypeSchema = z.enum(["room", "global", "dm", "roll"])
MessageSchema = z.object({ id, roomId?, userId, content, timestamp, type, rollResult? })

// Music
MusicScopeSchema = z.enum(["global", "room"])
MusicTrackSchema = z.object({ id, youtubeUrl, title, duration, thumbnailUrl?, addedBy, addedByUsername })
MusicStateSchema = z.object({ currentTrack?, queue[], isPlaying, startedAt?, pausedAt?, volume })
```

### Dice Roller

**Location:** `packages/shared/src/dice.ts`

```typescript
// Supported notation: 2d6, 1d20+5, 4d6kh3 (keep highest), 4d6-L (drop lowest)
parseAndRoll(notation: string): DiceRollResult | null
formatRollResult(result: DiceRollResult): string
extractDiceCommand(message: string): string | null  // Finds /roll or [[notation]]
```

---

## 5. Server Architecture

### REST API Endpoints

**Base URL:** `http://localhost:3001/api`

#### Authentication (`/api/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | No | Create account |
| POST | `/login` | No | Get JWT token |
| GET | `/me` | Yes | Get current user |

#### Rooms (`/api/rooms`)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/` | Yes | Any | List all rooms |
| GET | `/:id` | Yes | Any | Get room details |
| POST | `/` | Yes | DM | Create room |
| PUT | `/:id` | Yes | DM+Creator | Update room |
| DELETE | `/:id` | Yes | DM+Creator | Delete room |

#### Direct Messages (`/api/dms`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/conversations` | Yes | List user's conversations |
| POST | `/conversations/:userId` | Yes | Get/create conversation |
| GET | `/:userId/messages` | Yes | Get message history |
| POST | `/:userId/messages` | Yes | Send DM |
| POST | `/:userId/read` | Yes | Mark as read |
| GET | `/unread-count` | Yes | Total unread count |

#### Users (`/api/users`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Yes | List all users |

### Socket.IO Events

**Connection:** Client sends JWT in `socket.handshake.auth.token`

#### Chat Events
```
Client → Server:
  send_message({ content, type?, roomId? }) → callback({ success, message })
  get_messages({ type?, roomId?, limit? }) → callback({ success, messages })
  typing_start({ roomId? })
  typing_stop({ roomId? })

Server → Client:
  new_message(message)
  user_typing({ userId, username, roomId? })
  user_stopped_typing({ userId, roomId? })
```

#### Room Events
```
Client → Server:
  join_room({ roomId }) → callback({ success, users })
  leave_room() → callback({ success })
  get_room_users({ roomId }) → callback({ success, users })

Server → Client:
  user_joined_room({ userId, username, role, roomId })
  user_left_room({ userId, username, roomId })
```

#### Voice Events
```
Client → Server:
  voice_join({ roomId }) → callback({ success, voiceUsers })
  voice_leave({ roomId }) → callback({ success })
  voice_offer({ targetUserId, offer })
  voice_answer({ targetUserId, answer })
  voice_ice_candidate({ targetUserId, candidate })
  voice_state_update({ roomId, isMuted })
  voice_speaking({ roomId, isSpeaking })

Server → Client:
  voice_user_joined({ roomId, user })
  voice_user_left({ roomId, userId })
  voice_offer({ fromUserId, offer })
  voice_answer({ fromUserId, answer })
  voice_ice_candidate({ fromUserId, candidate })
  voice_state_changed({ roomId, userId, isMuted })
  voice_speaking_changed({ roomId, userId, isSpeaking })
```

#### DM Events
```
Client → Server:
  send_dm({ recipientId, content }) → callback({ success, message })
  dm_typing_start({ recipientId })
  dm_typing_stop({ recipientId })

Server → Client:
  new_dm(message)
  dm_user_typing({ userId, username })
  dm_user_stopped_typing({ userId })
```

#### Music Events (DM Only for control)
```
Client → Server:
  music_play({ scope, roomId? }) → callback({ success, state })
  music_pause({ scope, roomId? }) → callback({ success, state })
  music_skip({ scope, roomId? }) → callback({ success, state })
  music_add({ youtubeUrl, scope, roomId? }) → callback({ success, track, state })
  music_remove({ trackId, scope, roomId? }) → callback({ success, state })
  music_seek({ position, scope, roomId? }) → callback({ success, state })
  music_volume({ volume, scope, roomId? }) → callback({ success, state })
  music_get_state({ roomId? }) → callback({ success, scope, state, audioUrl })
  music_sync({ scope, roomId? }) → callback({ success, isPlaying, startedAt, pausedAt, currentPosition })

Server → Client:
  music_state_changed({ scope, roomId?, state, audioUrl? })
  music_queue_updated({ scope, roomId?, queue })
```

### In-Memory State

#### Voice Channels (`packages/server/src/socket/voiceChannels.ts`)
```typescript
// Map: roomId → Map(userId → VoiceUser)
interface VoiceUser {
  userId: number;
  username: string;
  role: "dm" | "player";
  isMuted: boolean;
  isSpeaking: boolean;
}

// Functions:
getVoiceUsers(roomId): VoiceUser[]
addUserToVoice(roomId, userId, username, role): VoiceUser
removeUserFromVoice(roomId, userId): boolean
removeUserFromAllVoice(userId): number[]  // Returns room IDs
```

#### Music State (`packages/server/src/socket/musicState.ts`)
```typescript
interface MusicState {
  currentTrack: MusicTrack | null;
  queue: MusicTrack[];
  isPlaying: boolean;
  startedAt: number | null;  // Unix timestamp when playback started
  pausedAt: number | null;   // Position in seconds when paused
  volume: number;            // 0-100
}

// Global state + per-room Map
// Position calculation:
//   if (isPlaying && startedAt) position = (Date.now() - startedAt) / 1000
//   else position = pausedAt ?? 0
```

### YouTube Service (`packages/server/src/services/youtubeService.ts`)
```typescript
extractAudioUrl(youtubeUrl): Promise<{ audioUrl, title, duration, thumbnailUrl, expiresAt }>
getVideoInfo(youtubeUrl): Promise<{ title, duration, thumbnailUrl }>
validateYouTubeUrl(url): boolean

// Cache: 5.5h TTL (YouTube URLs expire ~6h)
// Uses: youtube-dl-exec package
```

---

## 6. Client Architecture

### Zustand Stores

**Location:** `packages/client/src/stores/`

| Store | State | Key Actions |
|-------|-------|-------------|
| `authStore` | user, token, isInitialized | login, register, logout, initialize |
| `chatStore` | messages, typingUsers, isConnected | connect, sendMessage, loadMessages |
| `roomStore` | rooms, currentRoom, roomUsers | fetchRooms, joinRoom, createRoom |
| `voiceStore` | isInVoice, isMuted, voiceUsers | joinVoice, leaveVoice, toggleMute |
| `dmStore` | conversations, messages, unreadCount | fetchConversations, sendDM, markAsRead |
| `musicStore` | currentTrack, queue, isPlaying, volume | play, pause, skip, addToQueue, setVolume |

### Key Components

**Location:** `packages/client/src/components/`

```
components/
├── ui/                    # Reusable primitives
│   ├── Button.tsx        # Variants: primary, secondary, ghost, danger
│   ├── Input.tsx         # With label, error, password toggle
│   └── Card.tsx          # CardHeader, CardContent, CardFooter
└── features/
    ├── auth/
    │   └── ProtectedRoute.tsx
    ├── chat/
    │   ├── ChatContainer.tsx   # Socket connection, room switching
    │   ├── MessageList.tsx     # Messages with dice roll formatting
    │   └── ChatInput.tsx       # Multi-line, typing indicator
    ├── rooms/
    │   └── RoomList.tsx        # Room sidebar, create/delete (DM)
    ├── voice/
    │   ├── VoiceControls.tsx   # Join/leave, mute, PTT toggle
    │   └── VoiceParticipants.tsx
    ├── music/
    │   └── MusicPlayer.tsx     # Fixed bottom bar, queue, DM controls
    └── dms/
        ├── ConversationList.tsx
        └── DMChat.tsx
```

### Managers

#### VoiceManager (`packages/client/src/lib/voiceManager.ts`)
```typescript
class VoiceManager {
  // WebRTC P2P mesh (max 6 users)
  // ICE servers: stun.l.google.com:19302
  // Audio: echoCancellation, noiseSuppression, autoGainControl

  initialize(): Promise<void>      // Request mic, setup VAD
  connectToUsers(users): Promise<void>
  createOffer(targetUserId): Promise<void>
  handleOffer(fromUserId, offer): Promise<void>
  handleAnswer(fromUserId, answer): Promise<void>
  handleIceCandidate(fromUserId, candidate): Promise<void>
  setMuted(muted): void
  cleanup(): void
}

// Voice Activity Detection: 100ms interval, threshold 15
// Push-to-Talk: Space key
```

#### MusicManager (`packages/client/src/lib/musicManager.ts`)
```typescript
class MusicManager {
  // HTML5 Audio element for playback
  // Sync interval: 30 seconds
  // Max drift: 3 seconds before resync

  loadTrack(audioUrl, startPosition?): Promise<void>
  play(): Promise<void>
  pause(): void
  seek(position): void
  setVolume(volume): void  // 0-100
  updateFromState(audioUrl, isPlaying, startedAt, pausedAt, volume): Promise<void>
  performSync(): Promise<void>
}
```

### Socket Client (`packages/client/src/lib/socket.ts`)

All socket functions return `Promise<{ success: boolean; error?: string; ... }>`

```typescript
connectSocket(): Socket
disconnectSocket(): void
getSocket(): Socket | null

// Chat: sendMessage, getMessages, emitTypingStart/Stop
// Room: joinRoom, leaveRoom, getRoomUsers
// Voice: joinVoice, leaveVoice, sendVoiceOffer/Answer/IceCandidate
// DM: sendDM, emitDMTypingStart/Stop
// Music: musicPlay/Pause/Skip/Add/Remove/Seek/SetVolume/GetState/Sync
```

---

## 7. Testing

**Framework:** Jest with ts-jest
**Location:** `packages/server/src/*.test.ts`
**Count:** 148+ tests

### Test Files
- `auth.test.ts` - Authentication endpoints
- `rooms.test.ts` - Room CRUD
- `dms.test.ts` - Direct messages
- `health.test.ts` - Health check
- `dice.test.ts` - Dice notation parser
- `voiceChannels.test.ts` - Voice state
- `voice.test.ts` - Voice socket events

### Test Pattern
```typescript
// Each test file uses separate database
beforeAll(() => {
  process.env.DATABASE_PATH = "test-feature.db";
  initializeDatabase();
});
afterAll(() => unlinkSync(testDbPath));
beforeEach(() => /* clean test data */);

// Use fastify.inject() for HTTP tests
const response = await fastify.inject({
  method: "POST",
  url: "/api/auth/login",
  payload: { username, password }
});
```

---

## 8. Scripts

### Root
```bash
npm run dev          # Start server + client (concurrent)
npm run build        # Build all packages
npm run lint         # ESLint
npm run format       # Prettier
```

### Server
```bash
npm run dev          # tsx watch
npm run test         # Jest
npm run build        # tsc
```

### Client
```bash
npm run dev          # Vite dev server (:5173)
npm run build        # tsc + vite build
```

---

## 9. Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite | Self-hosted, no external DB server needed |
| WebRTC P2P mesh | Low latency, no media server for small groups |
| Zustand | Simpler than Redux, excellent TypeScript support |
| Zod | Runtime validation + TypeScript inference |
| Socket.IO | Reliable real-time, auto-reconnection, rooms |
| Integration tests | Catch real bugs vs mocked unit tests |

---

## 10. Common Patterns

### Authentication Check
```typescript
// Server middleware
authenticate(request, reply)  // Verifies JWT, attaches request.user
requireDM(request, reply)     // Checks request.user.role === "dm"

// Client
const { user } = useAuthStore();
const isDM = user?.role === "dm";
```

### Socket Event Handler
```typescript
// Server
socket.on("event_name", async (payload, callback) => {
  try {
    // Process...
    callback?.({ success: true, data });
  } catch (error) {
    callback?.({ error: error.message });
  }
});

// Client
const response = await socketFunction(payload);
if (!response.success) {
  setError(response.error);
}
```

### Zustand Store Pattern
```typescript
export const useStore = create<State>((set, get) => ({
  // State
  data: null,
  isLoading: false,
  error: null,

  // Actions
  fetchData: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.get("/endpoint");
      set({ data, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
}));
```

---

## 11. Environment Variables

### Server (.env)
```bash
PORT=3001
HOST=0.0.0.0
DATABASE_PATH=./data/dnd.db
JWT_SECRET=change-in-production
CORS_ORIGIN=http://localhost:5173
```

### Client (.env.local)
```bash
VITE_API_URL=http://localhost:3001  # Optional, defaults to localhost
```

---

## 12. File Quick Reference

### Adding a New Feature

1. **Types:** `packages/shared/src/types.ts` - Add Zod schemas
2. **Database:** `packages/server/src/db/schema.sql` - Add tables
3. **API:** `packages/server/src/routes/` - Add REST endpoints
4. **Socket:** `packages/server/src/socket/index.ts` - Add events
5. **Store:** `packages/client/src/stores/` - Add Zustand store
6. **Components:** `packages/client/src/components/features/` - Add UI
7. **Tests:** `packages/server/src/*.test.ts` - Add integration tests

### Key Files by Feature

| Feature | Server | Client |
|---------|--------|--------|
| Auth | `routes/auth.ts`, `middleware/auth.ts` | `stores/authStore.ts`, `pages/LoginPage.tsx` |
| Chat | `socket/index.ts` (send_message) | `stores/chatStore.ts`, `components/features/chat/` |
| Rooms | `routes/rooms.ts`, `socket/index.ts` | `stores/roomStore.ts`, `components/features/rooms/` |
| Voice | `socket/index.ts`, `socket/voiceChannels.ts` | `stores/voiceStore.ts`, `lib/voiceManager.ts` |
| DMs | `routes/dms.ts`, `socket/index.ts` | `stores/dmStore.ts`, `components/features/dms/` |
| Music | `socket/index.ts`, `socket/musicState.ts`, `services/youtubeService.ts` | `stores/musicStore.ts`, `lib/musicManager.ts` |

---

*Last updated: After Milestone 12 (YouTube Music Player)*
