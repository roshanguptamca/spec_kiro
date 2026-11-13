# Project Structure

## Current State

The project is in its initial setup phase. Only the following exist:

```
environment/
├── .git/
├── .kiro/
│   └── steering/
│       ├── product.md
│       ├── tech.md
│       └── structure.md
└── .gitignore
```

## Expected Structure (Node.js conventions)

Once development begins, follow this conventional layout:

```
environment/
├── src/              # Application source code
├── tests/            # Test files (mirror src/ structure)
├── .kiro/            # Kiro configuration and steering
├── .gitignore
├── package.json
└── README.md
```

## Notes for AI Assistants

- No `src/` or application folders exist yet — do not assume any directory structure.
- When creating new files, confirm the intended structure with the user first.
- Keep `tests/` mirroring `src/` for predictable test discovery.
- Update this file as the project structure evolves.
