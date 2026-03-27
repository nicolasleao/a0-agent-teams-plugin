import re
import os

from helpers.api import ApiHandler, Input, Output, Request, Response
from helpers import subagents, projects, files

RESERVED_NAMES = {"default", "_example"}
NAME_PATTERN = re.compile(r"^[a-z0-9_]+$")


class AgentTeam(ApiHandler):
    async def process(self, input: Input, request: Request) -> Output:
        action = input.get("action", "")

        try:
            if action == "list_teams":
                data = self._list_teams()
            elif action == "list":
                data = self._list_agents(input.get("team"))
            elif action == "load":
                data = self._load_agent(input.get("name"))
            elif action == "save":
                data = self._save_agent(
                    input.get("name"), input.get("data"), input.get("team")
                )
            elif action == "delete":
                data = self._delete_agent(input.get("name"), input.get("team"))
            else:
                raise Exception("Invalid action")

            return {"ok": True, "data": data}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # ------------------------------------------------------------------ #
    # Teams
    # ------------------------------------------------------------------ #

    def _list_teams(self):
        teams = []

        # 1. Built-in (default) agents
        default_agents = subagents._get_agents_list_from_dir(
            subagents.DEFAULT_AGENTS_DIR, origin="default"
        )
        teams.append(
            {
                "id": "default",
                "title": "Built-in Agents",
                "scope": "default",
                "agent_count": len(default_agents),
                "is_mutable": False,
            }
        )

        # 2. Plugin agents (aggregate all plugin agent dirs)
        from helpers import plugins as plugins_helper

        plugin_agent_count = 0
        for plugin_dir in plugins_helper.get_enabled_plugin_paths(None, "agents"):
            plugin_agents = subagents._get_agents_list_from_dir(
                plugin_dir, origin="plugin"
            )
            plugin_agent_count += len(plugin_agents)
        if plugin_agent_count > 0:
            teams.append(
                {
                    "id": "plugin",
                    "title": "Plugin Agents",
                    "scope": "plugin",
                    "agent_count": plugin_agent_count,
                    "is_mutable": False,
                }
            )

        # 3. Global user agents
        global_agents = subagents._get_agents_list_from_dir(
            subagents.USER_AGENTS_DIR, origin="user"
        )
        teams.append(
            {
                "id": "global",
                "title": "Global Team",
                "scope": "user",
                "agent_count": len(global_agents),
                "is_mutable": True,
            }
        )

        # 4. Per-project agents
        try:
            project_list = projects.get_active_projects_list()
        except Exception:
            project_list = []

        for proj in project_list:
            proj_name = proj["name"]
            proj_agents_dir = projects.get_project_meta(proj_name, "agents")
            try:
                proj_agents = subagents._get_agents_list_from_dir(
                    proj_agents_dir, origin="project"
                )
                agent_count = len(proj_agents)
            except Exception:
                agent_count = 0

            teams.append(
                {
                    "id": f"project:{proj_name}",
                    "title": proj.get("title") or proj_name,
                    "scope": "project",
                    "project_name": proj_name,
                    "agent_count": agent_count,
                    "is_mutable": True,
                    "color": proj.get("color", ""),
                }
            )

        return teams

    # ------------------------------------------------------------------ #
    # Agents (team-scoped)
    # ------------------------------------------------------------------ #

    def _get_team_dir(self, team: str | None):
        """Resolve the filesystem directory for a given team id."""
        if not team or team == "default":
            return subagents.DEFAULT_AGENTS_DIR, "default", False
        if team == "plugin":
            return None, "plugin", False  # aggregated, handled specially
        if team == "global":
            return subagents.USER_AGENTS_DIR, "user", True
        if team.startswith("project:"):
            proj_name = team[len("project:") :]
            proj_dir = projects.get_project_meta(proj_name, "agents")
            return proj_dir, "project", True
        raise Exception(f"Unknown team: {team}")

    def _list_agents(self, team: str | None = None):
        if not team:
            # Legacy: return all merged agents
            agents = subagents.get_agents_list()
            result = []
            for agent in agents:
                item = agent.model_dump()
                item["is_deletable"] = "user" in agent.origin
                result.append(item)
            return result

        if team == "plugin":
            # Aggregate all plugin agent dirs
            from helpers import plugins as plugins_helper

            result = []
            for plugin_dir in plugins_helper.get_enabled_plugin_paths(None, "agents"):
                plugin_agents = subagents._get_agents_list_from_dir(
                    plugin_dir, origin="plugin"
                )
                for name, agent in plugin_agents.items():
                    item = agent.model_dump()
                    item["is_deletable"] = False
                    result.append(item)
            return result

        team_dir, origin, is_mutable = self._get_team_dir(team)
        agents_dict = subagents._get_agents_list_from_dir(team_dir, origin=origin)
        result = []
        for name, agent in agents_dict.items():
            item = agent.model_dump()
            item["is_deletable"] = is_mutable
            result.append(item)
        return result

    def _load_agent(self, name: str | None):
        if not name:
            raise Exception("Agent name is required")
        agent = subagents.load_agent_data(name)
        data = agent.model_dump()
        data["is_deletable"] = "user" in agent.origin or "project" in agent.origin
        return data

    def _save_agent(self, name: str | None, data: dict | None, team: str | None = None):
        if not name:
            raise Exception("Agent name is required")
        if not data:
            raise Exception("Agent data is required")
        if not NAME_PATTERN.match(name):
            raise Exception(
                "Invalid agent name. Use only lowercase letters, numbers, and underscores."
            )
        if name in RESERVED_NAMES:
            raise Exception(f"'{name}' is a reserved name and cannot be used.")

        # Determine save directory
        if team and team.startswith("project:"):
            proj_name = team[len("project:") :]
            save_dir = projects.get_project_meta(proj_name, "agents")
        else:
            # Default to global (usr/agents)
            save_dir = subagents.USER_AGENTS_DIR

        # Build agent data
        agent = subagents.SubAgent(
            name=name,
            title=data.get("title", name),
            description=data.get("description", ""),
            context=data.get("context", ""),
            enabled=data.get("enabled", True),
            prompts=data.get("prompts", {}),
        )

        # Write agent.json
        import json

        agent_dir = f"{save_dir}/{name}"
        agent_json = {
            "title": agent.title,
            "description": agent.description,
            "context": agent.context,
            "enabled": agent.enabled,
        }
        files.write_file(f"{agent_dir}/agent.json", json.dumps(agent_json, indent=2))

        # Write prompts
        prompts_dir = f"{agent_dir}/prompts"
        files.delete_dir(prompts_dir)
        prompts = agent.prompts or {}
        for pname, content in prompts.items():
            safe_name = files.safe_file_name(pname)
            if not safe_name.endswith(".md"):
                safe_name += ".md"
            files.write_file(f"{prompts_dir}/{safe_name}", content)

        # Reload and return
        return subagents.load_agent_data(name).model_dump()

    def _delete_agent(self, name: str | None, team: str | None = None):
        if not name:
            raise Exception("Agent name is required")

        # Determine which directory to delete from
        if team and team.startswith("project:"):
            proj_name = team[len("project:") :]
            delete_dir = projects.get_project_meta(proj_name, "agents", name)
            if not os.path.isdir(files.get_abs_path(delete_dir)):
                raise Exception(
                    f"Agent '{name}' not found in project '{proj_name}'"
                )
            files.delete_dir(delete_dir)
        elif team == "global" or not team:
            # Verify the agent exists in usr/agents
            agent_dir = f"{subagents.USER_AGENTS_DIR}/{name}"
            if not os.path.isdir(files.get_abs_path(agent_dir)):
                raise Exception(
                    f"Agent '{name}' not found in global user agents"
                )
            subagents.delete_agent_data(name)
        else:
            raise Exception(
                "Only global and project-scoped agents can be deleted."
            )

        return {"deleted": name}
