import { deepStrictEqual } from 'assert';
import { CamelCasePlugin, Kysely, sql } from 'kysely';
import { Dialect } from '../../dialect';
import { MysqlDialect, PostgresDialect } from '../../dialects';
import { DB } from '../outputs/postgres.output';

const down = async (db: Kysely<any>, dialect: Dialect) => {
  await db.transaction().execute(async (trx) => {
    await trx.schema.dropTable('user_test').ifExists().execute();

    if (dialect instanceof PostgresDialect) {
      await trx.schema
        .withSchema('test')
        .dropType('status')
        .ifExists()
        .execute();
      await trx.schema.dropSchema('test').ifExists().execute();
      await trx.schema.dropType('status').ifExists().execute();
    }
  });
};

/**
 * Sanity test: expect a type error or a run-time error if the
 * `kysely` introspection result and the `kysely-codegen` output don't match.
 */
const testCamelCasePlugin = async (db: Kysely<DB>) => {
  const rows = await db.selectFrom('userTest').selectAll().execute();
  deepStrictEqual(rows, []);
};

const up = async (db: Kysely<any>, dialect: Dialect) => {
  await db.transaction().execute(async (trx) => {
    if (dialect instanceof PostgresDialect) {
      await trx.schema.createSchema('test').ifNotExists().execute();
      await trx.schema
        .withSchema('test')
        .createType('status')
        .asEnum(['FOO', 'BAR'])
        .execute();
      await trx.schema
        .createType('status')
        .asEnum(['CONFIRMED', 'UNCONFIRMED'])
        .execute();
    }

    let builder = trx.schema.createTable('user_test').addColumn('id', 'serial');

    if (dialect instanceof MysqlDialect) {
      builder = builder.addColumn(
        'user_status',
        sql`enum('CONFIRMED','UNCONFIRMED')`,
      );
    } else if (dialect instanceof PostgresDialect) {
      builder = builder
        .addColumn('user_status', sql`status`)
        .addColumn('user_status_2', sql`test.status`)
        .addColumn('array', sql`text[]`);
    } else {
      builder = builder.addColumn('user_status', 'text');
    }

    await builder.execute();
  });
};

export const migrate = async (dialect: Dialect, connectionString: string) => {
  const db = new Kysely<DB>({
    dialect: await dialect.createKyselyDialect({ connectionString }),
    plugins: [new CamelCasePlugin()],
  });

  await down(db, dialect);
  await up(db, dialect);
  await testCamelCasePlugin(db);

  return db;
};
