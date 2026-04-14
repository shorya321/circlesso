# Git Workflow

## Commit After Every Feature

Each completed feature gets its own commit:
```
feat: implement F0XX — <short description>
```

## Commit Types
- `feat:` — new feature implementation
- `fix:` — bug fix
- `refactor:` — code restructuring without behavior change
- `test:` — adding or updating tests
- `chore:` — dependencies, config, tooling

## Rules
- Commit only when build passes and tests pass
- Never commit `.env.local` or secrets
- Update `claude-progress.txt` after each commit
- Update `feature-list.json` (`passes` field only) before committing
