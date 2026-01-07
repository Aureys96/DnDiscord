# Claude Code Guidelines for DnD Voice Chat

## Critical Workflow Rules

### ALWAYS Run Tests, Linter, and Formatter Before Pushing

**Before pushing ANY code to remote, run these checks in order:**

1. **Run Tests**

   ```bash
   cd packages/server && npm run test
   ```

   All tests must pass. Never push broken code.

2. **Run Linter**

   ```bash
   npm run lint
   ```

   Fix all ESLint errors and warnings before committing.

3. **Run Formatter**
   ```bash
   npm run format
   ```
   Formats all TypeScript, JSON, and Markdown files with Prettier.

**Quick Check (all in one):**

```bash
cd packages/server && npm run test && cd ../.. && npm run lint && npm run format
```

- If any step fails, fix the issues before committing/pushing
- This is a hard rule - never skip these checks

## Commit Philosophy

- **Always commit meaningful changes with meaningful commit messages**
- This allows easy rollback if anything goes wrong
- Follow conventional commits format: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- Each commit should represent a working state

## Project Structure

- This is a TypeScript monorepo using npm workspaces
- Three packages: `shared`, `server`, `client`
- Shared types and utilities go in `@dnd-voice/shared`
- Never duplicate types between packages

## Code Style

- Use TypeScript strict mode
- Prefer functional components and hooks in React
- Use Zod for runtime validation at API boundaries
- Keep components small and focused
- Extract reusable logic into custom hooks

## UI/UX Guidelines

**Reference Design Documents:**

- `docs/design/LAYOUT.md` - Application layout and structure
- `docs/design/THEME.md` - Colors, typography, and visual styling
- `docs/design/COMPONENTS.md` - Component specifications and states

### Design Philosophy

- **Discord-inspired:** Follow Discord's proven layout patterns (three-column, sidebars, bottom controls)
- **Dark theme first:** Dark theme only for now (reduces eye strain during long DnD sessions)
- **DnD-focused:** Highlight DM tools, dice roller, and role distinctions
- **Consistency:** Use the same component patterns throughout the application

### Layout Rules

- Three-column layout: Room List (64px) → Channel Sidebar (240px) → Main Content (flex) → Members Sidebar (240px)
- User controls always at bottom-left (mic, deafen, settings)
- Chat input always at bottom of main content area
- Sidebars collapsible on smaller screens
- Mobile: Single column with bottom tab navigation

### Color Palette (Dark Theme)

```
Backgrounds:     gray-900 → gray-800 → gray-700 → gray-600 (hierarchy)
Text:            gray-50 (primary) → gray-300 → gray-400 → gray-500 (muted)
Accent:          violet-500 (primary actions, links, focus rings)
Success/Online:  emerald-500
Warning/Idle:    amber-500
Error/Muted:     red-500
DM Role:         amber-500 (gold crown theme)
Player Role:     violet-500
Speaking:        green-500 with glow effect
```

### Typography

- Font: System font stack (Inter preferred)
- Sizes: Use Tailwind scale (text-xs through text-2xl)
- Weights: normal (400), medium (500), semibold (600)
- Usernames: medium weight, role color
- Timestamps: text-xs, text-muted

### Component Standards

- **Buttons:** 40px height default, rounded-md, clear hover/active states
- **Inputs:** 40px height, bg-gray-800, border gray-700, focus ring violet-500
- **Cards/Panels:** bg-gray-800, rounded-lg, shadow-lg
- **Avatars:** rounded-full, sizes: 24/32/40/48/64/80px
- **Icons:** 20px default, use consistent icon library (Lucide or Heroicons)

### Interactive States

Every interactive element must have:

- Default state
- Hover state (bg change or scale)
- Active/pressed state
- Focus state (ring for accessibility)
- Disabled state (reduced opacity, no pointer)
- Loading state (spinner or skeleton)

### Spacing & Layout

- Use Tailwind spacing scale consistently
- Standard padding: 16px (p-4) for cards, 12px (p-3) for compact elements
- Standard gap: 8px (gap-2) for tight, 16px (gap-4) for normal
- Sidebar item height: 32-44px
- Message padding: 16px horizontal, 4px vertical (grouped messages)

### Animations

- Duration: 150ms default (fast, responsive feel)
- Easing: ease-in-out
- Use for: hover states, modals, toasts, panels sliding
- Speaking indicator: subtle pulse/glow animation
- Avoid: excessive animations that distract from content

### Responsive Breakpoints

- Desktop: ≥1200px (full layout)
- Tablet: 768-1199px (collapsible sidebars)
- Mobile: <768px (single column, bottom nav)

### Accessibility Requirements

- Focus visible on all interactive elements
- Color contrast: minimum 4.5:1 for text
- Keyboard navigation for all features
- ARIA labels on icon-only buttons
- Screen reader friendly (semantic HTML)
- PTT (Push-to-Talk) keyboard shortcut

### DM vs Player UI

- DM sees: Music player controls, Soundboard, Room management, User management
- Players see: Read-only music info, their own mute controls
- Use role checks to conditionally render DM-only features
- Never hide features with CSS only - check permissions in logic

### Component File Structure

```
src/components/
├── ui/                 # Generic reusable components
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Modal.tsx
│   └── ...
├── layout/            # Layout components
│   ├── MainLayout.tsx
│   ├── Sidebar.tsx
│   └── ...
├── features/          # Feature-specific components
│   ├── auth/
│   ├── chat/
│   ├── voice/
│   └── ...
└── hooks/             # Custom hooks
```

### State Management (Zustand)

- Auth store: user, token, login/logout actions
- UI store: sidebar visibility, active modals
- Chat store: messages, channels, send actions
- Voice store: connection state, peers, mute state
- Keep stores focused (single responsibility)

## Error Handling

- Always handle errors gracefully
- Provide user-friendly error messages
- Log errors for debugging (especially WebRTC issues)
- Never expose sensitive information in error messages

## Security

- Never commit secrets or credentials
- Use environment variables for configuration
- Validate all user inputs with Zod schemas
- Hash passwords with bcrypt
- Validate JWT tokens on protected routes

## Testing Strategy

### Manual Testing

- Test each milestone in Chrome browser using the browser automation tools
- **Chrome Extension:** The user disables the Chrome extension for security. If browser automation fails, ask the user to enable it before testing.
- Test with 2+ browser windows for real-time features
- Verify database persistence by refreshing the page
- Check console for errors after each implementation

### Automated Testing

**General Rules:**

- **All milestones must have automated tests before committing**
- **After each milestone is complete, write integration tests for the new functionality** - do this proactively without waiting to be asked
- Write tests that are adequate and can be relatively easily implemented
- Tests must pass before pushing code to remote
- Backend tests: Use Jest for API endpoints, middleware, and business logic
- Frontend tests: Use Vitest (Vite's test runner) for components and hooks when UI complexity grows

**Testing Strategy - Integration Tests First:**

We use **integration tests** as our primary testing approach:

- Test real Fastify server using `fastify.inject()` (simulates HTTP without network)
- Test real database operations using separate test database files
- Test real implementations (bcrypt, JWT, Zod validation, etc.)
- No mocking of business logic or database layer
- This ensures components work together correctly and catches real bugs

**Database Testing Approach:**

- Use separate test database files (e.g., `test-auth.db`, `test-health.db`)
- Set `process.env.DATABASE_PATH` to test database path in `beforeAll()`
- Initialize test database with real schema using `initializeDatabase()`
- Clean up test data in `beforeEach()` to ensure test isolation
- Delete test database file in `afterAll()`
- Never use the development database for tests

**Test Structure:**

```typescript
describe("Feature Name", () => {
  let fastify: FastifyInstance;
  const testDbPath = join(__dirname, "../../test-feature.db");

  beforeAll(async () => {
    // Setup: Create test database and Fastify server
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
    process.env.DATABASE_PATH = testDbPath;
    process.env.JWT_SECRET = "test-secret-key";
    initializeDatabase();

    fastify = Fastify({ logger: false });
    await fastify.register(routes);
    await fastify.ready();
  });

  afterAll(async () => {
    // Cleanup: Close server and delete test database
    await fastify.close();
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
  });

  beforeEach(() => {
    // Reset: Clean test data between tests
    const db = getDatabase();
    db.prepare("DELETE FROM table WHERE ...").run();
  });

  it("should do something specific", async () => {
    // Test implementation
  });
});
```

**Test Coverage Guidelines:**

- API endpoints: Test success cases, error cases (4xx), and edge cases
- Authentication: Test token validation, password hashing, protected routes, expired tokens
- Database operations: Test CRUD operations, unique constraints, foreign keys
- Middleware: Test both success and failure paths
- WebRTC signaling: Test offer/answer flow (when implemented)

**When to Switch to Unit Tests:**

- If integration tests become **too complex or difficult to implement** for a specific feature, you may propose switching to unit tests with mocks
- **IMPORTANT:** You must get explicit user approval before switching strategies
- When proposing, explain:
  - Why integration tests are too complex for this specific case
  - What would need to be mocked
  - Trade-offs (what bugs might we miss with mocks)
  - How you plan to structure the unit tests
- Maintain consistency: Don't mix strategies in the same test file

**Test Isolation Rules:**

- Each test must be independent (can run in any order)
- Never rely on state from previous tests
- Clean up all test data in `beforeEach()` or `afterEach()`
- Use descriptive test names: `'should reject registration with duplicate username'`
- Test one thing per test case

**What NOT to Mock:**

- Database layer (use real test database)
- Fastify server (use `fastify.inject()`)
- Business logic (bcrypt, JWT, Zod validation)
- Middleware (test real authentication flow)

**What TO Mock (if needed in future):**

- External APIs (third-party services)
- File system operations (if not using test files)
- Time-dependent behavior (use `jest.useFakeTimers()`)
- WebRTC browser APIs (use fake peer connections)

## Milestone Documentation

- **After implementing each milestone, provide a comprehensive explanation of how the new features work**
- Explanations should be detailed and educational, targeting a backend engineer learning frontend concepts
- Include:
  - End-to-end flow diagrams (text-based)
  - Step-by-step breakdowns of how data flows through the system
  - "Why" explanations for technical decisions (e.g., why bcrypt vs SHA-256)
  - Security considerations and what's protected vs not protected
  - Code examples showing key concepts
  - Analogies or comparisons to help understanding
- This helps the user understand the architecture and makes future debugging easier

## WebRTC Debugging

- Add extensive logging for WebRTC signaling
- Log each step: offer, answer, ICE candidates
- Monitor connection states: `iceConnectionState`, `connectionState`
- Test voice with headphones to avoid feedback

## Dependencies

- Only add dependencies that are necessary
- Prefer well-maintained packages with active communities
- Check bundle size impact for client dependencies
- Document why each dependency is needed

## Performance

- Lazy load routes in React
- Use React.memo for expensive components
- Debounce expensive operations (e.g., voice activity detection)
- Optimize database queries with proper indexes

## Accessibility

- Use semantic HTML
- Provide keyboard shortcuts (especially for PTT)
- Ensure sufficient color contrast
- Add ARIA labels where needed
