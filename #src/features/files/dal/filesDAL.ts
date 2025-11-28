import { Op } from "sequelize";
import Files from "../models/files";
import { BaseDAL } from "../../../dal/_baseDAL";

export class FilesDAL extends BaseDAL<Files> {
    constructor() {
        super(Files);
    }

}
