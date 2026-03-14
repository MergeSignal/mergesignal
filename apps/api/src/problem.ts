import type { FastifyReply, FastifyRequest } from "fastify";

export type ProblemDetails = {
  status: number;
  title: string;
  detail?: string;
  type?: string;
  extra?: Record<string, unknown>;
};

export function buildProblem(req: FastifyRequest, opts: ProblemDetails) {
  const type = opts.type ?? "about:blank";
  const problem: Record<string, unknown> = {
    type,
    title: opts.title,
    status: opts.status,
    detail: opts.detail,
    instance: String(req?.url ?? ""),
    requestId: String((req as any)?.id ?? ""),
    ...((opts.extra ?? {}) as any),
  };

  return problem;
}

export function sendProblem(reply: FastifyReply, req: FastifyRequest, opts: ProblemDetails) {
  const problem = buildProblem(req, opts);
  return reply
    .code(opts.status)
    .header("content-type", "application/problem+json; charset=utf-8")
    .header("x-request-id", String((req as any)?.id ?? ""))
    .send(problem);
}

export function problemJsonString(req: FastifyRequest, opts: ProblemDetails) {
  return JSON.stringify(buildProblem(req, opts));
}

