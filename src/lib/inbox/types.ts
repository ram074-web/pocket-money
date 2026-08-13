import type { Channel, MessageCategory, MessageSource } from "@prisma/client";

// The one shape every channel adapter must produce. A real Gmail adapter and
// a real WhatsApp Business API adapter both normalize into this — the engine
// below (classify/extract/match/route/permissions) never knows or cares
// which channel or which "source" (demo vs. live) a message came from.
export type IncomingMessage = {
  channel: Channel;
  source: MessageSource;
  fromAddress: string;
  fromName?: string;
  toAddress?: string;
  subject?: string;
  body: string;
  receivedAt: Date;
};

export type ClassificationResult = {
  category: MessageCategory;
  confidence: number;
  reasons: string[];
};

export type PartyMatch = {
  type: "customer" | "vendor" | "none";
  id?: string;
  name?: string;
  matchedOn?: "email" | "domain" | "name" | "none";
};

export type ExtractedFields = Record<string, string | number | null>;
