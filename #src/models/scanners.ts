/**
 * Модели для сканеров
 */

// ===== PROJECT AUTH (ключи авторизации проекта) =====

export interface ProjectAuth {
    id: number;
    project_id: number;
    access_key: string;
    secret_key: string;
    created_at: Date;
    updated_at: Date;
}

export class ProjectAuthHelper {
    static toJSON(auth: ProjectAuth) {
        return {
            id: auth.id,
            projectId: auth.project_id,
            accessKey: auth.access_key,
            secretKey: auth.secret_key,
            createdAt: auth.created_at,
            updatedAt: auth.updated_at,
        };
    }

    /**
     * Генерация случайной строки заданной длины
     */
    static generateKey(length: number): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Генерация пары ключей
     */
    static generateKeyPair(): { accessKey: string; secretKey: string } {
        return {
            accessKey: this.generateKey(21),
            secretKey: this.generateKey(23),
        };
    }
}

// ===== SCANNER (сканер) =====

export interface Scanner {
    id: number;
    scanner_id: string; // XXXXXX-timestamp
    project_id: number;
    zone_id: number;
    name: string | null;
    last_seen_at: Date | null;
    is_checked_out: boolean;
    checked_out_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateScannerDTO {
    scannerId: string;
    projectId: number;
    zoneId: number;
    name?: string;
}

export interface UpdateScannerDTO {
    zoneId?: number;
    name?: string;
}

export class ScannerHelper {
    static toJSON(scanner: Scanner) {
        return {
            id: scanner.id,
            scannerId: scanner.scanner_id,
            projectId: scanner.project_id,
            zoneId: scanner.zone_id,
            name: scanner.name,
            lastSeenAt: scanner.last_seen_at,
            isCheckedOut: scanner.is_checked_out,
            checkedOutAt: scanner.checked_out_at,
            createdAt: scanner.created_at,
            updatedAt: scanner.updated_at,
        };
    }
}

// ===== SCANNER LOG (лог сканера) =====

export type ScanDirection = 'in' | 'out' | null;

export interface ScannerLog {
    id: number;
    project_id: number;
    zone_id: number;
    scanner_id: number | null;
    user_code: string;
    timestamp: Date;
    direction: ScanDirection;
    hash: string;
    created_at: Date;
}

export interface CreateScannerLogDTO {
    projectId: number;
    zoneId: number;
    scannerId?: number;
    userCode: string;
    timestamp: Date | string;
    direction: ScanDirection;
    hash: string;
}

export interface ScannerLogUploadItem {
    userCode: string;
    timestamp: string; // ISO time
    zone: number;
    direction: 'in' | 'out' | null;
    hash: string;
}

export class ScannerLogHelper {
    static toJSON(log: ScannerLog) {
        return {
            id: log.id,
            projectId: log.project_id,
            zoneId: log.zone_id,
            scannerId: log.scanner_id,
            userCode: log.user_code,
            timestamp: log.timestamp,
            direction: log.direction,
            hash: log.hash,
            createdAt: log.created_at,
        };
    }
}

// ===== SCANNER CONFIG (конфиг для QR) =====

export interface ScannerConfig {
    server: string;
    project: string; // slug проекта
    zone: number;
    authorize: {
        access: string;
        secret: string;
    };
}
