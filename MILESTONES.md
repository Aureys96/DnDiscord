# DnD Voice Chat - Project Milestones

## Project Overview

A self-hosted Discord-like voice and text chat application for Dungeons & Dragons sessions.

**Tech Stack:**
- **Backend:** Node.js, Fastify, Socket.IO, SQLite, JWT
- **Frontend:** React, Vite, Tailwind CSS, Zustand
- **Real-time:** WebRTC (P2P mesh), Socket.IO (signaling)
- **Deployment:** Self-hosted on VPS

**Core Features:**
- Voice chat with WebRTC (P2P mesh, max 6 users)
- Text chat (global, room-specific, DMs) with dice roller
- Background music streaming from YouTube
- Soundboard for sound effects
- Multiple rooms with audio isolation
- Role-based permissions (DM vs Players)

---

## Milestone Progress

### ✅ Milestone 1: Hello World Full-Stack
**Status:** COMPLETED
**Completed:** 2026-01-05

**Implemented:**
- Monorepo structure with npm workspaces
- Three packages: `shared`, `server`, `client`
- Shared Zod schemas in `@dnd-voice/shared`
- Fastify backend with health endpoint
- React frontend with Vite and Tailwind CSS
- Full-stack communication verified
- SQLite database with schema

**Tests:**
- Health endpoint returns correct status ✓
- Database connection and admin user creation ✓

**Commits:**
- `feat: initialize monorepo with full-stack hello world`

---

### ✅ Milestone 2: JWT Authentication
**Status:** COMPLETED
**Completed:** 2026-01-06

**Implemented:**
- User registration with bcrypt password hashing (10 salt rounds)
- User login with JWT token generation (24h expiration)
- Protected routes with JWT middleware
- Role-based access control (DM vs Player)
- Zod validation schemas for authentication
- Proper error handling for auth flows

**Database:**
- Users table with password hashing
- Default admin user (username: `admin`, password: `admin123`)

**API Endpoints:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and receive JWT token
- `GET /api/auth/me` - Get current user (protected)

**Tests:**
- User registration (success, validation, duplicates) ✓
- User login (valid/invalid credentials) ✓
- Protected routes (valid/invalid/expired tokens) ✓
- JWT middleware (token generation, authentication, role checks) ✓
- Password hashing with bcrypt ✓
- **33 tests passing**

**Bug Fixes:**
- Fixed TokenExpiredError handling (must check before JsonWebTokenError)

**Commits:**
- `feat(auth): add authentication schemas and dependencies`
- `feat(auth): implement JWT authentication with bcrypt`
- `test: add comprehensive test suite with Jest`

---

### ✅ Milestone 3: Authentication UI + Zustand
**Status:** COMPLETED
**Completed:** 2026-01-06

**Implemented:**
- Login page with form validation and error handling
- Registration page with role selection (Player/DM)
- Zustand auth store with localStorage persistence
- Protected routes with React Router
- Automatic token validation on app load
- Logout functionality
- User profile display with role badge

**Frontend Components:**
- Reusable UI components: `Button`, `Input`, `Card`
- Auth store with login/register/logout/initialize actions
- ProtectedRoute wrapper component
- API client with automatic token injection

**Pages:**
- `/login` - Login form with username/password
- `/register` - Registration with role selection
- `/` - Protected home page with user info

**Features:**
- Password visibility toggle
- Client-side form validation
- Loading states with spinner
- Error message display
- Automatic redirect after login/logout
- Token persistence across page reloads

**Dependencies Added:**
- `zustand` - State management
- `react-router-dom` - Routing
- `lucide-react` - Icons

**File Structure:**
```
src/
├── components/
│   ├── ui/           # Button, Input, Card
│   └── features/
│       └── auth/     # ProtectedRoute
├── stores/
│   └── authStore.ts  # Zustand auth store
├── pages/
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   └── HomePage.tsx
└── lib/
    └── api.ts        # API client
```

**Commits:**
- `feat(ui): add authentication UI with Zustand state management`

---

### ✅ Milestone 4: Basic Text Chat (Global)
**Status:** COMPLETED
**Completed:** 2026-01-06

**Implemented:**
- Socket.IO server with JWT authentication middleware
- Real-time message broadcasting to global room
- Message persistence in SQLite database
- Chat UI with auto-scroll and typing indicators
- Connection status indicators (connected/disconnected/reconnecting)

**Backend:**
- Socket.IO integrated with Fastify HTTP server
- JWT token authentication on socket connection
- Message queries (create, getGlobalMessages, getById)
- Events: `send_message`, `get_messages`, `new_message`, `typing_start`, `typing_stop`
- User presence events: `user_joined`, `user_left`

**Frontend Components:**
- `ChatContainer` - Main chat wrapper with connection management
- `MessageList` - Displays messages with role-based styling (DM = amber, Player = violet)
- `ChatInput` - Textarea with send button, Enter to send, Shift+Enter for new line
- `chatStore` - Zustand store for chat state and socket actions
- `socket.ts` - Socket.IO client service with typed events

**Features:**
- Real-time message delivery
- Auto-scroll when user is near bottom
- Typing indicators with animated dots
- Message history loading (last 50 messages)
- Connection error handling and reconnection
- User role display (DM crown icon, Player user icon)
- Timestamp formatting (today's time vs date)
- Max message length (2000 characters)

**Dependencies Added:**
- `socket.io` - Server-side real-time engine
- `socket.io-client` - Client-side real-time engine

**File Structure:**
```
packages/server/src/
├── socket/
│   └── index.ts       # Socket.IO setup with auth
└── db/
    └── index.ts       # Added getMessageQueries()

packages/client/src/
├── components/features/chat/
│   ├── ChatContainer.tsx
│   ├── ChatInput.tsx
│   ├── MessageList.tsx
│   └── index.ts
├── stores/
│   └── chatStore.ts   # Chat Zustand store
├── lib/
│   └── socket.ts      # Socket.IO client
└── pages/
    └── HomePage.tsx   # Updated with chat panel
```

**Commits:**
- `feat(chat): add Socket.IO real-time global chat`

---

### ✅ Milestone 5: Room System
**Status:** COMPLETED
**Completed:** 2026-01-07

**Implemented:**
- Room CRUD operations (create, read, update, delete)
- Room-specific chat with isolated messages
- Room list sidebar with Discord-inspired design
- Real-time user presence tracking per room
- Room switching with automatic message loading

**Backend:**
- Room queries (create, getAll, getById, getByCreator, delete, update)
- REST API endpoints for rooms (GET, POST, PUT, DELETE /api/rooms)
- Socket.IO events: `join_room`, `leave_room`, `get_room_users`
- Room presence events: `user_joined_room`, `user_left_room`
- Room-scoped typing indicators

**Frontend Components:**
- `RoomList` - Sidebar with global channel and room channels
- `roomStore` - Zustand store for room state and API calls
- Updated `chatStore` - Room-aware message handling
- Updated `ChatContainer` - Dynamic header based on current room

**Features:**
- DM-only room creation (players see "Only DMs can create rooms")
- Room deletion (creator only)
- Automatic room cleanup on disconnect
- Messages filtered by current context (global vs room)
- Typing indicators scoped to current room
- Smooth room switching with message history reload

**API Endpoints:**
- `GET /api/rooms` - List all rooms
- `GET /api/rooms/:id` - Get single room
- `POST /api/rooms` - Create room (DM only)
- `PUT /api/rooms/:id` - Update room (creator only)
- `DELETE /api/rooms/:id` - Delete room (creator only)

**File Structure:**
```
packages/server/src/
├── routes/
│   └── rooms.ts           # Room REST API
├── socket/
│   └── index.ts           # Added room events
└── db/
    └── index.ts           # Added getRoomQueries()

packages/client/src/
├── components/features/rooms/
│   ├── RoomList.tsx       # Room sidebar
│   └── index.ts
├── stores/
│   ├── roomStore.ts       # Room Zustand store
│   └── chatStore.ts       # Updated for room awareness
├── lib/
│   ├── api.ts             # Added fetch() method
│   └── socket.ts          # Added room functions
└── pages/
    └── HomePage.tsx       # Sidebar layout
```

**Commits:**
- `feat(rooms): add room system with CRUD and real-time presence`

---

### ✅ Milestone 6: Direct Messages (DMs)
**Status:** COMPLETED
**Completed:** 2026-01-07

**Implemented:**
- Private 1-on-1 messaging between users
- Conversations table for tracking DM threads
- Real-time message delivery via Socket.IO
- Unread message indicators with counts
- Conversation list with last message preview
- User list for starting new conversations
- Mark as read functionality

**Backend:**
- Conversations table with user pairs
- conversation_reads table for read status tracking
- DM message queries (create, get conversation messages)
- REST API endpoints for conversations and messages
- Socket.IO events: `send_dm`, `new_dm`, `dm_typing_start/stop`

**Frontend Components:**
- `ConversationList` - Shows DM conversations with unread badges
- `DMChat` - Chat interface with typing indicators
- `dmStore` - Zustand store for DM state management
- Tab-based sidebar (Channels / DMs)
- New DM modal for starting conversations

**API Endpoints:**
- `GET /api/users` - List all users (for new DMs)
- `GET /api/dms/conversations` - List user's conversations
- `POST /api/dms/conversations/:userId` - Start/get conversation
- `GET /api/dms/:userId/messages` - Get DM messages
- `POST /api/dms/:userId/messages` - Send DM
- `POST /api/dms/:userId/read` - Mark conversation as read
- `GET /api/dms/unread-count` - Get total unread count

**Tests:**
- 19 new integration tests for DM functionality
- Tests for conversation CRUD, messaging, validation
- **70 total tests passing**

**Commits:**
- `feat(dms): add direct messaging with real-time delivery`

### ✅ Milestone 7: Dice Roller
**Status:** COMPLETED
**Completed:** 2026-01-07

**Implemented:**
- Dice roll syntax parser supporting standard RPG notation
- Roll visualization in chat with styled display
- Critical hit/miss detection and highlighting
- Support for keep highest/lowest modifiers (4d6kh3)
- Drop lowest shorthand (4d6-L)
- Inline dice notation [[2d6+3]]

**Features:**
- `/roll 2d6+3` or `/r 1d20` commands
- Inline dice notation `[[2d6]]` in messages
- Support for: d4, d6, d8, d10, d12, d20, d100 (any sides 2-1000)
- Keep highest: `4d6kh3` (roll 4d6, keep highest 3)
- Keep lowest: `4d6kl1` (roll 4d6, keep lowest 1)
- Drop lowest: `4d6-L` (same as 4d6kh3)
- Positive/negative modifiers: `1d20+5`, `2d6-2`
- Critical hit detection (natural 20 on d20)
- Critical miss detection (natural 1 on d20)

**Frontend Components:**
- `DiceRollDisplay` - Styled roll result visualization
- Individual dice display with color coding (green=max, red=min)
- Strikethrough for dropped dice
- Large total display with critical highlighting
- Animated "Critical Hit!" / "Critical Miss!" indicators

**Backend:**
- `@dnd-voice/shared` dice parser (parseDiceNotation, rollDice, parseAndRoll)
- Socket.IO integration for roll command detection
- Roll results stored in database as JSON
- Type 'roll' for dice roll messages

**Tests:**
- 27 new tests for dice parser
- **97 tests passing**

**File Structure:**
```
packages/shared/src/
├── dice.ts              # Dice parser and roller
└── index.ts             # Re-exports dice functions

packages/server/src/
├── socket/index.ts      # Updated with dice roll detection
└── dice.test.ts         # Dice parser tests

packages/client/src/
├── lib/socket.ts        # DiceRollResult interface
└── components/features/chat/
    └── MessageList.tsx  # DiceRollDisplay component
```

**Commits:**
- `feat(dice): add dice roller with parser and chat integration`

---

### ✅ Milestone 8: WebRTC Voice - Signaling
**Status:** COMPLETED
**Completed:** 2026-01-07

**Implemented:**
- WebRTC signaling server with Socket.IO
- Offer/Answer/ICE candidate exchange
- Voice channel state management per room
- Connection state tracking

**Backend:**
- `voiceChannels.ts` - Voice state management (users per room)
- Socket events: `voice_join`, `voice_leave`, `voice_offer`, `voice_answer`, `voice_ice_candidate`
- Broadcast events: `voice_user_joined`, `voice_user_left`, `voice_state_changed`, `voice_speaking_changed`
- Automatic cleanup on user disconnect

**File Structure:**
```
packages/server/src/socket/
├── index.ts           # Updated with voice signaling events
└── voiceChannels.ts   # Voice state management
```

**Commits:**
- `feat(voice): add WebRTC voice chat with P2P mesh`

---

### ✅ Milestone 9: WebRTC Voice - P2P Mesh
**Status:** COMPLETED
**Completed:** 2026-01-07

**Implemented:**
- P2P mesh topology for voice (max 6 users)
- Audio capture with echo cancellation, noise suppression, auto gain control
- Peer-to-peer audio connections via WebRTC
- Mute/unmute functionality
- Push-to-talk (PTT) mode with Space key

**Frontend Components:**
- `VoiceManager` class - WebRTC peer connection management
- `VoiceControls` - Join/Leave button, Mute toggle, PTT mode switcher
- `VoiceParticipants` - User list with speaking indicators
- `voiceStore` - Zustand store for voice state

**WebRTC Configuration:**
- STUN servers: Google public STUN (stun.l.google.com)
- Audio constraints: echoCancellation, noiseSuppression, autoGainControl
- P2P mesh: Each user connects directly to every other user

**File Structure:**
```
packages/client/src/
├── lib/
│   ├── socket.ts          # Added voice socket functions
│   └── voiceManager.ts    # WebRTC peer connection management
├── stores/
│   └── voiceStore.ts      # Voice state management
└── components/features/voice/
    ├── VoiceControls.tsx  # Join/Mute/PTT controls
    ├── VoiceParticipants.tsx  # User list with indicators
    └── index.ts
```

---

### ✅ Milestone 10: Voice Activity Detection
**Status:** COMPLETED
**Completed:** 2026-01-07

**Implemented:**
- Voice activity detection using Web Audio API (AnalyserNode)
- Speaking indicators with green glow/ring animation
- Push-to-talk mode as alternative to always-on
- Configurable in voice settings dropdown

**Technical Details:**
- FFT-based audio level analysis (256-point FFT)
- Threshold-based speaking detection (15 average level)
- 100ms check interval for real-time responsiveness
- Speaking state broadcast via Socket.IO

**UI Features:**
- Green ring around avatar when speaking
- Pulsing animation for active speakers
- Compact view (avatars only) and full view (list with status)
- Mute indicator (red mic icon)
- Connection state indicators (connecting, connected, failed)

---

## Upcoming Milestones

### Milestone 11: Room Audio Isolation
**Status:** PLANNED

**Goals:**
- Separate voice channels per room
- Automatic voice channel switching
- Prevent audio bleed between rooms

**Deliverables:**
- Room-based peer connection management
- Voice channel switching logic
- Proper connection cleanup on room change

---

### Milestone 12: YouTube Music Player
**Status:** PLANNED

**Goals:**
- YouTube video/audio playback
- Playlist management
- DM controls (play/pause/skip/volume)
- Synchronized playback for all users

**Deliverables:**
- YouTube API integration or iframe player
- Playlist CRUD operations
- Playback controls for DM
- Audio synchronization across clients
- Volume controls

---

### Milestone 13: Soundboard
**Status:** PLANNED

**Goals:**
- Upload and store sound effects
- Play sounds in voice channel
- Sound categories and favorites
- Hotkeys for quick access

**Deliverables:**
- Sound file upload
- Sound storage (filesystem or database)
- Soundboard UI
- Sound playback in voice channel
- Keyboard shortcuts

---

### Milestone 14: Role-Based Permissions
**Status:** PLANNED

**Goals:**
- DM-only features (music control, soundboard, room management)
- Player restrictions
- Permission checks on UI and API

**Deliverables:**
- Permission middleware
- UI elements hidden/disabled based on role
- Permission-based feature access
- Admin panel for DM

---

### Milestone 15: UI Polish & UX
**Status:** PLANNED

**Goals:**
- Responsive design
- Dark theme
- Accessibility improvements
- Animations and transitions
- Error messages and loading states

**Deliverables:**
- Mobile-responsive layout
- Dark mode theme
- Loading spinners
- Toast notifications
- Keyboard shortcuts
- ARIA labels

---

### Milestone 16: Deployment & Documentation
**Status:** PLANNED

**Goals:**
- VPS deployment guide
- Environment configuration
- Database backups
- Monitoring and logging
- User documentation

**Deliverables:**
- Deployment scripts
- Environment setup guide
- nginx configuration (reverse proxy)
- SSL/TLS setup with Let's Encrypt
- Backup strategy
- User manual
- Troubleshooting guide

---

## Testing Progress

**Current Test Coverage:**
- ✅ Health endpoint (2 tests)
- ✅ User registration (7 tests)
- ✅ User login (6 tests)
- ✅ Protected routes (5 tests)
- ✅ JWT middleware (13 tests)
- ✅ Room CRUD operations (18 tests)
- ✅ DM functionality (19 tests)
- ✅ Dice parser (27 tests)

**Total:** 97 tests passing

**Testing Strategy:**
- Integration tests first (real server, real database)
- Use `fastify.inject()` for HTTP simulation
- Separate test database files per test suite
- No mocking of business logic or database layer
- Tests must pass before committing

---

## Technology Decisions

### Why SQLite?
- Simple deployment (single file database)
- No separate database server needed
- Perfect for self-hosted with low concurrent users
- Easy backups (just copy the file)

### Why WebRTC P2P Mesh?
- Low latency (direct peer connections)
- No media server needed (reduces costs)
- Scales well for small groups (max 6 users)
- Each client sends/receives 5 streams (manageable)

### Why Fastify?
- Faster than Express
- Built-in schema validation
- Plugin architecture
- Great TypeScript support

### Why Zustand?
- Simpler than Redux
- Less boilerplate
- Better TypeScript support
- Small bundle size

---

## Current Status

**Last Updated:** 2026-01-07
**Completed Milestones:** 10/16
**Progress:** 62.5%
**Next Milestone:** Room Audio Isolation

**Recent Activity:**
- ✅ Implemented WebRTC voice signaling via Socket.IO
- ✅ Built P2P mesh voice chat with VoiceManager class
- ✅ Added Voice Activity Detection with Web Audio API
- ✅ Created VoiceControls and VoiceParticipants UI components
- ✅ Implemented Push-to-Talk mode with Space key
- ✅ Added speaking indicators with animations

---

## Optional Milestones

### Optional: Audio Enhancements
**Status:** OPTIONAL / FUTURE

**Overview:**
Advanced audio processing features that can be implemented client-side using Web Audio API. These enhance voice quality without requiring server changes (P2P architecture).

**Potential Enhancements:**

#### 1. Per-User Volume Control
- Individual volume sliders for each participant
- Uses GainNode per remote audio stream
- Range: 0% to 200% (boost quiet users)

#### 2. ML-Based Noise Suppression (RNNoise)
- Client-side ML model (~85KB) compiled to WebAssembly
- Removes background noise: keyboard, fans, dogs, construction
- Based on Mozilla's RNNoise (same creator as Opus codec)
- No server required - runs entirely in browser
- Libraries: `@jitsi/rnnoise-wasm`, `rnnoise-wasm`

#### 3. Advanced Noise Gate
- AudioWorklet-based noise gate processor
- Configurable threshold, attack, release times
- Cuts audio below threshold for true silence
- Prevents breathing/ambient sounds when not speaking

#### 4. Audio Compressor/Limiter
- DynamicsCompressorNode for evening out volume
- Prevents loud shouts from clipping
- Boosts quiet speech for clarity
- Configurable threshold, ratio, attack, release

#### 5. High-Pass Filter
- Removes low-frequency rumble (<80Hz)
- Cuts AC hum, mic handling noise
- BiquadFilterNode with highpass type

#### 6. Spatial Audio (3D Positioning)
- Position each user's voice in 3D space
- Uses PannerNode with HRTF model
- Could map to D&D battle map positions
- Users "hear" where others are sitting

#### 7. Voice Effects (Fun/Optional)
- Pitch shifting for character voices
- Reverb for dungeon atmosphere
- Radio/walkie-talkie effect
- Monster voice filters for DM

**Technical Architecture:**
```
Microphone
    │
    ▼
┌─────────────────────────────────────────────────┐
│  LOCAL PROCESSING CHAIN (before WebRTC send)    │
│                                                 │
│  High-Pass Filter (80Hz)                        │
│       │                                         │
│       ▼                                         │
│  RNNoise (ML noise suppression)                 │
│       │                                         │
│       ▼                                         │
│  Noise Gate (cut silence)                       │
│       │                                         │
│       ▼                                         │
│  Compressor (even out volume)                   │
│       │                                         │
│       ▼                                         │
│  Limiter (prevent clipping)                     │
│                                                 │
└─────────────────────────────────────────────────┘
    │
    ▼
WebRTC (to peers)


WebRTC (from peers)
    │
    ▼
┌─────────────────────────────────────────────────┐
│  REMOTE PROCESSING CHAIN (after WebRTC recv)    │
│                                                 │
│  Per-User Volume (GainNode)                     │
│       │                                         │
│       ▼                                         │
│  Spatial Panner (3D position, optional)         │
│       │                                         │
│       ▼                                         │
│  Voice Effects (optional, fun)                  │
│                                                 │
└─────────────────────────────────────────────────┘
    │
    ▼
Speakers
```

**Why Client-Side?**
- Zero additional latency (no server round-trip)
- Works offline once loaded
- No server CPU/bandwidth costs
- Privacy: audio never touches server
- Web Audio API is powerful and well-supported

**Implementation Notes:**
- All processing uses native Web Audio API
- RNNoise requires WebAssembly support (all modern browsers)
- AudioWorklet for custom processors (noise gate)
- Can be toggled on/off per feature
- Settings stored in localStorage

**References:**
- RNNoise: https://jmvalin.ca/demo/rnnoise/
- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- AudioWorklet: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet
