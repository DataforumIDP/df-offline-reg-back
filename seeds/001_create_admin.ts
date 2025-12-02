import { Knex } from "knex";
import { AccountHelper } from "../#src/models/accounts";

export async function seed(knex: Knex): Promise<void> {
    // Проверяем, есть ли уже админ
    const existingAdmin = await knex("accounts")
        .where({ login: "admin@dtf.su" })
        .first();

    if (existingAdmin) {
        console.log("⚠️  Админ уже существует, пропускаем создание");
        return;
    }

    // Создаем первого админа
    const hashedPassword = await AccountHelper.hashPassword("ecdc166ed2f2943d8");

    await knex("accounts").insert({
        login: "admin@dtf.su",
        password: hashedPassword,
        name: "Администратор",
        role: "admin",
        is_delete: false,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
    });

    console.log("✅ Создан админ: login=admin, password=admin123");
}
