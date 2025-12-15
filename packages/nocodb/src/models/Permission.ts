import {
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PermissionRole,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable } from '~/utils/globals';
import { nanoid } from 'nanoid';

export default class Permission {
  id: string;
  fk_workspace_id: string;
  base_id: string;
  entity: PermissionEntity;
  entity_id: string;
  permission: PermissionKey;
  created_by: string;
  enforce_for_form: boolean;
  enforce_for_automation: boolean;
  granted_type: PermissionGrantedType;
  granted_role: PermissionRole;

  subjects?: {
    type: 'user' | 'group';
    id: string;
  }[];

  constructor(permission: Permission) {
    Object.assign(this, permission);
  }

  public static async list(
    context: NcContext,
    baseId: string,
    options?: {
      entity?: PermissionEntity;
      entityId?: string;
      permission?: PermissionKey;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Permission[]> {
    // Use LEFT JOIN to fetch permissions and subjects in a single query
    const query = ncMeta
      .knex(MetaTable.PERMISSIONS)
      .leftJoin(
        MetaTable.PERMISSION_SUBJECTS,
        `${MetaTable.PERMISSIONS}.id`,
        `${MetaTable.PERMISSION_SUBJECTS}.fk_permission_id`,
      )
      .where(`${MetaTable.PERMISSIONS}.base_id`, baseId)
      .select(
        `${MetaTable.PERMISSIONS}.*`,
        ncMeta.knex.raw(
          `${MetaTable.PERMISSION_SUBJECTS}.subject_type as subject_type`,
        ),
        ncMeta.knex.raw(
          `${MetaTable.PERMISSION_SUBJECTS}.subject_id as subject_id`,
        ),
      );

    if (context.workspace_id) {
      query.where(`${MetaTable.PERMISSIONS}.fk_workspace_id`, context.workspace_id);
    }

    if (options?.entity) {
      query.where(`${MetaTable.PERMISSIONS}.entity`, options.entity);
    }

    if (options?.entityId) {
      query.where(`${MetaTable.PERMISSIONS}.entity_id`, options.entityId);
    }

    if (options?.permission) {
      query.where(`${MetaTable.PERMISSIONS}.permission`, options.permission);
    }

    const rows = await query;

    // Group subjects by permission id
    const permissionMap = new Map<string, Permission>();

    for (const row of rows) {
      if (!permissionMap.has(row.id)) {
        permissionMap.set(row.id, {
          id: row.id,
          fk_workspace_id: row.fk_workspace_id,
          base_id: row.base_id,
          entity: row.entity,
          entity_id: row.entity_id,
          permission: row.permission,
          created_by: row.created_by,
          enforce_for_form: row.enforce_for_form,
          enforce_for_automation: row.enforce_for_automation,
          granted_type: row.granted_type,
          granted_role: row.granted_role,
          subjects: [],
        });
      }

      // Add subject if it exists
      if (row.subject_type && row.subject_id) {
        permissionMap.get(row.id)!.subjects!.push({
          type: row.subject_type,
          id: row.subject_id,
        });
      }
    }

    return Array.from(permissionMap.values());
  }

  /**
   * Batch load permissions for multiple entities
   * This is optimized to load all permissions in a single query instead of N separate queries
   */
  public static async listByEntities(
    context: NcContext,
    baseId: string,
    entities: Array<{
      entity: PermissionEntity;
      entityId: string;
      permission?: PermissionKey;
    }>,
    ncMeta = Noco.ncMeta,
  ): Promise<Map<string, Permission[]>> {
    if (entities.length === 0) {
      return new Map();
    }

    // Build query to fetch all permissions at once
    const query = ncMeta
      .knex(MetaTable.PERMISSIONS)
      .leftJoin(
        MetaTable.PERMISSION_SUBJECTS,
        `${MetaTable.PERMISSIONS}.id`,
        `${MetaTable.PERMISSION_SUBJECTS}.fk_permission_id`,
      )
      .where(`${MetaTable.PERMISSIONS}.base_id`, baseId)
      .select(
        `${MetaTable.PERMISSIONS}.*`,
        ncMeta.knex.raw(
          `${MetaTable.PERMISSION_SUBJECTS}.subject_type as subject_type`,
        ),
        ncMeta.knex.raw(
          `${MetaTable.PERMISSION_SUBJECTS}.subject_id as subject_id`,
        ),
      );

    if (context.workspace_id) {
      query.where(`${MetaTable.PERMISSIONS}.fk_workspace_id`, context.workspace_id);
    }

    // Add OR conditions for each entity
    query.where((qb) => {
      for (const { entity, entityId, permission } of entities) {
        qb.orWhere((subQb) => {
          subQb
            .where(`${MetaTable.PERMISSIONS}.entity`, entity)
            .where(`${MetaTable.PERMISSIONS}.entity_id`, entityId);

          if (permission) {
            subQb.where(`${MetaTable.PERMISSIONS}.permission`, permission);
          }
        });
      }
    });

    const rows = await query;

    // Group by permission id first
    const permissionMap = new Map<string, Permission>();

    for (const row of rows) {
      if (!permissionMap.has(row.id)) {
        permissionMap.set(row.id, {
          id: row.id,
          fk_workspace_id: row.fk_workspace_id,
          base_id: row.base_id,
          entity: row.entity,
          entity_id: row.entity_id,
          permission: row.permission,
          created_by: row.created_by,
          enforce_for_form: row.enforce_for_form,
          enforce_for_automation: row.enforce_for_automation,
          granted_type: row.granted_type,
          granted_role: row.granted_role,
          subjects: [],
        });
      }

      // Add subject if it exists
      if (row.subject_type && row.subject_id) {
        permissionMap.get(row.id)!.subjects!.push({
          type: row.subject_type,
          id: row.subject_id,
        });
      }
    }

    // Group permissions by entity_id for easy lookup
    const result = new Map<string, Permission[]>();

    for (const permission of permissionMap.values()) {
      const key = permission.entity_id;
      if (!result.has(key)) {
        result.set(key, []);
      }
      result.get(key)!.push(permission);
    }

    return result;
  }


  public static async create(
    context: NcContext,
    permission: {
      base_id: string;
      entity: PermissionEntity;
      entity_id: string;
      permission: PermissionKey;
      granted_type: PermissionGrantedType;
      granted_role?: PermissionRole;
      enforce_for_form?: boolean;
      enforce_for_automation?: boolean;
      subjects?: Array<{ type: 'user' | 'group'; id: string }>;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Permission> {
    const id = nanoid(20);

    const insertObj = extractProps(permission, [
      'base_id',
      'entity',
      'entity_id',
      'permission',
      'granted_type',
      'granted_role',
      'enforce_for_form',
      'enforce_for_automation',
    ]) as any;

    insertObj.id = id;
    insertObj.fk_workspace_id = context.workspace_id;
    insertObj.created_by = context.user?.id;
    insertObj.enforce_for_form = permission.enforce_for_form ?? true;
    insertObj.enforce_for_automation = permission.enforce_for_automation ?? true;

    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.PERMISSIONS,
      insertObj,
    );

    // Insert subjects if provided
    if (permission.subjects && permission.subjects.length > 0) {
      const subjectInserts = permission.subjects.map((subject) => ({
        fk_permission_id: id,
        subject_type: subject.type,
        subject_id: subject.id,
        fk_workspace_id: context.workspace_id,
        base_id: permission.base_id,
      }));

      // Use direct knex insert instead of bulkMetaInsert because nc_permission_subjects
      // doesn't have an 'id' column (uses composite primary key)
      await ncMeta.knex(MetaTable.PERMISSION_SUBJECTS).insert(subjectInserts);
    }

    return this.get(context, id, ncMeta);
  }

  public static async get(
    context: NcContext,
    permissionId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Permission> {
    const permission = await ncMeta
      .knex(MetaTable.PERMISSIONS)
      .where('id', permissionId)
      .first();

    if (!permission) {
      return null;
    }

    const subjects = await ncMeta
      .knex(MetaTable.PERMISSION_SUBJECTS)
      .where('fk_permission_id', permissionId);

    return {
      ...permission,
      subjects: subjects.map((s) => ({
        type: s.subject_type,
        id: s.subject_id,
      })),
    } as Permission;
  }

  public static async update(
    context: NcContext,
    permissionId: string,
    permission: {
      granted_type?: PermissionGrantedType;
      granted_role?: PermissionRole;
      enforce_for_form?: boolean;
      enforce_for_automation?: boolean;
      subjects?: Array<{ type: 'user' | 'group'; id: string }>;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Permission> {
    const existing = await this.get(context, permissionId, ncMeta);
    if (!existing) {
      return null;
    }

    const updateObj = extractProps(permission, [
      'granted_type',
      'granted_role',
      'enforce_for_form',
      'enforce_for_automation',
    ]);

    if (Object.keys(updateObj).length > 0) {
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.PERMISSIONS,
        updateObj,
        { id: permissionId },
      );
    }

    // Update subjects if provided
    if (permission.subjects !== undefined) {
      // Delete existing subjects
      await ncMeta
        .knex(MetaTable.PERMISSION_SUBJECTS)
        .where('fk_permission_id', permissionId)
        .delete();

      // Insert new subjects
      if (permission.subjects.length > 0) {
        const subjectInserts = permission.subjects.map((subject) => ({
          fk_permission_id: permissionId,
          subject_type: subject.type,
          subject_id: subject.id,
          fk_workspace_id: context.workspace_id,
          base_id: existing.base_id,
        }));

        // Use direct knex insert instead of bulkMetaInsert because nc_permission_subjects
        // doesn't have an 'id' column (uses composite primary key)
        await ncMeta.knex(MetaTable.PERMISSION_SUBJECTS).insert(subjectInserts);
      }
    }

    return this.get(context, permissionId, ncMeta);
  }

  public static async delete(
    context: NcContext,
    permissionId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    // Delete subjects first
    await ncMeta
      .knex(MetaTable.PERMISSION_SUBJECTS)
      .where('fk_permission_id', permissionId)
      .delete();

    // Delete permission
    await ncMeta
      .knex(MetaTable.PERMISSIONS)
      .where('id', permissionId)
      .delete();
  }

  public static async deleteByEntity(
    context: NcContext,
    baseId: string,
    entity: PermissionEntity,
    entityId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const permissions = await this.list(context, baseId, { entity, entityId }, ncMeta);

    for (const permission of permissions) {
      await this.delete(context, permission.id, ncMeta);
    }
  }
}
