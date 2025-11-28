import { PutObjectCommand, PutObjectCommandInput } from "@aws-sdk/client-s3";
import { s3 } from "../../config/s3";

export function uploadToS3(params: PutObjectCommandInput) {
    const command = new PutObjectCommand(params);
    return s3.send(command);
}
