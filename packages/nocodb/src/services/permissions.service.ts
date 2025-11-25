import { Injectable, Logger } from '@nestjs/common';
import {
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PermissionRole,
  PermissionOptionValue,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import Permission from '~/models/Permission';
import { NcError } from '~/helpers/catchError';
import { validatePayload } from '~/helpers';

@Injectable()
export class PermissionsService {
  protected readonly logger = new Logger(PermissionsService.name);

  async list(
    context: NcContext,
    param: {
      baseId: string;
      entity?: PermissionEntity;
      entityId?: string;
      permission?: PermissionKey;
    },
  ) {
    return await Permission.list(context, param.baseId, {
      entity: param.entity,
      entityId: param.entityId,
      permission: param.permission,
    });
  }

  async create(
    context: NcContext,
    param: {
      baseId: string;
      entity: PermissionEntity;
      entityId: string;
      permission: PermissionKey;
      grantedType: PermissionGrantedType;
      grantedRole?: PermissionRole;
      enforceForForm?: boolean;
      enforceForAutomation?: boolean;
      subjects?: Array<{ type: 'user' | 'group'; id: string }>;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/PermissionReq', {
      entity: param.entity,
      entity_id: param.entityId,
      permission: param.permission,
      granted_type: param.grantedType,
      granted_role: param.grantedRole,
    });

    return await Permission.create(context, {
      base_id: param.baseId,
      entity: param.entity,
      entity_id: param.entityId,
      permission: param.permission,
      granted_type: param.grantedType,
      granted_role: param.grantedRole,
      enforce_for_form: param.enforceForForm,
      enforce_for_automation: param.enforceForAutomation,
      subjects: param.subjects,
    });
  }

  async update(
    context: NcContext,
    param: {
      permissionId: string;
      grantedType?: PermissionGrantedType;
      grantedRole?: PermissionRole;
      enforceForForm?: boolean;
      enforceForAutomation?: boolean;
      subjects?: Array<{ type: 'user' | 'group'; id: string }>;
    },
  ) {
    return await Permission.update(context, param.permissionId, {
      granted_type: param.grantedType,
      granted_role: param.grantedRole,
      enforce_for_form: param.enforceForForm,
      enforce_for_automation: param.enforceForAutomation,
      subjects: param.subjects,
    });
  }

  async delete(context: NcContext, param: { permissionId: string }) {
    await Permission.delete(context, param.permissionId);
    return { msg: 'Permission deleted successfully' };
  }

  /**
   * Set permissions for an entity (creates or updates)
   * This is a convenience method that handles the logic of creating/updating permissions
   */
  async set(
    context: NcContext,
    param: {
      baseId: string;
      entity: PermissionEntity;
      entityId: string;
      permission: PermissionKey;
      permissionValue: PermissionOptionValue;
      subjects?: Array<{ type: 'user' | 'group'; id: string }>;
      req: NcRequest;
    },
  ) {
    // Find existing permission
    const existing = await Permission.list(context, param.baseId, {
      entity: param.entity,
      entityId: param.entityId,
      permission: param.permission,
    });

    // Convert PermissionOptionValue to granted_type and granted_role
    let grantedType: PermissionGrantedType;
    let grantedRole: PermissionRole | undefined;

    if (param.permissionValue === PermissionOptionValue.NOBODY) {
      grantedType = 'nobody';
    } else if (param.permissionValue === PermissionOptionValue.SPECIFIC_USERS) {
      grantedType = 'user';
    } else {
      grantedType = 'role';
      // Map permission value to role
      if (param.permissionValue === PermissionOptionValue.CREATORS_AND_UP) {
        grantedRole = PermissionRole.CREATOR;
      } else if (param.permissionValue === PermissionOptionValue.EDITORS_AND_UP) {
        grantedRole = PermissionRole.EDITOR;
      } else if (param.permissionValue === PermissionOptionValue.VIEWERS_AND_UP) {
        grantedRole = PermissionRole.VIEWER;
      }
    }

    if (existing.length > 0) {
      // Update existing permission
      return await Permission.update(context, existing[0].id, {
        granted_type: grantedType,
        granted_role: grantedRole,
        subjects: param.subjects,
      });
    } else {
      // Create new permission
      return await Permission.create(context, {
        base_id: param.baseId,
        entity: param.entity,
        entity_id: param.entityId,
        permission: param.permission,
        granted_type: grantedType,
        granted_role: grantedRole,
        subjects: param.subjects,
      });
    }
  }
}

