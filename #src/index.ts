import express from "express";
import { createServer } from "http";
import fileUpload from "express-fileupload";
import { db } from "./config/db";
import cors from "cors";
import { _404Middleware } from "./middlewares/common/404Middleware";
import { accountsRouter } from "./routes/accountsRouter";
import { projectsRouter } from "./routes/projectsRouter";
import { printTemplatesRouter } from "./routes/printTemplatesRouter";
import webhooksRouter from "./routes/webhooksRouter";
import { zonesRouter } from "./routes/zonesRouter";
import { scannerRouter } from "./routes/scannerRouter";
import { sessionsRouter } from "./routes/sessionsRouter";
import { qrAuthRouter } from "./routes/qrAuthRouter";
import { initQrAuthSocket } from "./services/qrAuthService";

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    abortOnLimit: true,
}) as any);
app.use(
    cors({
        origin: "*",
        methods: "*",
    })
);

app.use("/accounts", accountsRouter);
app.use("/projects", projectsRouter);
app.use("/print-templates", printTemplatesRouter);
app.use("/webhooks", webhooksRouter);
app.use("/zones", zonesRouter);
app.use("/scanner", scannerRouter);
app.use("/sessions", sessionsRouter);
app.use("/qr-auth", qrAuthRouter);

app.use(_404Middleware);

const PORT = process.env.PORT || 3000;

async function postgresTasks() {
    try {
        // Проверяем подключение к базе данных
        await db.raw('SELECT 1');
        
        // Применяем миграции
        await db.migrate.latest();
        
        // Применяем seeds (только в development)
        if (process.env.NODE_ENV !== 'production') {
            await db.seed.run();
        }

        console.log('✅ PostgreSQL подключен успешно');
    } catch (error) {
        console.error('❌ Ошибка подключения к PostgreSQL:', error);
        process.exit(1);
    }
}

async function expressTasks() {
    const server = createServer(app);
    
    // Инициализация Socket.IO для QR авторизации
    initQrAuthSocket(server);
    
    return new Promise(resolve => server.listen(PORT, () => resolve(true)));
}

async function start () {
    await postgresTasks()
    await expressTasks()

    console.log(`Сервер запущен на ${PORT} порту`);
}

start()
