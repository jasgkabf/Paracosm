export enum WSEventType {
  ChatStream = "chat/stream",
  SimulationProgress = "simulation/progress",
  WorldUpdate = "world/update",
  StrategyEvolved = "strategy/evolved",
  SystemNotification = "system/notification",
  HeartbeatBeat = "heartbeat/beat",
}

export const WSEventNames = Object.values(WSEventType);

export type WSEventName = (typeof WSEventType)[keyof typeof WSEventType];

export interface WSEvent {
  id: string;
  type: WSEventName;
  channel: string;
  payload: unknown;
  timestamp: string;
  senderId: string | null;
  correlationId: string | null;
}

export interface ChatStreamPayload {
  conversationId: string;
  sessionId: string;
  event: string;
  data: unknown;
}

export interface SimulationProgressPayload {
  simulationId: string;
  status: string;
  progress?: number;
  state?: unknown;
  error?: string;
  reason?: string;
}

export interface WorldUpdatePayload {
  type: string;
  query?: string;
  resultCount?: number;
  duration?: number;
  [key: string]: unknown;
}

export interface StrategyEvolvedPayload {
  evolutionId: string;
  status: string;
  generation?: number;
  totalGenerations?: number;
  bestFitness?: number;
  averageFitness?: number;
  diversityIndex?: number;
  config?: Record<string, unknown>;
  strategy?: string;
}

export interface SystemNotificationPayload {
  type: string;
  [key: string]: unknown;
}

export interface HeartbeatBeatPayload {
  phase: string;
  bpm: number;
  rhythm: string;
  beatCount: number;
  uptime: number;
  vitalSigns: unknown;
  systemMetrics: unknown;
}

export function createWSEvent(
  type: WSEventName,
  payload: unknown,
  options: {
    channel?: string;
    senderId?: string | null;
    correlationId?: string | null;
  } = {}
): WSEvent {
  return {
    id: crypto.randomUUID(),
    type,
    channel: options.channel ?? type,
    payload,
    timestamp: new Date().toISOString(),
    senderId: options.senderId ?? null,
    correlationId: options.correlationId ?? null,
  };
}

export function parseWSEvent(data: string): WSEvent | null {
  try {
    const parsed = JSON.parse(data);
    if (!parsed.type || !WSEventNames.includes(parsed.type)) {
      return null;
    }
    return {
      id: parsed.id ?? crypto.randomUUID(),
      type: parsed.type,
      channel: parsed.channel ?? parsed.type,
      payload: parsed.payload ?? null,
      timestamp: parsed.timestamp ?? new Date().toISOString(),
      senderId: parsed.senderId ?? null,
      correlationId: parsed.correlationId ?? null,
    };
  } catch {
    return null;
  }
}

export function validateWSEvent(event: WSEvent): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!event.id || typeof event.id !== "string") {
    errors.push("Event id is required and must be a string");
  }

  if (!event.type || !WSEventNames.includes(event.type)) {
    errors.push(`Invalid event type: ${event.type}. Must be one of: ${WSEventNames.join(", ")}`);
  }

  if (!event.timestamp || typeof event.timestamp !== "string") {
    errors.push("Event timestamp is required and must be a string");
  }

  return { valid: errors.length === 0, errors };
}
