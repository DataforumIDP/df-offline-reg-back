import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('runtime_script_runs', (table) => {
        table.increments('id').primary()
        table
            .integer('project_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('projects')
            .onDelete('CASCADE')
        table.text('script_code').notNullable()
        table.string('status', 20).notNullable().defaultTo('running')
        table.jsonb('result').nullable()
        table.jsonb('log').notNullable().defaultTo('[]')
        table.timestamp('started_at').notNullable().defaultTo(knex.fn.now())
        table.timestamp('completed_at').nullable()

        table.index(['project_id', 'started_at'])
    })
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('runtime_script_runs')
}
