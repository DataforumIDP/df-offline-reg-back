import { Account } from "../../#src/models/accounts";

declare global {
    namespace Express {
        interface Request {
            account?: Account;
        }
    }
}

export {};
