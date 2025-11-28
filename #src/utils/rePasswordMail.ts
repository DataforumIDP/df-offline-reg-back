



export function rePasswordMail (token: string) {
    return `Здравствуйте, для восстановления пароля перейдите по  <a href="https://rusind.wpdataforum/newpass/${token}">ссылке</a>`
}