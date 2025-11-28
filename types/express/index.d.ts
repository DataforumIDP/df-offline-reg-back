import * as express from "express";
import Accounts from "../../#src/models/accounts";
import Events from "../../#src/models/events";
import Schemas from "../../#src/models/Schemas";

declare global {
    namespace Express {
        interface Request {
            account?: Accounts;
            file?: any
        }
    }
}
