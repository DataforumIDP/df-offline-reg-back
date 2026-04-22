import { BaseDAL } from "./_baseDAL";
import { CloudFont } from "../models/cloudFonts";

export interface CreateCloudFontData {
    name: string;
    normal_url: string;
    bold_url: string;
    italic_url: string;
    bolditalic_url: string;
}

export class CloudFontsDAL extends BaseDAL {
    constructor() {
        super("cloud_fonts");
    }

    async getAll(): Promise<CloudFont[]> {
        return this.db<CloudFont>(this.tableName)
            .where({ is_delete: false })
            .orderBy("name", "ASC");
    }

    async getById(id: number): Promise<CloudFont | null> {
        const result = await this.db<CloudFont>(this.tableName)
            .where({ id, is_delete: false })
            .first();
        return result || null;
    }

    async create(data: CreateCloudFontData): Promise<CloudFont> {
        const [font] = await this.db<CloudFont>(this.tableName)
            .insert(data)
            .returning("*");
        return font;
    }

    async softDelete(id: number): Promise<void> {
        await this.db<CloudFont>(this.tableName)
            .where({ id })
            .update({ is_delete: true, updated_at: new Date() });
    }
}

export const cloudFontsDAL = new CloudFontsDAL();
