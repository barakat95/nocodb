import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Add index for permission lookups by base_id, entity, and entity_id
  // Note: We exclude 'permission' column to avoid "Specified key was too long" error in MySQL
  // The existing 'nc_permissions_entity' index covers (entity, entity_id, permission)
  // The primary key of permission_subjects covers (fk_permission_id, subject_type, subject_id)
  await knex.schema.alterTable(MetaTable.PERMISSIONS, (table) => {
    table.index(
      ['base_id', 'entity', 'entity_id'],
      'idx_nc_permissions_lookup',
    );
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PERMISSIONS, (table) => {
    table.dropIndex(
      ['base_id', 'entity', 'entity_id'],
      'idx_nc_permissions_lookup',
    );
  });
};

export { up, down };
