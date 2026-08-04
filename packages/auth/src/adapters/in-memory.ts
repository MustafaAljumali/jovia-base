import { createHash } from "node:crypto";

import type { Actor, Authenticator, SessionRecord, SessionStore } from "../contracts.js";

function tokenHash(opaqueToken: string) {
  return createHash("sha256").update(opaqueToken, "utf8").digest("hex");
}

export class InMemoryAuthAdapter implements Authenticator, SessionStore {
  private readonly actors = new Map<string, Actor>();
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(
    actors: readonly Actor[] = [],
    private readonly clock: { now(): Date } = { now: () => new Date() },
  ) {
    for (const actor of actors) this.actors.set(actor.id, actor);
  }

  async createSession(options: {
    id: string;
    actorId: string;
    opaqueToken: string;
    expiresAt: Date;
  }): Promise<void> {
    if (!this.actors.has(options.actorId)) throw new Error("actor is not registered");
    await this.save({
      id: options.id,
      actorId: options.actorId,
      opaqueTokenHash: tokenHash(options.opaqueToken),
      expiresAt: options.expiresAt,
    });
  }

  async authenticate(opaqueToken: string): Promise<Actor | undefined> {
    const session = await this.findByOpaqueTokenHash(tokenHash(opaqueToken));
    if (!session || session.revokedAt || session.expiresAt <= this.clock.now()) return undefined;
    return this.actors.get(session.actorId);
  }

  async save(session: SessionRecord): Promise<void> {
    this.sessions.set(session.id, structuredClone(session));
  }

  async findByOpaqueTokenHash(hash: string): Promise<SessionRecord | undefined> {
    const session = [...this.sessions.values()].find(
      ({ opaqueTokenHash }) => opaqueTokenHash === hash,
    );
    return session ? structuredClone(session) : undefined;
  }

  async revoke(sessionId: string, revokedAt: Date): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.set(sessionId, { ...session, revokedAt });
  }

  sessionSnapshot(sessionId: string) {
    const session = this.sessions.get(sessionId);
    return session ? structuredClone(session) : undefined;
  }
}
