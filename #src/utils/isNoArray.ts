

export function isNotArray<T>(item: T | T[]): item is T {
    return !Array.isArray(item);
}