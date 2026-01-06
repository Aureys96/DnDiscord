# Claude Code Guidelines for DnD Voice Chat

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
- Test each milestone in Chrome browser
- Test with 2+ browser windows for real-time features
- Verify database persistence by refreshing the page
- Check console for errors after each implementation

### Automated Testing

**General Rules:**
- **All milestones must have automated tests before committing**
- Write tests that are adequate and can be relatively easily implemented
- Tests must pass before pushing code to remote
- Add new tests for new functionality after each milestone (when reasonable)
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
describe('Feature Name', () => {
  let fastify: FastifyInstance;
  const testDbPath = join(__dirname, '../../test-feature.db');

  beforeAll(async () => {
    // Setup: Create test database and Fastify server
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
    process.env.DATABASE_PATH = testDbPath;
    process.env.JWT_SECRET = 'test-secret-key';
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

  it('should do something specific', async () => {
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
