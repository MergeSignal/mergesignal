import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { sendProblem } from "../problem.js";

// GitHub login: 1-39 chars, alphanumeric + hyphens, no leading/trailing hyphen
const githubLoginRegex =
  /^[a-zA-Z0-9][a-zA-Z0-9-]{0,37}[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;

const UpsertUserSchema = z.object({
  githubId: z.number().int().positive(),
  githubLogin: z
    .string()
    .min(1)
    .max(39)
    .regex(githubLoginRegex, "Invalid GitHub login format"),
  name: z.string().max(255).nullable().optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
});

export async function internalUsersRoutes(app: FastifyInstance) {
  // Not registered under /v1 and not in OpenAPI spec — internal service use only
  app.post("/internal/users/upsert", async (req, reply) => {
    const parsed = UpsertUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendProblem(reply, req, {
        status: 400,
        title: "Bad Request",
        detail: parsed.error.issues
          .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
          .join("; "),
      });
    }

    const { githubId, githubLogin, name, avatarUrl, email } = parsed.data;

    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO users (github_id, github_login, name, avatar_url, email, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (github_id) DO UPDATE SET
         github_login = EXCLUDED.github_login,
         name         = EXCLUDED.name,
         avatar_url   = EXCLUDED.avatar_url,
         email        = EXCLUDED.email,
         updated_at   = NOW()
       RETURNING id`,
      [githubId, githubLogin, name ?? null, avatarUrl ?? null, email ?? null],
    );

    return reply.code(200).send({ id: rows[0]!.id });
  });
}
