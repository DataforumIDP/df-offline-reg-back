// import { UploadedFile } from "express-fileupload";
// import { uploadToS3 } from "./s3";
// import { generateRandomString } from "./generateRandomString";
// import Files from "../models/files";
// import { wrap } from "./wrap";
// import dotenv from "dotenv";

// dotenv.config();

// const { SELECTEL_S3_BUCKET } = process.env;

// export function saveFileAndReturnInfo(owner: number) {
//     // Ваша логика обработки каждого файла
//     return async (file: UploadedFile): Promise<[Files, null] | [null, any]> => {
//         const type = file.name.split(".")[file.name.split(".").length - 1];
//         const genName = generateRandomString(35) + "." + type;

//         const params = {
//             Bucket: SELECTEL_S3_BUCKET!,
//             Key: `/${genName}`,
//             Body: file.data,
//         };

//         const [s3Data, s3Err] = await wrap(uploadToS3(params), true);

//         if (s3Err) return [null, s3Err];

//         return await wrap(
//             Files.create(
//                 { url: genName, filename: file.name, owner },
//                 { returning: true }
//             ),
//             true
//         );
//     };
// }
