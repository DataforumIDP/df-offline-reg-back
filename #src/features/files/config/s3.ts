import { S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import dotenv from "dotenv";
import https from "https";

dotenv.config();

const { SELECTEL_S3_ACCESS, SELECTEL_S3_SECRET, SELECTEL_S3_HOST } = process.env;

// Создаем агент с увеличенным лимитом сокетов
const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 200, // Увеличиваем с 50 до 200 или другого подходящего значения
    maxFreeSockets: 50,
    timeout: 30000
});

const AWS_config = {
    endpoint: SELECTEL_S3_HOST,
    region: 'ru-1',
    credentials: {
        accessKeyId: SELECTEL_S3_ACCESS!,
        secretAccessKey: SELECTEL_S3_SECRET!
    },
    maxAttempts: 3, // Добавляем повторные попытки
    requestHandler: new NodeHttpHandler({
        httpAgent: httpsAgent,
        httpsAgent: httpsAgent,
        socketTimeout: 30000, // Таймаут сокета в миллисекундах
        connectionTimeout: 10000, // Таймаут подключения
        socketAcquisitionWarningTimeout: 10000 // Увеличиваем время ожидания для предупреждения
    })
};

export const s3 = new S3Client(AWS_config);