import { generateRandomDigits } from "./generateRandomDigits";

export function getLoginFromMail(mail: string) {
    return mail.split('@')[0]! + generateRandomDigits(10)
}