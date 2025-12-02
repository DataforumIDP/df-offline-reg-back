import { Request } from "express";
import { Account } from "./models/accounts";

export interface ExtendedRequest extends Request {
    account?: Account;
}

export type ReqWithBody<T> = ExtendedRequest & Request<{}, {}, T>;
export type ReqWithParams<T> = ExtendedRequest & Request<T>;
export type ReqWithQuery<T> = ExtendedRequest & Request<{}, {}, {}, T>;
