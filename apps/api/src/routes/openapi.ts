import type { FastifyInstance } from "fastify";

export async function openApiRoutes(app: FastifyInstance) {
  app.get("/openapi.json", async (_req, reply) => {
    return reply
      .header("content-type", "application/json; charset=utf-8")
      .send(getOpenApiSpec());
  });

  app.get("/docs", async (_req, reply) => {
    return reply
      .header("content-type", "text/html; charset=utf-8")
      .send(renderDocsHtml());
  });
}

function getOpenApiSpec() {
  // Minimal, stable OpenAPI surface to start with.
  // As the API evolves, expand schemas and examples.
  return {
    openapi: "3.0.3",
    info: {
      title: "MergeSignal API",
      version: "v1",
      description:
        "Dependency risk intelligence API for scans, org views, policies, alerts, benchmarking, and simulations.\n\n" +
        "**Important**: Responses are **informational** and may be incomplete; validate material decisions. " +
        "Customer Content handling and commitments: [Privacy Policy](https://github.com/MergeSignal/mergesignal/blob/main/PRIVACY.md). " +
        "Terms: [Terms of Service](https://github.com/MergeSignal/mergesignal/blob/main/TERMS.md), " +
        "[API Terms](https://github.com/MergeSignal/mergesignal/blob/main/API-TERMS.md).",
      contact: {
        name: "MergeSignal Support",
        url: "https://github.com/MergeSignal/mergesignal",
        email: "legal@mergesignal.com",
      },
      license: {
        name: "Apache 2.0",
        url: "https://github.com/MergeSignal/mergesignal/blob/main/LICENSE",
      },
      termsOfService:
        "https://github.com/MergeSignal/mergesignal/blob/main/API-TERMS.md",
    },
    servers: [{ url: "https://mergesignal-api.fly.dev" }],
    tags: [
      { name: "scans" },
      { name: "simulate" },
      { name: "org" },
      { name: "alerts" },
      { name: "policies" },
      { name: "benchmark" },
      { name: "github" },
      { name: "dataset" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
      schemas: {
        Problem: {
          type: "object",
          properties: {
            type: { type: "string", example: "about:blank" },
            title: { type: "string" },
            status: { type: "integer" },
            detail: { type: "string" },
            instance: { type: "string" },
            requestId: { type: "string" },
          },
          required: ["type", "title", "status"],
        },
        ScanRequest: {
          type: "object",
          properties: {
            repoId: { type: "string", example: "acme/repo-a" },
            dependencyGraph: { type: "object", additionalProperties: true },
            lockfile: {
              type: "object",
              properties: {
                manager: { type: "string", enum: ["pnpm", "npm"] },
                path: { type: "string" },
                content: { type: "string" },
              },
              required: ["manager", "content"],
            },
          },
          required: ["repoId", "dependencyGraph"],
        },
        ScanAccepted: {
          type: "object",
          properties: {
            scanId: { type: "string" },
            status: { type: "string", enum: ["queued"] },
          },
          required: ["scanId", "status"],
        },
        PackageHealth: {
          type: "object",
          properties: {
            name: { type: "string", example: "react" },
            registry: { type: "string", example: "npm" },
            deprecated: { type: "boolean" },
            maintainers_count: { type: "integer", nullable: true },
            latest_version: { type: "string", nullable: true },
            latest_published_at: { type: "string", nullable: true },
            modified_at: { type: "string", nullable: true },
            repository_url: { type: "string", nullable: true },
            last_fetched_at: { type: "string" },
          },
          required: ["name", "registry", "deprecated", "last_fetched_at"],
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/health": {
        get: {
          tags: ["scans"],
          summary: "Health check",
          security: [],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { ok: { type: "boolean" } },
                  },
                },
              },
            },
          },
        },
      },
      "/scan": {
        post: {
          tags: ["scans"],
          summary: "Create a scan (async)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ScanRequest" },
              },
            },
          },
          responses: {
            "202": {
              description: "Accepted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ScanAccepted" },
                },
              },
            },
            "413": { description: "Lockfile too large" },
            "429": { description: "Quota exceeded" },
          },
        },
      },
      "/scan/{id}": {
        get: {
          tags: ["scans"],
          summary: "Get scan by id",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Scan row (includes result when done)" },
            "404": {
              description: "Not found",
              content: {
                "application/problem+json": {
                  schema: { $ref: "#/components/schemas/Problem" },
                },
              },
            },
          },
        },
      },
      "/scan/{id}/events": {
        get: {
          tags: ["scans"],
          summary: "Scan status stream (SSE)",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "text/event-stream",
              content: { "text/event-stream": { schema: { type: "string" } } },
            },
          },
        },
      },
      "/simulate/upgrade": {
        post: {
          tags: ["simulate"],
          summary: "Simulate upgrade impact between two lockfiles",
          responses: { "200": { description: "Upgrade simulation result" } },
        },
      },
      "/dataset/packages": {
        get: {
          tags: ["dataset"],
          summary: "List known packages in the ecosystem dataset",
          parameters: [
            {
              name: "q",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 200 },
            },
          ],
          responses: {
            "200": {
              description: "Package list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      packages: {
                        type: "array",
                        items: { $ref: "#/components/schemas/PackageHealth" },
                      },
                    },
                    required: ["packages"],
                  },
                },
              },
            },
          },
        },
      },
      "/dataset/package/{name}": {
        get: {
          tags: ["dataset"],
          summary: "Get current + recent history for a package",
          parameters: [
            {
              name: "name",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "days",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 365 },
            },
          ],
          responses: {
            "200": { description: "Package detail (current + history)" },
            "404": {
              description: "Not found",
              content: {
                "application/problem+json": {
                  schema: { $ref: "#/components/schemas/Problem" },
                },
              },
            },
          },
        },
      },
      "/org/{owner}/dashboard": {
        get: {
          tags: ["org"],
          summary: "Organization dashboard (latest scans)",
          parameters: [
            {
              name: "owner",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { "200": { description: "Dashboard data" } },
        },
      },
      "/org/{owner}/alerts": {
        get: {
          tags: ["alerts"],
          summary: "Organization alerts",
          parameters: [
            {
              name: "owner",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { "200": { description: "Alerts list" } },
        },
      },
      "/org/{owner}/policies": {
        get: {
          tags: ["policies"],
          summary: "List policies for an owner",
          parameters: [
            {
              name: "owner",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { "200": { description: "Policies" } },
        },
        post: {
          tags: ["policies"],
          summary: "Create a policy for an owner",
          parameters: [
            {
              name: "owner",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { "201": { description: "Created" } },
        },
      },
      "/benchmark/global": {
        get: {
          tags: ["benchmark"],
          summary: "Global risk score distribution",
          responses: { "200": { description: "OK" } },
        },
      },
      "/benchmark/org/{owner}": {
        get: {
          tags: ["benchmark"],
          summary: "Org risk score distribution",
          parameters: [
            {
              name: "owner",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/github/webhook": {
        post: {
          tags: ["github"],
          summary: "GitHub App webhook endpoint",
          security: [],
          responses: {
            "202": { description: "Accepted" },
            "401": { description: "Invalid signature" },
          },
        },
      },
    },
  };
}

function renderDocsHtml() {
  const specUrl = "/openapi.json";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>MergeSignal API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #0b1020; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: ${JSON.stringify(specUrl)},
        dom_id: "#swagger-ui",
        deepLinking: true,
        displayRequestDuration: true
      });
    </script>
  </body>
</html>`;
}
