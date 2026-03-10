import { Knex } from "knex";
import { AccountHelper } from "../#src/models/accounts";

export async function seed(knex: Knex): Promise<void> {
    const adminLogin = process.env.FIRST_ADMIN_LOGIN || "admin@dtf.su";
    const adminPassword = process.env.FIRST_ADMIN_PASSWORD || "ecdc166ed2f2943d8";
    const adminName = process.env.FIRST_ADMIN_NAME || "Администратор";

    // Проверяем, есть ли уже админ
    const existingAdmin = await knex("accounts")
        .where({ login: adminLogin })
        .first();

    if (existingAdmin) {
        console.log("⚠️  Админ уже существует, пропускаем создание");
        return;
    }

    // Создаем первого админа
    const hashedPassword = await AccountHelper.hashPassword(adminPassword);

    await knex("accounts").insert({
        login: adminLogin,
        password: hashedPassword,
        name: adminName,
        role: "admin",
        is_delete: false,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
    });

    console.log(`✅ Создан админ: login=${adminLogin}`);
}
