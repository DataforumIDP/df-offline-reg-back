import { Request } from "express";

export type ReqWithBody<T> = Request<{}, {}, T>;
export type ReqWithParams<T> = Request<T>;
export type ReqWithQuery<T> = Request<{}, {}, {}, T>;
