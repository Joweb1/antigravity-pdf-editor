const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");

const http = require("http");
const fs = require("fs");
const path = require("path");
const net = require("net");

// --- Configuration ---
const PROJECT_ROOT = path.join(__dirname, "..");

// --- Web Server State ---
let webServer = null;
let webServerPort = null;

// Finds an available TCP port dynamically allocated by the OS
function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

// Minimal, zero-dependency static file server
function startWebServer(dirPath, port) {
  if (webServer) {
    return Promise.resolve(webServerPort);
  }

  return new Promise((resolve, reject) => {
    webServer = http.createServer((req, res) => {
      const reqUrl = new URL(req.url, `http://localhost:${port}`);
      let filePath = path.join(dirPath, decodeURIComponent(reqUrl.pathname));

      try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, "index.html");
        }
      } catch (err) {
        res.statusCode = 500;
        res.end("Internal Server Error");
        return;
      }

      if (!fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.end(`File not found: ${req.url}`);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml"
      };

      const contentType = mimeTypes[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(filePath).pipe(res);
    });

    webServer.on("error", (err) => {
      console.error("HTTP server error:", err);
      reject(err);
    });

    webServer.listen(port, () => {
      webServerPort = port;
      console.error(`HTTP server running at http://localhost:${port}`);
      resolve(port);
    });
  });
}

// Stop the HTTP server to free resources when requested
function stopWebServer() {
  if (webServer) {
    webServer.close();
    webServer = null;
    webServerPort = null;
    console.error("HTTP server stopped.");
  }
}

// --- MCP Server Setup ---
const mcpServer = new Server(
  {
    name: "korlyn-pdf",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register Tool Definitions
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "open_in_editor",
        description: "Save a JSON layout configuration to the workspace and launch the editor on a secure random free port.",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "The name of the schema file to save (e.g. 'document.json')."
            },
            jsonData: {
              type: "object",
              description: "The complete Korlyn PDF JSON configuration matching the skill schema structure."
            }
          },
          required: ["filename", "jsonData"]
        }
      },
      {
        name: "stop_editor_server",
        description: "Stop the background web editor server to release the port and system resources.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ]
  };
});

// Handle Tool Calls
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "open_in_editor") {
      const filename = args.filename.endsWith(".json") ? args.filename : `${args.filename}.json`;
      const filePath = path.join(PROJECT_ROOT, filename);
      
      // 1. Write JSON data to the workspace
      fs.writeFileSync(filePath, JSON.stringify(args.jsonData, null, 2), "utf8");
      console.error(`Saved schema config to: ${filePath}`);

      // 2. Start local HTTP server on demand (finds a free port if not running)
      if (!webServer) {
        const freePort = await getFreePort();
        await startWebServer(PROJECT_ROOT, freePort);
      }

      // 3. Return launching URL link
      const editorUrl = `http://localhost:${webServerPort}/?load=${filename}`;
      return {
        content: [
          {
            type: "text",
            text: `Successfully created document layout config file: ${filename}\nEditor URL: ${editorUrl}\n\nYou can click the URL to open it in your browser, or drag the file into your existing editor window.`
          }
        ]
      };
    } else if (name === "stop_editor_server") {
      if (webServer) {
        stopWebServer();
        return {
          content: [
            {
              type: "text",
              text: "Editor web server has been successfully stopped."
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: "Editor web server was not running."
            }
          ]
        };
      }
    } else {
      throw new Error(`Tool not found: ${name}`);
    }
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing tool: ${error.message}`
        }
      ]
    };
  }
});

// Run server using Stdio transport (Standard input/output communication)
async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error("Korlyn PDF MCP server running.");
}

main().catch((error) => {
  console.error("Fatal error starting MCP server:", error);
  process.exit(1);
});
