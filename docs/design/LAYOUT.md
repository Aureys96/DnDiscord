# DnD Voice Chat - Layout Design

## Reference: Discord-Inspired Layout

We follow Discord's proven layout pattern, adapted for DnD sessions.

## Main Application Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              HEADER BAR (Optional)                           │
│  [App Logo]                    Room: Tavern of Heroes              [Settings]│
├─────────┬───────────────┬────────────────────────────────────┬───────────────┤
│         │               │                                    │               │
│  ROOM   │   CHANNEL     │           MAIN CONTENT             │    MEMBERS    │
│  LIST   │   SIDEBAR     │                                    │    SIDEBAR    │
│         │               │                                    │               │
│ ┌─────┐ │ # general     │  ┌──────────────────────────────┐  │  VOICE CHAT   │
│ │ R1  │ │ # planning    │  │                              │  │  ──────────   │
│ └─────┘ │               │  │    CHAT MESSAGES             │  │  🔊 Room      │
│ ┌─────┐ │ VOICE         │  │    or                        │  │    👑 DM      │
│ │ R2  │ │ ──────────    │  │    VOICE CHANNEL VIEW        │  │    🎭 Player1 │
│ └─────┘ │ 🔊 Main       │  │    or                        │  │    🎭 Player2 │
│ ┌─────┐ │   👑 DM       │  │    OTHER CONTENT             │  │               │
│ │ R3  │ │   🎭 Player1  │  │                              │  │  TEXT CHAT    │
│ └─────┘ │   🎭 Player2  │  │                              │  │  ──────────   │
│         │               │  │                              │  │  # general    │
│  ───    │ DM TOOLS      │  │                              │  │    👑 DM      │
│  [+]    │ ──────────    │  │                              │  │    🎭 Player1 │
│  New    │ 🎵 Music      │  │                              │  │               │
│  Room   │ 🔊 Sounds     │  └──────────────────────────────┘  │               │
│         │               │                                    │               │
├─────────┴───────────────┼────────────────────────────────────┴───────────────┤
│                         │                                                    │
│  USER CONTROLS          │              INPUT AREA                            │
│  [🎤][🔇][⚙️]            │  [Message input...        ] [🎲] [📎] [Send]       │
│  Username               │                                                    │
└─────────────────────────┴────────────────────────────────────────────────────┘
```

## Layout Regions

### 1. Room List (Leftmost - 64px wide)

- Vertical list of room icons/avatars
- Current room highlighted
- Add room button at bottom (DM only)
- Tooltip on hover showing room name

### 2. Channel Sidebar (200-240px wide)

- Room name at top
- Text channels section
- Voice channels section with connected users
- DM Tools section (visible to DM only):
  - Music Player toggle
  - Soundboard toggle
- Collapsible on mobile

### 3. Main Content Area (Flexible)

- Default: Text chat for selected channel
- Alternative views:
  - Voice channel focus (when in voice)
  - Settings panels
  - Music player expanded view
  - Soundboard expanded view

### 4. Members Sidebar (200-240px wide)

- Grouped by role (DM, Players)
- Online status indicators
- Currently speaking indicator
- Right-click for DM/profile options
- Collapsible

### 5. User Controls (Bottom Left)

- User avatar and name
- Microphone mute toggle
- Audio deafen toggle
- Settings button
- Always visible

### 6. Input Area (Bottom of Main Content)

- Message input field
- Dice roller button (opens dice panel)
- Attachment button (future)
- Send button
- Character counter (optional)

## Component Hierarchy

```
App
├── AuthPages (when not logged in)
│   ├── LoginPage
│   └── RegisterPage
│
└── MainLayout (when authenticated)
    ├── RoomList
    │   ├── RoomIcon (multiple)
    │   └── AddRoomButton
    │
    ├── ChannelSidebar
    │   ├── RoomHeader
    │   ├── ChannelList
    │   │   ├── ChannelCategory
    │   │   └── ChannelItem (multiple)
    │   ├── VoiceChannel
    │   │   └── VoiceUser (multiple)
    │   └── DMTools (conditional)
    │       ├── MusicPlayerToggle
    │       └── SoundboardToggle
    │
    ├── MainContent
    │   ├── ContentHeader
    │   ├── ChatView
    │   │   ├── MessageList
    │   │   │   └── Message (multiple)
    │   │   └── ChatInput
    │   │       ├── TextInput
    │   │       ├── DiceButton
    │   │       └── SendButton
    │   ├── VoiceView (alternative)
    │   ├── MusicPlayer (overlay/panel)
    │   └── Soundboard (overlay/panel)
    │
    ├── MembersSidebar
    │   ├── MemberCategory
    │   └── MemberItem (multiple)
    │
    └── UserControls
        ├── UserInfo
        ├── MicButton
        ├── DeafenButton
        └── SettingsButton
```

## Responsive Breakpoints

### Desktop (≥1200px)

- Full layout with all sidebars visible
- All features accessible

### Tablet (768px - 1199px)

- Room list + Main content visible
- Channel sidebar as overlay (hamburger menu)
- Members sidebar hidden (toggle button)

### Mobile (< 768px)

- Single column view
- Bottom navigation tabs:
  - Rooms
  - Chat
  - Voice
  - Members
- Swipe gestures for navigation

```
MOBILE LAYOUT
┌─────────────────────┐
│ [≡] Room Name   [👥]│  <- Header with toggles
├─────────────────────┤
│                     │
│   MAIN CONTENT      │
│   (Chat/Voice)      │
│                     │
│                     │
├─────────────────────┤
│ [Message...]   [🎲] │  <- Input
├─────────────────────┤
│ 🏠  💬  🎤  👥  ⚙️  │  <- Bottom nav
└─────────────────────┘
```

## Z-Index Layers

```
z-0:   Base content (chat messages)
z-10:  Sidebars
z-20:  Fixed elements (user controls, input)
z-30:  Dropdowns, tooltips
z-40:  Modals, overlays
z-50:  Notifications, toasts
z-60:  Critical alerts
```

## Scroll Behavior

- **Room List:** Scroll vertical, no horizontal
- **Channel Sidebar:** Scroll vertical within sections
- **Chat Messages:** Scroll vertical, auto-scroll to bottom on new message
- **Members List:** Scroll vertical
- **Music Player:** Fixed position, no scroll
- **Soundboard:** Grid with scroll if many sounds
