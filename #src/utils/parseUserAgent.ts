/**
 * Лёгкий разбор User-Agent без внешних зависимостей (замена ua-parser-js, лицензия AGPL-3.0).
 * Покрывает только распространённые браузеры/ОС/устройства — используется исключительно
 * для отображения человекочитаемого названия устройства в списке сессий.
 */

export interface ParsedUserAgent {
    browser: string | null;
    os: string | null;
    deviceModel: string | null;
}

const BROWSER_PATTERNS: Array<[RegExp, string]> = [
    [/Edg\/([\d.]+)/, 'Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/YaBrowser\/([\d.]+)/, 'Yandex Browser'],
    [/SamsungBrowser\/([\d.]+)/, 'Samsung Browser'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/CriOS\/([\d.]+)/, 'Chrome'],
    [/FxiOS\/([\d.]+)/, 'Firefox'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Version\/([\d.]+).*Safari/, 'Safari'],
    [/MSIE ([\d.]+)/, 'Internet Explorer'],
    [/Trident\/.*rv:([\d.]+)/, 'Internet Explorer'],
];

const OS_PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
    [/Windows NT ([\d.]+)/, (m) => `Windows ${windowsVersionName(m[1])}`],
    [/Android ([\d.]+)/, (m) => `Android ${m[1]}`],
    [/iPhone OS ([\d_]+)/, (m) => `iOS ${m[1].replace(/_/g, '.')}`],
    [/CPU OS ([\d_]+)/, (m) => `iOS ${m[1].replace(/_/g, '.')}`],
    [/Mac OS X ([\d_]+)/, (m) => `macOS ${m[1].replace(/_/g, '.')}`],
    [/Linux/, () => 'Linux'],
];

function windowsVersionName(ntVersion: string): string {
    const map: Record<string, string> = {
        '10.0': '10/11',
        '6.3': '8.1',
        '6.2': '8',
        '6.1': '7',
    };
    return map[ntVersion] || ntVersion;
}

function parseDeviceModel(userAgent: string): string | null {
    const androidModel = userAgent.match(/Android [\d.]+;\s*([^;)]+)\s*(?:Build|\))/);
    if (androidModel) {
        return androidModel[1].trim();
    }

    if (/iPad/.test(userAgent)) return 'iPad';
    if (/iPhone/.test(userAgent)) return 'iPhone';

    return null;
}

export function parseUserAgent(userAgent: string): ParsedUserAgent {
    let browser: string | null = null;
    for (const [pattern, name] of BROWSER_PATTERNS) {
        if (pattern.test(userAgent)) {
            browser = name;
            break;
        }
    }

    let os: string | null = null;
    for (const [pattern, resolve] of OS_PATTERNS) {
        const match = userAgent.match(pattern);
        if (match) {
            os = resolve(match);
            break;
        }
    }

    return {
        browser,
        os,
        deviceModel: parseDeviceModel(userAgent),
    };
}
