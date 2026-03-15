import type { FastifyInstance } from "fastify";
import { indexRoutes } from "./index.js";
import { healthRoutes } from "./health.js";
import { metricsRoutes } from "./metrics.js";
import { scanRoutes } from "./scan.js";
import { scanEventsRoutes } from "./scanEvents.js";
import { simulateUpgradeRoutes } from "./simulateUpgrade.js";
import { githubWebhookRoutes } from "./githubWebhook.js";
import { orgDashboardRoutes } from "./orgDashboard.js";
import { alertsRoutes } from "./alerts.js";
import { policiesRoutes } from "./policies.js";
import { benchmarkRoutes } from "./benchmark.js";
import { openApiRoutes } from "./openapi.js";
import { datasetRoutes } from "./dataset.js";

export async function registerRoutes(app: FastifyInstance) {
  // Unversioned routes (backwards-compatible)
  app.register(indexRoutes);
  app.register(healthRoutes);
  app.register(metricsRoutes);
  app.register(openApiRoutes);
  app.register(scanRoutes);
  app.register(scanEventsRoutes);
  app.register(simulateUpgradeRoutes);
  app.register(githubWebhookRoutes);
  app.register(orgDashboardRoutes);
  app.register(alertsRoutes);
  app.register(policiesRoutes);
  app.register(benchmarkRoutes);
  app.register(datasetRoutes);

  // Versioned API base
  await app.register(
    async (v1) => {
      v1.register(indexRoutes);
      v1.register(healthRoutes);
      v1.register(metricsRoutes);
      v1.register(openApiRoutes);
      v1.register(scanRoutes);
      v1.register(scanEventsRoutes);
      v1.register(simulateUpgradeRoutes);
      v1.register(githubWebhookRoutes);
      v1.register(orgDashboardRoutes);
      v1.register(alertsRoutes);
      v1.register(policiesRoutes);
      v1.register(benchmarkRoutes);
      v1.register(datasetRoutes);
    },
    { prefix: "/v1" },
  );
}

