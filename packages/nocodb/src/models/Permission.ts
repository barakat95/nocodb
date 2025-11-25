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
import { v4 as uuidv4 } from 'uuid';

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
    const query = ncMeta
      .knex(MetaTable.PERMISSIONS)
      .where('base_id', baseId);

    if (context.workspace_id) {
      query.where('fk_workspace_id', context.workspace_id);
    }

    if (options?.entity) {
      query.where('entity', options.entity);
    }

    if (options?.entityId) {
      query.where('entity_id', options.entityId);
    }

    if (options?.permission) {
      query.where('permission', options.permission);
    }

    const permissions = await query;

    // Load subjects for each permission
    const permissionIds = permissions.map((p) => p.id);
    const subjects = permissionIds.length
      ? await ncMeta
          .knex(MetaTable.PERMISSION_SUBJECTS)
          .whereIn('fk_permission_id', permissionIds)
      : [];

    // Group subjects by permission id
    const subjectsByPermission = subjects.reduce((acc, subj) => {
      if (!acc[subj.fk_permission_id]) {
        acc[subj.fk_permission_id] = [];
      }
      acc[subj.fk_permission_id].push({
        type: subj.subject_type,
        id: subj.subject_id,
      });
      return acc;
    }, {} as Record<string, Array<{ type: string; id: string }>>);

    return permissions.map((p) => ({
      ...p,
      subjects: subjectsByPermission[p.id] || [],
    })) as Permission[];
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
    const id = uuidv4();

    const insertObj = extractProps(permission, [
      'base_id',
      'entity',
      'entity_id',
      'permission',
      'granted_type',
      'granted_role',
      'enforce_for_form',
      'enforce_for_automation',
    ]);

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

      await ncMeta.bulkMetaInsert(
        context.workspace_id,
        context.base_id,
        MetaTable.PERMISSION_SUBJECTS,
        subjectInserts,
      );
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

        await ncMeta.bulkMetaInsert(
          context.workspace_id,
          context.base_id,
          MetaTable.PERMISSION_SUBJECTS,
          subjectInserts,
        );
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
