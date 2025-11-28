
export function filteredObjectByKeys(obj: Record<string, any>, keys: string[]): Record<string, any> {
    const entries = Object.entries(obj);

    const allowed = entries.reduce((accum: [string, any][], [key, value]) => {
        if (keys.includes(key)) accum.push([key, value]);
        return accum;
    }, []);

    return Object.fromEntries(allowed);
}