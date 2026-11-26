# N100M Business Builder — Developer Instructions

## Project workflow
- Read PROJECT_STATE.md before starting work.
- Read the relevant product and architecture documentation.
- Work on one clearly defined task at a time.
- Do not introduce features outside the approved scope.
- Ask for clarification when a decision materially affects architecture or product behaviour.
- Keep implementation simple and maintainable.

## Git rules
- Commit completed, working milestones.
- Use descriptive commit messages.
- Push commits to GitHub regularly.
- Never overwrite or discard existing work without approval.
- Do not commit secrets, API keys or credentials.
- Keep PROJECT_STATE.md updated before handing over work.

## Handover rules
Before stopping:
1. Commit and push completed work.
2. Update PROJECT_STATE.md.
3. Record unfinished work and known issues.
4. State the exact next task.
5. Ensure the repository is in a reproducible state.

## Product principles
- Mobile-first responsive web application.
- Capacitor-compatible Android application.
- Local-first, with no mandatory account or cloud service.
- AI is optional; core functionality must work without it.
- Obsidian-compatible Markdown import/export is essential.
- Preserve user data and portability.
- Follow the approved Master Product Specification.

## Testing
- Tests use Vitest and live next to the code they test as `*.test.ts` (included from `src/`).
- Run `npm test` (single run) or `npm run test:watch`. Run `npm run typecheck`, `npm run build` and `npm test`
  before handing over.
- Test the real implementation. Do not change production behaviour to make a test pass, and do not report tests
  as passing unless they were actually run.
- Vitest 5 needs Node 22.12+; the project supports Node >=20.19, so stay on Vitest 4 until the minimum Node
  version is raised.

## Code Delivery and File Transfer

The developer uses Claude's website, not Claude Code.

For every implementation task:

1. Work on the files relevant to the assigned task.
2. Package all new and modified files into a downloadable ZIP archive.
3. Include only the files needed to apply the changes. Never package the entire project unnecessarily.
4. Preserve the original directory structure inside the ZIP so files can be extracted directly into the project root.
5. Do not paste source code or large code blocks into chat.
6. Provide a brief summary of changed files, implementation details, dependencies and any required setup commands.
7. Clearly identify any files that must not be overwritten.
8. Do not claim that changes have been tested unless they actually have been tested.

The user will download the ZIP, extract it into the VS Code project folder, inspect the changes, and commit them to GitHub.

Every delivery must be suitable for a clean handover to another developer.