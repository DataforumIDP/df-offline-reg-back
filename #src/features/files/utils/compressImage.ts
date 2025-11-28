import { UploadedFile } from "express-fileupload";
import tinify from "../../../config/tinyPng";

export async function compressImage(file: UploadedFile): Promise<Buffer> {
    const imageTypes = ["jpg", "jpeg", "png"];
    const fileType = file.name.split(".").pop()?.toLowerCase();

    if (imageTypes.includes(fileType!)) {
        return (await tinify
            .fromBuffer(file.data)
            .convert({ type: "image/jpg" })
            .transform({background:"#ffffff"})
            .toBuffer()) as Buffer;
    }
    return file.data;
}
