export async function wrap<T>(promise: Promise<T>, log?: boolean): Promise<[null, any] | [T , null]> {
    try {
        const result = await promise;
        return [result, null];
    } catch (error) {
        if (log) console.log(error);
        return [null, error];
    }
}

