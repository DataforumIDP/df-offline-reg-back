import axios from "axios";
// import nodemailer from "nodemailer";
// import { mail } from "../config/mail";
import { wrap } from "./wrap";


export async function sendMail(data: any) {

    // let data = {
    //     from: '"100 Вопросов о будущем России" <info@100questions.ru>',
    // };

    // return await sendMailPromise(mail, data)
    
    const sendData = new FormData();

    sendData.append("email", data.mail);
    sendData.append("subject", data.subject);
    sendData.append("body", data.body);

    return await wrap(
        axios.post(
            `https://online.dataforum.pro/${data.hook}`,
            sendData,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        )
    )
}


    // data.append("body", body);
// async function sendMailPromise (transfer: nodemailer.Transporter, data: any): Promise<[any, null] | [null, any]> {
//     return new Promise(resolve=> {
//         transfer.sendMail(data, (err, info)=>{
//             if (err) console.log(`Ошибка`, err);
            
//             if (err) resolve([null, err])
//                 else resolve([info, null])
//         })
//     }) 
// } 