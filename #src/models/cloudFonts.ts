export interface CloudFont {
    id: number;
    name: string;
    normal_url: string;
    bold_url: string;
    italic_url: string;
    bolditalic_url: string;
    is_delete: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface CloudFontJSON {
    id: number;
    name: string;
    variants: {
        normal: string;
        bold: string;
        italic: string;
        bolditalic: string;
    };
    createdAt: string;
    updatedAt: string;
}

export class CloudFontHelper {
    static toJSON(font: CloudFont): CloudFontJSON {
        return {
            id: font.id,
            name: font.name,
            variants: {
                normal: font.normal_url,
                bold: font.bold_url,
                italic: font.italic_url,
                bolditalic: font.bolditalic_url,
            },
            createdAt: font.created_at.toISOString(),
            updatedAt: font.updated_at.toISOString(),
        };
    }
}
