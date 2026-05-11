export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type Option<T> =
  | { some: true; value: T }
  | { some: false };

export interface Pagination {
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export enum SortOrder {
  Ascending = "ascending",
  Descending = "descending",
}

export interface SortConfig {
  field: string;
  order: SortOrder;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface Timestamped {
  createdAt: string;
  updatedAt: string;
}

export interface Versioned {
  version: number;
}

export interface Identified {
  id: string;
}

export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

export interface PagedQuery {
  offset: number;
  limit: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface FilterOperator {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
  value: unknown;
}

export interface QueryFilter {
  filters: FilterOperator[];
  conjunction: "and" | "or";
}

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export interface Duration {
  ms: number;
}

export interface RateLimit {
  maxRequests: number;
  windowMs: number;
}

export function ok<T, E = Error>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function err<T, E = Error>(error: E): Result<T, E> {
  return { ok: false, error };
}

export function some<T>(value: T): Option<T> {
  return { some: true, value };
}

export function none<T>(): Option<T> {
  return { some: false };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

export function isSome<T>(option: Option<T>): option is { some: true; value: T } {
  return option.some;
}

export function isNone<T>(option: Option<T>): option is { some: false } {
  return !option.some;
}
