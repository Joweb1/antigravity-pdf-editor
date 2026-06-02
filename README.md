# antigravity-pdf-editor

An installable web editor and Model Context Protocol (MCP) server extension for **Antigravity CLI** and other AI assistants. This extension enables the AI to act as a layout designer and content writer, generating documents and opening them on a dynamically allocated local port for you to visually edit, sign, and export to PDF.

---

## 🚀 One-Click Auto-Installation Prompts

If you are using an AI coding assistant (like Antigravity, Claude, Roo Code, or Cursor), copy the corresponding prompt below, paste it directly into your chat, and the agent will install the extension and set up all settings automatically!

### 1. For Antigravity Users
> ```text
> Hey Antigravity, I want to install this 'antigravity-pdf-editor' MCP extension. Please perform the following steps automatically:
> 1. Check if the directory 'antigravity-pdf-editor' exists in my current workspace. If not, clone the repository 'https://github.com/Joweb1/antigravity-pdf-editor.git' into my workspace.
> 2. Navigate to 'antigravity-pdf-editor/mcp-server' and run 'npm install' to set up dependencies (use bypassed execution policy if on Windows powershell).
> 3. Locate my global Antigravity config file (usually at '~/.antigravitycli/config.json' or in my workspace config).
> 4. Read the config JSON and insert the following entry under 'mcpServers':
>    "korlyn-pdf": {
>      "command": "node",
>      "args": ["<absolute-path-to-cloned-folder>/mcp-server/index.js"]
>    }
>    (Replace <absolute-path-to-cloned-folder> with the actual absolute path to 'antigravity-pdf-editor' in my workspace).
> 5. Save the configuration and verify the paths.
> 6. Once finished, explain what you did and advise me to restart this CLI session to activate the new tools.
> ```

### 2. For Claude Desktop Users
> ```text
> Hey Claude, please install the 'antigravity-pdf-editor' MCP server extension locally on my machine:
> 1. Verify if 'antigravity-pdf-editor' exists in my current directory. If not, clone 'https://github.com/Joweb1/antigravity-pdf-editor.git'.
> 2. Navigate to 'antigravity-pdf-editor/mcp-server' and run 'npm install'.
> 3. Open my Claude Desktop config file (located at '%APPDATA%\Claude\claude_desktop_config.json' on Windows or '~/Library/Application Support/Claude/claude_desktop_config.json' on macOS).
> 4. Add the following entry under 'mcpServers':
>    "korlyn-pdf": {
>      "command": "node",
>      "args": ["<absolute-path-to-folder>/mcp-server/index.js"]
>    }
>    (Replace <absolute-path-to-folder> with the actual absolute path to the cloned repository).
> 5. Save the configuration and verify the paths. Once finished, tell me how to restart Claude Desktop to load the tools.
> ```

### 3. For Roo Code (VS Code Extension) Users
> ```text
> Hey Roo, please set up the 'antigravity-pdf-editor' MCP extension:
> 1. Clone the repository 'https://github.com/Joweb1/antigravity-pdf-editor.git' to my workspace if it's not already here.
> 2. Navigate to 'antigravity-pdf-editor/mcp-server' and run 'npm install' to install the dependencies.
> 3. Open my Roo Code MCP settings file (on Windows at '%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json' or on macOS/Linux in the corresponding VS Code user storage folder).
> 4. Add the following configuration under 'mcpServers':
>    "korlyn-pdf": {
>      "command": "node",
>      "args": ["<absolute-path-to-folder>/mcp-server/index.js"],
>      "disabled": false,
>      "alwaysAllow": []
>    }
>    (Replace <absolute-path-to-folder> with the actual absolute path to the cloned repository).
> 5. Save the configuration. Tell me when the tools are active and ready to be used.
> ```

### 4. For Cursor Users / General AI Assistants
> ```text
> Hey Cursor, I want to set up 'antigravity-pdf-editor' as an MCP tool:
> 1. Clone the repository 'https://github.com/Joweb1/antigravity-pdf-editor.git' to my workspace if it doesn't exist.
> 2. Navigate to 'antigravity-pdf-editor/mcp-server' and run 'npm install'.
> 3. Find the absolute path to 'antigravity-pdf-editor/mcp-server/index.js'.
> 4. Provide me with clear step-by-step instructions on how to add this path in my Cursor settings panel (Cursor Settings > Features > MCP) using 'command' as 'node' and 'args' pointing to the absolute index.js script path.
> 5. Create a test document JSON in the workspace to verify everything is ready.
> ```

---

## Manual Installation Guide

### Step 1: Clone the Repository
Clone the repository to your local machine:
```bash
git clone https://github.com/Joweb1/antigravity-pdf-editor.git
```

### Step 2: Install Node Dependencies
Navigate to the server directory and install dependencies:
```bash
cd antigravity-pdf-editor/mcp-server
npm install
```

### Step 3: Configure Your AI Client
Add the server registration block to your client's config file (e.g. `~/.antigravitycli/config.json` for Antigravity or the paths mentioned in the prompts above):

```json
{
  "mcpServers": {
    "korlyn-pdf": {
      "command": "node",
      "args": ["C:/Users/Jovibe Code/antigravity-pdf-editor/mcp-server/index.js"]
    }
  }
}
```
*(Make sure to update the absolute path to point to your exact installation directory).*

---

## Exposed MCP Tools

Once installed, the following tools become available to the AI agent:

1. `open_in_editor`
   * **Purpose:** Takes a JSON document layout config and a target filename, writes the file, starts the local HTTP file server on a dynamic free port (if not running), and returns the launching URL.
   * **Parameters:** `filename` (string), `jsonData` (object).
2. `stop_editor_server`
   * **Purpose:** Shuts down the background HTTP web server to release the port and system resources.

---

## How to use the Skill

To instruct the AI to generate documents:
1. Reference the skill file using the browser or file view commands:
   * *"Load the skill at C:/Users/Jovibe Code/antigravity-pdf-editor/korlyn-pdf-generator.skill.md"*
2. Ask the AI to make a document:
   * *"Create an official cover letter for a project manager position and open it in the editor."*
3. The AI will write the layout config JSON and call the `open_in_editor` tool, returning a clickable browser editing link.

---

## Features
1. **Interactive Workspace:** Drag-and-drop, resize, and edit text, shapes, or images.
2. **Signature Pad:** Draw signatures inside a modal; the editor trims whitespace and converts them to transparent PNG blocks that you can place anywhere.
3. **Pre-designed Templates:** Built-in templates for Premium Invoices, Resumes, and Official Letters.
4. **On-Demand Web Server:** The background web server *only* starts when you ask the AI to open a document, utilizing a random free port to prevent conflicts. It can be stopped at any time via an MCP tool call.
5. **100% Offline Capability:** Dependencies (`pdf-lib.min.js`) are bundled locally. It requires zero active internet connection to compile PDFs.
