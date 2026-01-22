import { Account } from "../../#src/models/accounts";
import { Project } from "../../#src/models/projects";
import { ProjectField } from "../../#src/models/projectFields";
import { Participant } from "../../#src/models/participants";

declare global {
    namespace Express {
        interface Request {
            account?: Account;
            project?: Project;
            projectField?: ProjectField;
            participant?: Participant;
            appValues?: {
                project?: Project;
                [key: string]: any;
            };
        }
    }
}

export {};
