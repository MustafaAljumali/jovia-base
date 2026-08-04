export type Capability =
  | "profile:read"
  | "profile:write"
  | "source:read"
  | "source:enable"
  | "opportunity:read"
  | "proposal:generate"
  | "admin:operate";

export interface Actor {
  id: string;
  capabilities: ReadonlySet<Capability>;
  externalSubjects: readonly { issuer: string; subject: string }[];
}

export interface SessionRecord {
  id: string;
  actorId: string;
  opaqueTokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
}

export interface Authenticator {
  authenticate(opaqueToken: string): Promise<Actor | undefined>;
}

export interface SessionStore {
  save(session: SessionRecord): Promise<void>;
  findByOpaqueTokenHash(hash: string): Promise<SessionRecord | undefined>;
  revoke(sessionId: string, revokedAt: Date): Promise<void>;
}
