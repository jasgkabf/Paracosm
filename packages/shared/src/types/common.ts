export type Result<T, E = Error> =
  | { ok: true; value: T; err?: never }
  | { ok: false; value?: never; err: E };

export function ok<T, E = Error>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function err<T, E = Error>(error: E): Result<T, E> {
  return { ok: false, err: error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok === true;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; err: E } {
  return result.ok === false;
}

export type Option<T> =
  | { some: true; value: T }
  | { some: false; value?: never };

export function some<T>(value: T): Option<T> {
  return { some: true, value };
}

export function none<T>(): Option<T> {
  return { some: false };
}

export function isSome<T>(option: Option<T>): option is { some: true; value: T } {
  return option.some === true;
}

export function isNone<T>(option: Option<T>): option is { some: false } {
  return option.some === false;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export type SortOrder = 'asc' | 'desc';

export interface DateRange {
  start: Date;
  end: Date;
}
