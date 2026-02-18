# Project-Management-Tool

A dynamic Jira-style Kanban dashboard for SOC project execution.

## Features

- Preloaded with the provided SOC implementation phases and tasks.
- Jira-like workflow columns:
  - To Do
  - In Progress
  - Review
  - Completed
- Swimlanes by phase inside each status column.
- Assignee avatars on each card.
- Priority chips (`Highest`, `High`, `Medium`, `Low`) with filtering.
- Live search across phase, task title, description, and assignee.
- Dynamic progress cards (total, per status, completion percentage).
- Phase-based filtering.
- Add/delete tasks directly from the UI.
- Light/Dark theme toggle with persistent preference.
- Local storage persistence so board updates remain after refresh.

## Run locally (recommended)

```bash
npm start
```

Then open:

- `http://localhost:8000`
- or `http://127.0.0.1:8000`

## Alternative run command

```bash
python3 -m http.server 8000
```

## Troubleshooting "Not Found"

- Make sure you run the command **inside this repository folder** (`/workspace/Project-Management-Tool`).
- Use exactly `http://localhost:8000` (or `http://localhost:8000/index.html`).
- If port `8000` is busy, run with another port:

```bash
PORT=8080 npm start
```

Then open `http://localhost:8080`.
