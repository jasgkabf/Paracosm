import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { EventSeverity } from "@paracosm/shared";
import { generateId } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import type { EventRecord, CausalChain } from "./types.js";

interface EventCreateParams {
  name: string;
  description?: string;
  timestamp?: string;
  severity?: EventSeverity;
  entityId: string;
  payload?: Record<string, unknown>;
  duration?: number | null;
}

const VALID_SEVERITIES = new Set<string>(Object.values(EventSeverity));

export class Event {
  static create(params: EventCreateParams): Result<EventRecord, ValidationError> {
    const validation = Event.validateParams(params);
    if (!validation.ok) {
      return validation;
    }

    const now = new Date().toISOString();
    const id = `evt_${generateId()}`;

    const record: EventRecord = {
      id,
      name: params.name,
      description: params.description ?? "",
      timestamp: params.timestamp ?? now,
      severity: params.severity ?? EventSeverity.Info,
      entityId: params.entityId,
      payload: params.payload ?? {},
      duration: params.duration ?? null,
      causeIds: new Set(),
      effectIds: new Set(),
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    return ok(record);
  }

  static validateParams(params: Partial<EventCreateParams>): Result<true, ValidationError> {
    if (!params.name || typeof params.name !== "string" || params.name.trim().length === 0) {
      return err(new ValidationError("Event name is required and must be a non-empty string", {
        field: "name",
      }));
    }

    if (params.name.length > 512) {
      return err(new ValidationError("Event name must not exceed 512 characters", {
        field: "name",
        maxLength: 512,
        actualLength: params.name.length,
      }));
    }

    if (!params.entityId || typeof params.entityId !== "string" || params.entityId.trim().length === 0) {
      return err(new ValidationError("Event entityId is required and must be a non-empty string", {
        field: "entityId",
      }));
    }

    if (params.severity !== undefined && !VALID_SEVERITIES.has(params.severity)) {
      return err(new ValidationError("Event severity must be a valid EventSeverity", {
        field: "severity",
        validValues: Object.values(EventSeverity),
      }));
    }

    if (params.timestamp !== undefined) {
      const parsed = Date.parse(params.timestamp);
      if (isNaN(parsed)) {
        return err(new ValidationError("Event timestamp must be a valid ISO 8601 string", {
          field: "timestamp",
          value: params.timestamp,
        }));
      }
    }

    if (params.duration !== undefined && params.duration !== null) {
      if (typeof params.duration !== "number" || !Number.isFinite(params.duration) || params.duration < 0) {
        return err(new ValidationError("Event duration must be a non-negative number or null", {
          field: "duration",
          value: params.duration,
        }));
      }
    }

    if (params.payload !== undefined) {
      if (typeof params.payload !== "object" || params.payload === null || Array.isArray(params.payload)) {
        return err(new ValidationError("Event payload must be a plain object", {
          field: "payload",
        }));
      }
    }

    return ok(true);
  }

  static validate(record: EventRecord): Result<true, ValidationError> {
    if (!record.id || typeof record.id !== "string") {
      return err(new ValidationError("Event id is required and must be a string", {
        field: "id",
      }));
    }

    if (!record.name || typeof record.name !== "string") {
      return err(new ValidationError("Event name is required and must be a string", {
        field: "name",
        eventId: record.id,
      }));
    }

    if (!VALID_SEVERITIES.has(record.severity)) {
      return err(new ValidationError("Event severity must be a valid EventSeverity", {
        field: "severity",
        eventId: record.id,
      }));
    }

    if (!record.entityId || typeof record.entityId !== "string") {
      return err(new ValidationError("Event entityId is required and must be a string", {
        field: "entityId",
        eventId: record.id,
      }));
    }

    if (!(record.causeIds instanceof Set)) {
      return err(new ValidationError("Event causeIds must be a Set", {
        field: "causeIds",
        eventId: record.id,
      }));
    }

    if (!(record.effectIds instanceof Set)) {
      return err(new ValidationError("Event effectIds must be a Set", {
        field: "effectIds",
        eventId: record.id,
      }));
    }

    return ok(true);
  }

  static linkCause(event: EventRecord, causeId: string): Result<EventRecord, ValidationError> {
    if (!causeId || typeof causeId !== "string") {
      return err(new ValidationError("Cause event id must be a non-empty string", {
        field: "causeId",
      }));
    }

    if (causeId === event.id) {
      return err(new ValidationError("An event cannot be its own cause", {
        field: "causeId",
        eventId: event.id,
      }));
    }

    if (event.causeIds.has(causeId)) {
      return ok(event);
    }

    const updated = Event.clone(event);
    updated.causeIds.add(causeId);
    updated.updatedAt = new Date().toISOString();
    updated.version += 1;

    return ok(updated);
  }

  static linkEffect(event: EventRecord, effectId: string): Result<EventRecord, ValidationError> {
    if (!effectId || typeof effectId !== "string") {
      return err(new ValidationError("Effect event id must be a non-empty string", {
        field: "effectId",
      }));
    }

    if (effectId === event.id) {
      return err(new ValidationError("An event cannot be its own effect", {
        field: "effectId",
        eventId: event.id,
      }));
    }

    if (event.effectIds.has(effectId)) {
      return ok(event);
    }

    const updated = Event.clone(event);
    updated.effectIds.add(effectId);
    updated.updatedAt = new Date().toISOString();
    updated.version += 1;

    return ok(updated);
  }

  static buildCausalChain(
    events: Map<string, EventRecord>,
    startEventId: string,
    maxDepth: number = 50
  ): Result<CausalChain, ValidationError> {
    if (!events.has(startEventId)) {
      return err(new ValidationError("Start event not found", {
        startEventId,
      }));
    }

    const chainEvents: EventRecord[] = [];
    const links: CausalChain["links"] = [];
    const visited = new Set<string>();

    function traverseForward(eventId: string, depth: number): void {
      if (depth > maxDepth || visited.has(eventId)) {
        return;
      }

      visited.add(eventId);
      const event = events.get(eventId);
      if (!event) return;

      chainEvents.push(event);

      for (const effectId of event.effectIds) {
        const effectEvent = events.get(effectId);
        if (effectEvent) {
          const causeTime = new Date(event.timestamp).getTime();
          const effectTime = new Date(effectEvent.timestamp).getTime();
          const delay = Math.max(0, effectTime - causeTime);

          links.push({
            causeId: eventId,
            effectId,
            strength: 1.0 / (depth + 1),
            delay,
          });

          traverseForward(effectId, depth + 1);
        }
      }
    }

    function traverseBackward(eventId: string, depth: number): void {
      if (depth > maxDepth || visited.has(eventId)) {
        return;
      }

      visited.add(eventId);
      const event = events.get(eventId);
      if (!event) return;

      if (depth > 0) {
        chainEvents.unshift(event);
      }

      for (const causeId of event.causeIds) {
        const causeEvent = events.get(causeId);
        if (causeEvent) {
          const causeTime = new Date(causeEvent.timestamp).getTime();
          const effectTime = new Date(event.timestamp).getTime();
          const delay = Math.max(0, effectTime - causeTime);

          links.unshift({
            causeId,
            effectId: eventId,
            strength: 1.0 / (depth + 1),
            delay,
          });

          traverseBackward(causeId, depth + 1);
        }
      }
    }

    traverseBackward(startEventId, 0);
    traverseForward(startEventId, 0);

    const uniqueEvents = new Map<string, EventRecord>();
    for (const evt of chainEvents) {
      uniqueEvents.set(evt.id, evt);
    }

    const sortedEvents = Array.from(uniqueEvents.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return ok({
      events: sortedEvents,
      links,
    });
  }

  static serialize(record: EventRecord): Record<string, unknown> {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      timestamp: record.timestamp,
      severity: record.severity,
      entityId: record.entityId,
      payload: record.payload,
      duration: record.duration,
      causeIds: Array.from(record.causeIds),
      effectIds: Array.from(record.effectIds),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    };
  }

  static deserialize(data: Record<string, unknown>): Result<EventRecord, ValidationError> {
    if (!data || typeof data !== "object") {
      return err(new ValidationError("Event data must be a non-null object"));
    }

    if (!data.id || typeof data.id !== "string") {
      return err(new ValidationError("Event data must contain a string 'id' field"));
    }

    const causeIds = new Set<string>();
    if (Array.isArray(data.causeIds)) {
      for (const id of data.causeIds) {
        if (typeof id === "string") {
          causeIds.add(id);
        }
      }
    }

    const effectIds = new Set<string>();
    if (Array.isArray(data.effectIds)) {
      for (const id of data.effectIds) {
        if (typeof id === "string") {
          effectIds.add(id);
        }
      }
    }

    const record: EventRecord = {
      id: data.id as string,
      name: (data.name as string) ?? "",
      description: (data.description as string) ?? "",
      timestamp: (data.timestamp as string) ?? new Date().toISOString(),
      severity: (data.severity as EventSeverity) ?? EventSeverity.Info,
      entityId: (data.entityId as string) ?? "",
      payload: (data.payload as Record<string, unknown>) ?? {},
      duration: (data.duration as number | null) ?? null,
      causeIds,
      effectIds,
      createdAt: (data.createdAt as string) ?? new Date().toISOString(),
      updatedAt: (data.updatedAt as string) ?? new Date().toISOString(),
      version: (data.version as number) ?? 1,
    };

    const validation = Event.validate(record);
    if (!validation.ok) {
      return validation;
    }

    return ok(record);
  }

  static clone(record: EventRecord): EventRecord {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      timestamp: record.timestamp,
      severity: record.severity,
      entityId: record.entityId,
      payload: JSON.parse(JSON.stringify(record.payload)),
      duration: record.duration,
      causeIds: new Set(record.causeIds),
      effectIds: new Set(record.effectIds),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    };
  }
}
