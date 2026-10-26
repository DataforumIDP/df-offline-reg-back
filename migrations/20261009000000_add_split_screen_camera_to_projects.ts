import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('projects', (table) => {
        table.boolean('split_screen_camera').notNullable().defaultTo(false)
    })
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('projects', (table) => {
        table.dropColumn('split_screen_camera')
    })
}
