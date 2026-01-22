import express from "express";
import { db } from "./config/db";
import cors from "cors";
import { _404Middleware } from "./middlewares/common/404Middleware";
import { accountsRouter } from "./routes/accountsRouter";
import { projectsRouter } from "./routes/projectsRouter";
import { printTemplatesRouter } from "./routes/printTemplatesRouter";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    cors({
        origin: "*",
        methods: "*",
    })
);

app.use("/accounts", accountsRouter);
app.use("/projects", projectsRouter);
app.use("/print-templates", printTemplatesRouter);

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
    return new Promise(resolve=> app.listen(PORT, () => resolve(true)))
}

async function start () {
    await postgresTasks()
    await expressTasks()

    console.log(`Сервер запущен на ${PORT} порту`);
}

start()
