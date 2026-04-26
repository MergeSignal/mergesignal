import type { FastifyError, FastifyInstance } from "fastify";
import { captureApiException } from "../sentry.js";
import { sendProblem } from "../problem.js";

export function registerErrorHandling(app: FastifyInstance) {
  app.setNotFoundHandler(async (req, reply) => {
    return sendProblem(reply, req, {
      status: 404,
      title: "Not Found",
      detail: `Route ${req.method} ${req.url} not found`,
    });
  });

  app.setErrorHandler(async (err: FastifyError, req, reply) => {
    const status = Number(err.statusCode ?? 500);
    const title =
      status === 400
        ? "Bad Request"
        : status === 401
          ? "Unauthorized"
          : status === 403
            ? "Forbidden"
            : status === 404
              ? "Not Found"
              : status === 413
                ? "Payload Too Large"
                : status === 429
                  ? "Too Many Requests"
                  : status >= 500
                    ? "Internal Server Error"
                    : "Error";

    const detail =
      status >= 500 ? "Unexpected error" : String(err.message ?? "Error");
    const validation = err.validation;

    if (status >= 500) {
      captureApiException(err);
    }

    return sendProblem(reply, req, {
      status,
      title,
      detail,
      extra: validation ? { validation } : undefined,
    });
  });
}
