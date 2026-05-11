export type Result<T, E = Error> = {
    ok: true;
    value: T;
    err?: never;
} | {
    ok: false;
    value?: never;
    err: E;
};
export declare function ok<T, E = Error>(value: T): Result<T, E>;
export declare function err<T, E = Error>(error: E): Result<T, E>;
export declare function isOk<T, E>(result: Result<T, E>): result is {
    ok: true;
    value: T;
};
export declare function isErr<T, E>(result: Result<T, E>): result is {
    ok: false;
    err: E;
};
export type Option<T> = {
    some: true;
    value: T;
} | {
    some: false;
    value?: never;
};
export declare function some<T>(value: T): Option<T>;
export declare function none<T>(): Option<T>;
export declare function isSome<T>(option: Option<T>): option is {
    some: true;
    value: T;
};
export declare function isNone<T>(option: Option<T>): option is {
    some: false;
};
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
//# sourceMappingURL=common.d.ts.map