import { generateRandomDigits } from "./generateRandomDigits";

export function getLoginFromMail(mail: string) {
    return mail.split('@').at(0)! + generateRandomDigits(10)
}