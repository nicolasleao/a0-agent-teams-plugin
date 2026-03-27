import { createStore } from "/js/AlpineStore.js";
import * as API from "/js/api.js";
import { store as notificationStore } from "/components/notifications/notification-store.js";

const AGENT_TEAM_API = "/plugins/agent_teams/agent_teams";

function toast(text, type = "info", timeout = 5000) {
  notificationStore.addFrontendToastOnly(type, text, "", timeout / 1000);
}

export const store = createStore("agentTeamStore", {
  // --- Teams State ---
  teams: [],
  selectedTeam: null,
  currentView: "teams", // "teams" | "agents"
  loadingTeams: false,

  // --- Agents State ---
  agents: [],
  selectedAgent: null,
  editMode: "view", // "view" | "create" | "edit"
  loading: false,
  loadingAgent: false,

  // --- Form ---
  form: {
    name: "",
    title: "",
    description: "",
    context: "",
    enabled: true,
    prompts: {},
  },

  // Track new prompt files being added
  newPromptName: "",

  // --- Lifecycle ---
  async onOpen() {
    await this.loadTeams();
  },

  cleanup() {
    this.teams = [];
    this.selectedTeam = null;
    this.currentView = "teams";
    this.agents = [];
    this.selectedAgent = null;
    this.editMode = "view";
    this.resetForm();
  },

  // --- Teams Methods ---
  async loadTeams() {
    this.loadingTeams = true;
    try {
      const response = await API.callJsonApi(AGENT_TEAM_API, {
        action: "list_teams",
      });
      if (response.ok) {
        this.teams = response.data;
      } else {
        toast(response.error || "Failed to load teams", "error");
      }
    } catch (e) {
      toast("Failed to load teams: " + e.message, "error");
    } finally {
      this.loadingTeams = false;
    }
  },

  async selectTeam(team) {
    this.selectedTeam = team;
    this.currentView = "agents";
    this.selectedAgent = null;
    this.editMode = "view";
    this.resetForm();
    await this.loadAgents();
  },

  async backToTeams() {
    this.currentView = "teams";
    this.selectedTeam = null;
    this.agents = [];
    this.selectedAgent = null;
    this.editMode = "view";
    this.resetForm();
    await this.loadTeams();
  },

  // --- CRUD Methods ---
  async loadAgents() {
    this.loading = true;
    try {
      const teamId = this.selectedTeam?.id || null;
      const response = await API.callJsonApi(AGENT_TEAM_API, {
        action: "list",
        team: teamId,
      });
      if (response.ok) {
        this.agents = response.data;
      } else {
        toast(response.error || "Failed to load agents", "error");
      }
    } catch (e) {
      toast("Failed to load agents: " + e.message, "error");
    } finally {
      this.loading = false;
    }
  },

  async loadAgent(name) {
    this.loadingAgent = true;
    try {
      const response = await API.callJsonApi(AGENT_TEAM_API, {
        action: "load",
        name: name,
      });
      if (response.ok) {
        this.selectedAgent = response.data;
        this.editMode = "view";
      } else {
        toast(response.error || "Failed to load agent", "error");
      }
    } catch (e) {
      toast("Failed to load agent: " + e.message, "error");
    } finally {
      this.loadingAgent = false;
    }
  },

  async saveAgent() {
    const name = this.editMode === "create" ? this.form.name : this.selectedAgent?.name;
    if (!name) {
      toast("Agent name is required", "error");
      return;
    }

    const teamId = this.selectedTeam?.id || "global";

    // Convert prompts array [{name, content}] to object {name: content}
    const promptsObj = {};
    if (Array.isArray(this.form.prompts)) {
      this.form.prompts.forEach(p => {
        if (p.name) {
          promptsObj[p.name] = p.content || "";
        }
      });
    }

    this.loading = true;
    try {
      const response = await API.callJsonApi(AGENT_TEAM_API, {
        action: "save",
        name: name,
        team: teamId,
        data: {
          title: this.form.title,
          description: this.form.description,
          context: this.form.context,
          enabled: this.form.enabled,
          prompts: promptsObj,
        },
      });
      if (response.ok) {
        toast("Agent saved successfully", "success");
        await this.loadAgents();
        await this.loadAgent(name);
      } else {
        toast(response.error || "Failed to save agent", "error");
      }
    } catch (e) {
      toast("Failed to save agent: " + e.message, "error");
    } finally {
      this.loading = false;
    }
  },

  async deleteAgent(name) {
    if (!confirm(`Delete agent "${name}"? This cannot be undone.`)) return;

    const teamId = this.selectedTeam?.id || "global";

    this.loading = true;
    try {
      const response = await API.callJsonApi(AGENT_TEAM_API, {
        action: "delete",
        name: name,
        team: teamId,
      });
      if (response.ok) {
        toast("Agent deleted", "success");
        this.selectedAgent = null;
        this.editMode = "view";
        await this.loadAgents();
      } else {
        toast(response.error || "Failed to delete agent", "error");
      }
    } catch (e) {
      toast("Failed to delete agent: " + e.message, "error");
    } finally {
      this.loading = false;
    }
  },

  // --- UI Actions ---
  openCreate() {
    this.selectedAgent = null;
    this.editMode = "create";
    this.resetForm();
  },

  openEdit() {
    if (!this.selectedAgent) return;
    this.editMode = "edit";
    
    // Convert prompts object {name: content} to array [{name, content}]
    const promptsObj = this.selectedAgent.prompts || {};
    const promptsArray = Object.entries(promptsObj).map(([name, content]) => ({
      name: name,
      content: content
    }));
    
    this.form = {
      name: this.selectedAgent.name,
      title: this.selectedAgent.title || "",
      description: this.selectedAgent.description || "",
      context: this.selectedAgent.context || "",
      enabled: this.selectedAgent.enabled !== false,
      prompts: promptsArray,
    };
  },

  cancelEdit() {
    if (this.editMode === "create") {
      this.selectedAgent = null;
    }
    this.editMode = "view";
    this.resetForm();
  },

  resetForm() {
    this.form = {
      name: "",
      title: "",
      description: "",
      context: "",
      enabled: true,
      prompts: [], // Initialize as array for the form
    };
    this.newPromptName = "";
  },

  // --- Prompt helpers ---
  addPrompt() {
    let name = this.newPromptName.trim();
    if (!name) return;
    if (!name.endsWith(".md")) name += ".md";
    // Check if prompt with this name already exists (array format)
    if (this.form.prompts.some(p => p.name === name)) {
      toast("Prompt file already exists", "warning");
      return;
    }
    // Add new prompt to array
    this.form.prompts.push({ name: name, content: "" });
    this.newPromptName = "";
  },

  removePrompt(index) {
    if (typeof index === 'number' && index >= 0 && index < this.form.prompts.length) {
      this.form.prompts.splice(index, 1);
    }
  },

  updatePromptContent(index, content) {
    if (typeof index === 'number' && index >= 0 && index < this.form.prompts.length) {
      this.form.prompts[index].content = content;
    }
  },

  // --- Helpers ---
  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  },

  originBadgeClass(origin) {
    if (!origin || !origin.length) return "badge-default";
    if (origin.includes("user")) return "badge-user";
    if (origin.includes("plugin")) return "badge-plugin";
    if (origin.includes("project")) return "badge-project";
    return "badge-default";
  },

  originLabel(origin) {
    if (!origin || !origin.length) return "default";
    if (origin.includes("project")) return "project";
    if (origin.includes("user")) return "user";
    if (origin.includes("plugin")) return "plugin";
    return "default";
  },

  teamIcon(team) {
    if (team.scope === "default") return "shield";
    if (team.scope === "plugin") return "extension";
    if (team.scope === "user") return "public";
    if (team.scope === "project") return "folder";
    return "group";
  },

  teamScopeLabel(team) {
    if (team.scope === "default") return "Read-only";
    if (team.scope === "plugin") return "Read-only";
    if (team.scope === "user") return "Editable";
    if (team.scope === "project") return "Editable";
    return "";
  },

  get promptEntries() {
    return Object.entries(this.form.prompts || {});
  },

  get selectedPromptEntries() {
    if (!this.selectedAgent?.prompts) return [];
    return Object.entries(this.selectedAgent.prompts);
  },

  get canCreateAgent() {
    return this.selectedTeam?.is_mutable === true;
  },
});
