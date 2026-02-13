import bcrypt from "bcrypt";
import { adminRoles, allRoles, operatorRoles } from "../datas/rolesData";

export interface Account {
    id: number;
    login: string;
    name: string;
    password: string;
    role: string;
    projectId: number | null;
    is_delete: boolean;
    created_at: Date;
    updated_at: Date;
    // Дополнительное поле (не хранится в БД)
    printCount?: number;
}

export class AccountHelper {
    static toJSON(account: Account) {
        const json: Record<string, any> = {
            id: account.id,
            name: account.name,
            login: account.login,
            role: account.role,
            projectId: account.projectId,
        };
        // Добавляем printCount если он есть
        if (account.printCount !== undefined) {
            json.printCount = account.printCount;
        }
        return json;
    }

    static isAdmin(account: Account): boolean {
        return adminRoles.includes(account.role);
    }

    static async validPassword(account: Account, password: string): Promise<boolean> {
        return bcrypt.compare(password, account.password);
    }

    static async hashPassword(password: string): Promise<string> {
        const saltRounds = 10;
        const salt = await bcrypt.genSalt(saltRounds);
        return bcrypt.hash(password, salt);
    }

    static normalizeLogin(login: string): string {
        return login.toLowerCase().trim();
    }
}

