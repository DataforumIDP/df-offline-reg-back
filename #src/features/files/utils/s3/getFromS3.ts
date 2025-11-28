import { GetObjectCommand, GetObjectCommandInput } from "@aws-sdk/client-s3";
import { s3 } from "../../config/s3";

export function getFromS3(params: GetObjectCommandInput) {
    const command = new GetObjectCommand(params);
    return s3.send(command);
}
