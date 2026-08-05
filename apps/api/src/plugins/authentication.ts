import { AppError } from "@jovia/contracts";
import type { Actor, Authenticator } from "@jovia/auth";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    actor: Actor | null;
  }
}

function bearerToken(header: string | undefined): string {
  const match = /^Bearer ([^\s]+)$/u.exec(header ?? "");
  if (!match?.[1]) {
    throw new AppError({
      code: "authentication_required",
      status: 401,
      title: "Bearer authentication is required",
    });
  }
  return match[1];
}

export function registerAuthentication(app: FastifyInstance, authenticator: Authenticator): void {
  app.decorateRequest("actor", null);
  app.addHook("preHandler", async (request) => {
    if (request.routeOptions.url === "/v1/health") return;
    const actor = await authenticator.authenticate(bearerToken(request.headers.authorization));
    if (!actor) {
      throw new AppError({
        code: "authentication_required",
        status: 401,
        title: "Bearer authentication is invalid or expired",
      });
    }
    request.actor = actor;
  });
}
