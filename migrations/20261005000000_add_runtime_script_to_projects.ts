import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('projects', (table) => {
        table.text('runtime_script').nullable().defaultTo(null)
    })
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('projects', (table) => {
        table.dropColumn('runtime_script')
    })
}
