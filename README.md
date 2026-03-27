# 👥 Agent Teams

An [Agent Zero](https://github.com/agent0ai/agent-zero) plugin for managing agent profiles across teams with support for built-in, global, plugin, and per-project scopes.

## Features

- **Organized Teams** — agents are organized into teams: Built-in, Plugin, Global, and per-project
- **Procedural Avatars** — each agent gets a unique generated SVG avatar based on their name
- **Team Scoping** — manage agents at different levels:
  - **Built-in Agents** — read-only system agents
  - **Plugin Agents** — agents provided by installed plugins
  - **Global Team** — user-created agents available across all projects
  - **Project Teams** — agents specific to individual projects
- **CRUD Operations** — create, edit, and delete agents (mutable teams only)
- **Agent Profiles** — customize agent name, title, description, system context, and prompt files
- **Persistent Storage** — agents are saved to the filesystem and persist across restarts

## How It Works

The plugin adds a "teams" button to the sidebar that opens a modal interface. An Alpine.js store manages the team/agent state and communicates with a backend API to perform CRUD operations. Agents are stored in different directories based on their team scope, with built-in and plugin agents being read-only while global and project agents can be modified.

## Installation

1. Install via the **Agent Zero Plugin Hub**, or clone this repo into your `usr/plugins/` directory:
   ```bash
   cd /path/to/agent-zero/usr/plugins/
   git clone https://github.com/nicolasleao/a0-agent-teams-plugin.git agent_teams
   ```
2. Enable the plugin in **Settings → Plugins**
3. Hard-refresh the page (`Ctrl+Shift+R`)

## Plugin Structure

```
agent_teams/
├── plugin.yaml                          # Plugin manifest
├── api/
│   └── agent_teams.py                   # API handler (list, load, save, delete)
├── extensions/
│   └── webui/
│       └── sidebar-quick-actions-main-start/
│           └── agent-team-entry.html    # Sidebar button injection
└── webui/
    ├── agent-team-store.js              # Alpine.js store (teams, agents, CRUD)
    ├── avatar.js                        # Procedural SVG avatar generator
    └── main.html                        # Teams modal UI
```

## License

MIT
