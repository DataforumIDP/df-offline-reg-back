export const generateRandomDigits = (length: number): string => {
    let digits = "";
    for (let i = 0; i < length; i++) {
        digits += Math.floor(Math.random() * 10).toString();
    }
    return digits;
};
