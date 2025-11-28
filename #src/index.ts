import express from "express";
import sequelize from "./config/db";
import cors from "cors";
import { _404Middleware } from "./middlewares/common/404Middleware";
import { filesRouter } from "./features/files";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    cors({
        origin: "*",
        methods: "*",
    })
);

app.use(_404Middleware);

const PORT = process.env.PORT || 3000;

async function postgresTasks() {
    await sequelize.sync({ alter: true })
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

