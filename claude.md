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
- Test each milestone in Chrome browser
- Test with 2+ browser windows for real-time features
- Verify database persistence by refreshing the page
- Check console for errors after each implementation

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
