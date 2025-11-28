export function getDate(ofset: number = 0) {
    const date = new Date();
    date.setDate(date.getDate() + ofset);
    return date
}
