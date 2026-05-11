import type { Event, CausalLink } from '@paracosm/shared';
import { generateId } from '@paracosm/shared';

export function createEvent(data: {
  name: string;
  description: string;
  timestamp?: Date;
  entities?: string[];
  consequences?: string[];
  probability?: number;
  metadata?: Record<string, unknown>;
  id?: string;
}): Event {
  return {
    id: data.id ?? generateId(),
    name: data.name,
    description: data.description,
    timestamp: data.timestamp ?? new Date(),
    entities: data.entities ?? [],
    consequences: data.consequences ?? [],
    probability: data.probability ?? 1.0,
    metadata: data.metadata ?? {},
  };
}

export function createCausalLink(data: {
  causeEventId: string;
  effectEventId: string;
  strength?: number;
  delay?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  id?: string;
}): CausalLink {
  return {
    id: data.id ?? generateId(),
    causeEventId: data.causeEventId,
    effectEventId: data.effectEventId,
    strength: data.strength ?? 0.8,
    delay: data.delay ?? 0,
    description: data.description ?? '',
    metadata: data.metadata ?? {},
  };
}

export function computeEventProbability(event: Event, causalLinks: CausalLink[], relatedEvents: Map<string, Event>): number {
  let probability = event.probability;
  const incomingLinks = causalLinks.filter((l) => l.effectEventId === event.id);
  if (incomingLinks.length === 0) return probability;
  let combinedStrength = 0;
  for (const link of incomingLinks) {
    const causeEvent = relatedEvents.get(link.causeEventId);
    if (causeEvent) {
      combinedStrength += causeEvent.probability * link.strength;
    }
  }
  probability = probability * (0.5 + 0.5 * Math.min(combinedStrength, 1));
  return Math.min(Math.max(probability, 0), 1);
}

export function validateEvent(event: Partial<Event>): string[] {
  const errors: string[] = [];
  if (!event.name || event.name.trim().length === 0) {
    errors.push('Event name is required');
  }
  if (event.probability !== undefined && (event.probability < 0 || event.probability > 1)) {
    errors.push('Event probability must be between 0 and 1');
  }
  return errors;
}
