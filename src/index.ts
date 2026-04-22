#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { PeopleForceClient, PeopleForceError } from "./client.js";

const apiKey = process.env.PEOPLEFORCE_API_KEY;
const baseUrl = process.env.PEOPLEFORCE_BASE_URL;
if (!apiKey) {
  console.error("ERROR: PEOPLEFORCE_API_KEY env var not set");
  process.exit(1);
}
const client = new PeopleForceClient(apiKey, baseUrl);

const Page = {
  page: z.number().int().min(1).optional().describe("Page number (1-based). Default 1."),
  per_page: z.number().int().min(1).max(100).optional().describe("Items per page (max 100). Default 50."),
};

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

interface ToolDef {
  tool: Tool;
  schema: z.ZodTypeAny;
  handler: Handler;
}

function paginated(path: string, description: string, extra: z.ZodRawShape = {}): ToolDef {
  const schema = z.object({ ...Page, ...extra });
  const tool: Tool = {
    name: toolNameFromPath(path),
    description,
    inputSchema: zodToJsonSchema(schema),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  };
  return {
    tool,
    schema,
    handler: async (args) => client.list(path, args as Record<string, string | number>),
  };
}

function toolNameFromPath(path: string): string {
  return "peopleforce_list_" + path.replace(/^\/+/, "").replace(/\//g, "_");
}

function zodToJsonSchema(schema: z.ZodTypeAny): Tool["inputSchema"] {
  if (!(schema instanceof z.ZodObject)) {
    return { type: "object", properties: {} };
  }
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const properties: Record<string, object> = {};
  const required: string[] = [];
  for (const [key, field] of Object.entries(shape)) {
    properties[key] = zodFieldToJsonSchema(field);
    if (!field.isOptional()) required.push(key);
  }
  return {
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
  };
}

function zodFieldToJsonSchema(field: z.ZodTypeAny): Record<string, unknown> {
  let current = field;
  let description: string | undefined;

  while (current instanceof z.ZodOptional || current instanceof z.ZodNullable || current instanceof z.ZodDefault) {
    if (current.description) description = current.description;
    current = current._def.innerType;
  }
  description = description ?? field.description;

  const base: Record<string, unknown> = description ? { description } : {};

  if (current instanceof z.ZodString) return { type: "string", ...base };
  if (current instanceof z.ZodNumber) {
    const isInt = current._def.checks.some((c) => c.kind === "int");
    return { type: isInt ? "integer" : "number", ...base };
  }
  if (current instanceof z.ZodBoolean) return { type: "boolean", ...base };
  if (current instanceof z.ZodEnum) {
    return { type: "string", enum: current.options, ...base };
  }
  if (current instanceof z.ZodArray) {
    return { type: "array", items: zodFieldToJsonSchema(current.element), ...base };
  }
  return { ...base };
}

const tools: ToolDef[] = [
  {
    tool: {
      name: "peopleforce_list_employees",
      description:
        "List employees with pagination. Only the `status` filter is applied server-side; filter other attributes client-side or use peopleforce_find_employee_by_email.",
      inputSchema: {
        type: "object",
        properties: {
          page: { type: "integer", description: "Page number (1-based). Default 1." },
          per_page: { type: "integer", description: "Items per page, max 100. Default 50." },
          status: {
            type: "string",
            enum: ["employed", "probation", "dismissed", "not_hired", "pending_hire"],
            description: "Employment status filter (server-side).",
          },
        },
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    schema: z.object({
      ...Page,
      status: z.enum(["employed", "probation", "dismissed", "not_hired", "pending_hire"]).optional(),
    }),
    handler: async (args) => client.list("employees", args as Record<string, string | number>),
  },
  {
    tool: {
      name: "peopleforce_find_employee_by_email",
      description:
        "Find a single employee by work or personal email. Paginates internally until a match is found. Returns the full employee object or null.",
      inputSchema: {
        type: "object",
        properties: {
          email: { type: "string", description: "Work or personal email (case-insensitive)." },
        },
        required: ["email"],
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    schema: z.object({ email: z.string() }),
    handler: async (args) => {
      const target = (args as { email: string }).email.trim().toLowerCase();
      let page = 1;
      while (true) {
        const res = await client.list<Record<string, unknown>>("employees", { page, per_page: 100 });
        const match = res.data.find((e) => {
          const work = String(e.email ?? "").toLowerCase();
          const personal = String(e.personal_email ?? "").toLowerCase();
          return work === target || personal === target;
        });
        if (match) return match;
        const pagination = res.metadata?.pagination;
        if (!pagination || page >= pagination.pages) return null;
        page += 1;
      }
    },
  },
  {
    tool: {
      name: "peopleforce_get_employee",
      description: "Get a single employee by PeopleForce id. Returns full profile including position, department, manager, custom fields.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "integer", description: "Employee id (numeric)." },
        },
        required: ["id"],
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    schema: z.object({ id: z.number().int() }),
    handler: async (args) => client.get(`employees/${(args as { id: number }).id}`),
  },
  {
    tool: {
      name: "peopleforce_list_employee_positions",
      description: "List position history for a specific employee (promotions, role changes, compensation).",
      inputSchema: {
        type: "object",
        properties: {
          employee_id: { type: "integer", description: "Employee id." },
          page: { type: "integer" },
          per_page: { type: "integer" },
        },
        required: ["employee_id"],
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    schema: z.object({ employee_id: z.number().int(), ...Page }),
    handler: async (args) => {
      const { employee_id, ...rest } = args as { employee_id: number; page?: number; per_page?: number };
      return client.list(`employees/${employee_id}/positions`, rest as Record<string, number>);
    },
  },
  {
    tool: {
      name: "peopleforce_list_leave_requests",
      description:
        "List leave/time-off requests. Useful for 'who's on vacation', balance queries, approvals. Supports employee_id and state filters.",
      inputSchema: {
        type: "object",
        properties: {
          page: { type: "integer" },
          per_page: { type: "integer" },
          employee_id: { type: "integer", description: "Filter by employee." },
          state: {
            type: "string",
            enum: ["pending", "approved", "rejected", "cancelled"],
            description: "Filter by approval state.",
          },
          leave_type_id: { type: "integer", description: "Filter by leave type id." },
        },
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    schema: z.object({
      ...Page,
      employee_id: z.number().int().optional(),
      state: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
      leave_type_id: z.number().int().optional(),
    }),
    handler: async (args) => client.list("leave_requests", args as Record<string, string | number>),
  },
  paginated("departments", "List all departments with manager and parent info."),
  paginated("positions", "List all position titles used in the company."),
  paginated("locations", "List office/remote locations."),
  paginated("divisions", "List organizational divisions."),
  paginated("teams", "List teams (cross-functional groupings)."),
  paginated("holidays", "List official company holidays."),
  paginated("job_levels", "List job levels (Junior/Middle/Senior/etc)."),
  paginated("job_profiles", "List job profiles (role descriptions)."),
  paginated("legal_entities", "List legal entities employees are contracted under."),
  paginated("employment_types", "List employment types (Full-time, Part-time, Contractor, etc)."),
  paginated("genders", "List gender reference values used in profiles."),
  paginated("skills", "List skills tracked in the skills matrix."),
  paginated("competencies", "List competencies used in performance reviews."),
  paginated("assets", "List all assets/equipment in the company."),
  paginated("leave_types", "List leave/time-off types (Vacation, Sick, Optional holiday, etc) with units and colors."),
  paginated("tasks", "List tasks assigned across the organization (onboarding, offboarding, HR actions)."),
  paginated("recruitment/vacancies", "List open and closed vacancies in the ATS."),
  paginated("recruitment/candidates", "List candidates in the ATS pipeline."),
  paginated("recruitment/pipelines", "List recruitment pipelines with their stages."),
  paginated("recruitment/sources", "List recruitment sources (where candidates came from)."),
  {
    tool: {
      name: "peopleforce_list_employee_documents",
      description: "List documents attached to a specific employee's profile.",
      inputSchema: {
        type: "object",
        properties: {
          employee_id: { type: "integer", description: "Employee id." },
          page: { type: "integer" },
          per_page: { type: "integer" },
        },
        required: ["employee_id"],
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    schema: z.object({ employee_id: z.number().int(), ...Page }),
    handler: async (args) => {
      const { employee_id, ...rest } = args as { employee_id: number; page?: number; per_page?: number };
      return client.list(`employees/${employee_id}/documents`, rest as Record<string, number>);
    },
  },
  {
    tool: {
      name: "peopleforce_list_employee_assets",
      description: "List assets/equipment assigned to a specific employee.",
      inputSchema: {
        type: "object",
        properties: {
          employee_id: { type: "integer", description: "Employee id." },
          page: { type: "integer" },
          per_page: { type: "integer" },
        },
        required: ["employee_id"],
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    schema: z.object({ employee_id: z.number().int(), ...Page }),
    handler: async (args) => {
      const { employee_id, ...rest } = args as { employee_id: number; page?: number; per_page?: number };
      return client.list(`employees/${employee_id}/assets`, rest as Record<string, number>);
    },
  },
  {
    tool: {
      name: "peopleforce_api_request",
      description:
        "Escape hatch: perform a raw GET against any PeopleForce v3 API path (relative to /api/public/v3). Use when no dedicated tool covers the endpoint. Example path: 'employees/12345' or 'leave_requests?state=approved'.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path relative to /api/public/v3 (no leading slash needed)." },
          query: {
            type: "object",
            description: "Optional query params as key-value pairs. Values will be stringified.",
            additionalProperties: { type: ["string", "number", "boolean"] },
          },
        },
        required: ["path"],
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    schema: z.object({
      path: z.string(),
      query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
    }),
    handler: async (args) => {
      const { path, query } = args as { path: string; query?: Record<string, string | number | boolean> };
      return client.get(path, query ?? {});
    },
  },
];

const server = new Server(
  { name: "peopleforce", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => t.tool),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const def = tools.find((t) => t.tool.name === name);
  if (!def) {
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
    };
  }

  const parsed = def.schema.safeParse(req.params.arguments ?? {});
  if (!parsed.success) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Invalid arguments for ${name}:\n${parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n")}`,
        },
      ],
    };
  }

  try {
    const result = await def.handler(parsed.data);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    if (err instanceof PeopleForceError) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `PeopleForce API error at ${err.path}\nStatus: ${err.status}\n${err.message}\nBody: ${err.body}`,
          },
        ],
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${message}` }],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("peopleforce-mcp running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
