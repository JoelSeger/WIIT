import knex, { type Knex } from 'knex';

/**
Creates an isolated SQLite database for endpoint tests.
This is a test schema, not an execution of the SQL Server migrations. Keep its
columns aligned with the tables used by the routes and repositories under test.
 */
export async function createTestDb(): Promise<Knex> {
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  });

  try {
    await createTestSchema(db);
    return db;
  } catch (error) {
    await db.destroy();
    throw error;
  }
}

async function createTestSchema(db: Knex): Promise<void> {
  await db.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('ad_object_id', 64).notNullable().unique();
    table.string('display_name', 255);
    table.string('email', 255);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.dateTime('last_login_at');
    table.dateTime('created_at').notNullable().defaultTo(db.fn.now());
  });

  await db.schema.createTable('structures', (table) => {
    table.increments('id').primary();
    table.string('code', 50).notNullable().unique();
    table.string('name', 255).notNullable();
    table.string('structure_type', 30).notNullable();
    table.boolean('is_published').notNullable().defaultTo(false);
    table.string('version', 50);
    table.text('description');
    table.string('external_id', 255);
    table.integer('previous_structure_id').references('id').inTable('structures');
    table.integer('created_by').references('id').inTable('users');
    table.integer('updated_by').references('id').inTable('users');
    table.dateTime('created_at').notNullable().defaultTo(db.fn.now());
    table.dateTime('updated_at').notNullable().defaultTo(db.fn.now());
  });

  await db.schema.createTable('node_types', (table) => {
    table.increments('id').primary();
    table.string('code', 50).notNullable().unique();
    table.string('name', 255).notNullable();
    table.string('structure_type', 30);
    table.boolean('is_active').notNullable().defaultTo(true);
  });

  await db.schema.createTable('nodes', (table) => {
    table.increments('id').primary();
    table.integer('structure_id').notNullable().references('id').inTable('structures');
    table.integer('parent_id').references('id').inTable('nodes');
    table.integer('node_type_id').notNullable().references('id').inTable('node_types');
    table.integer('sort_order').notNullable().defaultTo(0);
    table.boolean('is_published').notNullable().defaultTo(false);
    table.string('reference_code', 255);
    table.string('title', 1000).notNullable();
    table.text('description');
    table.date('valid_from');
    table.date('valid_to');
    table.string('external_id', 255);
    table.dateTime('source_updated_at');
    table.integer('created_by').references('id').inTable('users');
    table.integer('updated_by').references('id').inTable('users');
    table.dateTime('created_at').notNullable().defaultTo(db.fn.now());
    table.dateTime('updated_at').notNullable().defaultTo(db.fn.now());
  });

  await db.schema.createTable('property_definitions', (table) => {
    table.increments('id').primary();
    table.integer('node_type_id').notNullable().references('id').inTable('node_types');
    table.string('key', 100).notNullable();
    table.string('label', 255).notNullable();
    table.string('data_type', 20).notNullable().defaultTo('text');
    table.boolean('is_required').notNullable().defaultTo(false);
    table.boolean('is_public').notNullable().defaultTo(true);
    table.boolean('is_repeatable').notNullable().defaultTo(false);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.string('ead_element', 255);
    table.unique(['node_type_id', 'key']);
  });

  await db.schema.createTable('node_property_values', (table) => {
    table.increments('id').primary();
    table.integer('node_id').notNullable().references('id').inTable('nodes').onDelete('CASCADE');
    table.integer('property_definition_id').notNullable().references('id').inTable('property_definitions');
    table.text('value_text');
    table.decimal('value_number', 18, 4);
    table.boolean('value_boolean');
    table.integer('value_order').notNullable().defaultTo(0);
    table.dateTime('updated_at').notNullable().defaultTo(db.fn.now());
    table.integer('updated_by').references('id').inTable('users');
  });

  await db.schema.createTable('transfer_jobs', (table) => {
    table.increments('id').primary();
    table.string('direction', 20).notNullable();
    table.string('format', 20).notNullable();
    table.integer('structure_id').references('id').inTable('structures');
    table.string('file_name', 500);
    table.string('status', 20).notNullable().defaultTo('pending');
    table.integer('node_count');
    table.text('message');
    table.dateTime('started_at').notNullable().defaultTo(db.fn.now());
    table.dateTime('finished_at');
    table.integer('created_by').references('id').inTable('users');
  });
}
/**
  Registers beforeAll/afterAll hooks that create and destroy a fresh
  in-memory SQLite DB for the current describe block.
  Must be called INSIDE a `describe(...)` block - it relies on Jest's
  lifecycle globals, which only exist in a test-file context.

 * Usage:
 *   describe('UserRepository', () => {
 *     const getDb = useTestDb();
 *     let repo: UserRepository;
 *
 *     beforeAll(() => { repo = createUserRepository(getDb()); });
 *
 *     it('finds a user', async () => { ... });
 *   });
 */

export function useTestDb(): () => Knex {
  let db: Knex | undefined;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    if (db) {
      await db.destroy();
      db = undefined;
    }
  });

  return () => {
    if (!db) {
      throw new Error(
          'useTestDb: DB is not initialized. Call the getter inside ' +
          'beforeAll / beforeEach / it - not at the describe block top level.',
      );
    }
    return db;
  };
}