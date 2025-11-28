


export async function awaiting (sec: number) {
    return new Promise (resolve=> {
        setTimeout(() => {
            resolve(true)
        }, sec);
    })
}