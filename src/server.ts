import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";

const server = new Server(
  { name: "ticketing-mcp", version: "0.2.0" },
  { capabilities: { tools: {} } }
);

// Available tools list
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "read_log_file",
      description:
        "Reads the contents of a log file from the local logs/ directory. Use this tool whenever the user mentions logs, a log file by name, or wants to investigate an issue with log evidence before creating a ticket.",
      inputSchema: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description: "Name of the log file, e.g. terminal_sunmi.log",
          },
        },
        required: ["filename"],
      },
    },
    {
      name: "create_ticket",
      description:
        "Creates a structured bug ticket in the local mock backend (mock_tickets.json). Use this AFTER you have gathered enough concrete information from the user and/or log files. Do NOT call this tool if you are missing critical information — instead ask the user a clarifying question first. Do NOT invent values for any field; if something is unknown, either ask the user or omit the optional field. Severity guidance: Critical = blocks transactions or causes data loss, High = degrades a core flow, Medium = workaround exists, Low = cosmetic. Judge severity by actual impact, NOT by how the user frames it.",
      inputSchema: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description:
              "Short summary, max 100 chars. Format: action + component + symptom. Example: 'Payment timeout on Sunmi terminal during loyalty card transaction'.",
          },
          description: {
            type: "string",
            description:
              "Detailed problem description: what happened, expected vs actual behavior, observed impact. Include facts from logs if available. Do not speculate.",
          },
          severity: {
            type: "string",
            enum: ["Critical", "High", "Medium", "Low"],
            description: "Severity based on business impact, not on user framing.",
          },
          component: {
            type: "string",
            description:
              "Affected component, e.g. 'Payment Gateway', 'Sunmi Terminal', 'Loyalty Service', 'UI'.",
          },
          steps_to_reproduce: {
            type: "array",
            items: { type: "string" },
            description:
              "Numbered, action-oriented steps. Include timestamps if known from logs.",
          },
          version_affected: {
            type: "string",
            description:
              "Version where the bug occurs, e.g. '2.4.1'. Omit if not known — do not guess.",
          },
        },
        required: ["title", "description", "severity", "component"],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "read_log_file") {
    const filename = args?.filename as string;

    // Security: prevent escaping the logs/ directory
    if (filename.includes("..") || filename.includes("/")) {
      return {
        content: [
          {
            type: "text",
            text: `Error: filename must be a plain name without path separators`,
          },
        ],
        isError: true,
      };
    }

    const filePath = path.join(process.cwd(), "logs", filename);

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return {
        content: [
          {
            type: "text",
            text: `--- ${filename} ---\n${content}`,
          },
        ],
      };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error reading file: ${e.message}` }],
        isError: true,
      };
    }
  }

  if (name === "create_ticket") {
    const ticket = {
      id: `MOCK-${Date.now()}`,
      created_at: new Date().toISOString(),
      status: "Open",
      title: args?.title,
      description: args?.description,
      severity: args?.severity,
      component: args?.component,
      steps_to_reproduce: args?.steps_to_reproduce ?? [],
      version_affected: args?.version_affected ?? null,
    };

    const filePath = path.join(process.cwd(), "mock_tickets.json");
    let existing: any[] = [];

    // Defensive read: an empty or corrupted file must not crash the server
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8").trim();
        existing = raw.length > 0 ? JSON.parse(raw) : [];
      }
    } catch (e: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error reading existing mock_tickets.json: ${e.message}. Aborting to avoid data loss.`,
          },
        ],
        isError: true,
      };
    }

    existing.push(ticket);
    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), "utf-8");

    return {
      content: [
        {
          type: "text",
          text: `Ticket ${ticket.id} created.\nTitle: ${ticket.title}\nSeverity: ${ticket.severity}\nComponent: ${ticket.component}\nVersion: ${ticket.version_affected ?? "not specified"}\nStored in mock_tickets.json (${existing.length} tickets total).`,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);

// Log to stderr (stdout is reserved for the MCP protocol)
console.error(
  "Ticketing MCP server v0.2.0 running on stdio — tools: read_log_file, create_ticket"
);