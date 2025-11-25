import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PermissionsService } from '~/services/permissions.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import type {
  PermissionEntity,
  PermissionKey,
  PermissionOptionValue,
} from 'nocodb-sdk';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get([
    '/api/v1/db/meta/projects/:baseId/permissions',
    '/api/v2/meta/bases/:baseId/permissions',
  ])
  @Acl('baseUserList')
  async list(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Query('entity') entity?: PermissionEntity,
    @Query('entityId') entityId?: string,
    @Query('permission') permission?: PermissionKey,
  ) {
    return await this.permissionsService.list(context, {
      baseId,
      entity,
      entityId,
      permission,
    });
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/permissions',
    '/api/v2/meta/bases/:baseId/permissions',
  ])
  @Acl('baseUserList')
  async create(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Body()
    body: {
      entity: PermissionEntity;
      entity_id: string;
      permission: PermissionKey;
      granted_type: 'role' | 'user' | 'nobody';
      granted_role?: string;
      enforce_for_form?: boolean;
      enforce_for_automation?: boolean;
      subjects?: Array<{ type: 'user' | 'group'; id: string }>;
    },
    @Req() req: NcRequest,
  ) {
    return await this.permissionsService.create(context, {
      baseId,
      entity: body.entity,
      entityId: body.entity_id,
      permission: body.permission,
      grantedType: body.granted_type as any,
      grantedRole: body.granted_role as any,
      enforceForForm: body.enforce_for_form,
      enforceForAutomation: body.enforce_for_automation,
      subjects: body.subjects,
      req,
    });
  }

  @Put([
    '/api/v1/db/meta/projects/:baseId/permissions/:permissionId',
    '/api/v2/meta/bases/:baseId/permissions/:permissionId',
  ])
  @Acl('baseUserList')
  async update(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('permissionId') permissionId: string,
    @Body()
    body: {
      granted_type?: 'role' | 'user' | 'nobody';
      granted_role?: string;
      enforce_for_form?: boolean;
      enforce_for_automation?: boolean;
      subjects?: Array<{ type: 'user' | 'group'; id: string }>;
    },
  ) {
    return await this.permissionsService.update(context, {
      permissionId,
      grantedType: body.granted_type as any,
      grantedRole: body.granted_role as any,
      enforceForForm: body.enforce_for_form,
      enforceForAutomation: body.enforce_for_automation,
      subjects: body.subjects,
    });
  }

  @Delete([
    '/api/v1/db/meta/projects/:baseId/permissions/:permissionId',
    '/api/v2/meta/bases/:baseId/permissions/:permissionId',
  ])
  @Acl('baseUserList')
  async delete(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return await this.permissionsService.delete(context, { permissionId });
  }

  /**
   * Convenience endpoint to set permissions using PermissionOptionValue
   */
  @Post([
    '/api/v1/db/meta/projects/:baseId/permissions/set',
    '/api/v2/meta/bases/:baseId/permissions/set',
  ])
  @Acl('baseUserList')
  async set(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Body()
    body: {
      entity: PermissionEntity;
      entity_id: string;
      permission: PermissionKey;
      permission_value: PermissionOptionValue;
      subjects?: Array<{ type: 'user' | 'group'; id: string }>;
    },
    @Req() req: NcRequest,
  ) {
    return await this.permissionsService.set(context, {
      baseId,
      entity: body.entity,
      entityId: body.entity_id,
      permission: body.permission,
      permissionValue: body.permission_value,
      subjects: body.subjects,
      req,
    });
  }
}



