import { randomBytes } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { EntityType } from "../types/world-model.js";

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHORT_ID_LENGTH = 8;
const NANO_ID_LENGTH = 21;

function randomFromAlphabet(alphabet: string, length: number): string {
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

export function generateId(): string {
  return randomFromAlphabet(ID_ALPHABET, NANO_ID_LENGTH);
}

export function generateUUID(): string {
  return uuidv4();
}

export function generateShortId(): string {
  return randomFromAlphabet(ID_ALPHABET, SHORT_ID_LENGTH);
}

const ENTITY_TYPE_PREFIXES: Record<EntityType, string> = {
  [EntityType.Agent]: "agent",
  [EntityType.Resource]: "resource",
  [EntityType.Location]: "location",
  [EntityType.Event]: "event",
  [EntityType.Concept]: "concept",
  [EntityType.Organization]: "org",
  [EntityType.Artifact]: "artifact",
  [EntityType.Process]: "process",
};

export function generateEntityId(type: EntityType): string {
  const prefix = ENTITY_TYPE_PREFIXES[type];
  const id = generateShortId();
  return `${prefix}_${id}`;
}
