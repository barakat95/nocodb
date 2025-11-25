import { PermissionEntity, PermissionKey, PermissionOptionValue, PermissionOptions, ProjectRoles, getPermissionIcon, getPermissionLabel, getPermissionOption } from 'nocodb-sdk'

// Re-export the interface from SDK for backward compatibility
export type { PermissionOption } from 'nocodb-sdk'

export const usePermissions = () => {
  // Use centralized permission options from SDK
  const permissionOptions = PermissionOptions

  const { baseRoles } = useRoles()
  const { getMeta } = useMetas()

  // Permissions data grouped by entity
  const permissionsByEntity = computed<Record<string, any[]>>(() => {
    return {}
  })

  // Enable table and field permissions for owner members
  const isTableAndFieldPermissionsEnabled = computed(() => {
    return !!baseRoles.value?.[ProjectRoles.OWNER]
  })

  // Get permission summary for an entity (returns internal value)
  const getPermissionSummary = (..._args: any[]) => {
    return PermissionOptionValue.EDITORS_AND_UP
  }

  // Get permission summary with display label
  const getPermissionSummaryLabel = (entity: string, entityId: string, permissionType: string) => {
    const internalValue = getPermissionSummary(entity, entityId, permissionType)
    return getPermissionLabel(internalValue)
  }

  // Check if user is allowed to perform an action based on table permissions
  const isAllowed = (
    entity: PermissionEntity,
    entityId: string,
    permissionKey: PermissionKey,
    options?: { isFormView?: boolean },
  ): boolean => {
    // If permissions are not enabled, allow by default
    if (!isTableAndFieldPermissionsEnabled.value) {
      return true
    }

    // Only check table permissions for now
    if (entity !== PermissionEntity.TABLE) {
      return true
    }

    try {
      // Get table meta
      const meta = getMeta(entityId)
      if (!meta) {
        return true // If meta not found, allow by default
      }

      // Check if permissions are stored in meta
      const metaObj = typeof meta.meta === 'string' ? JSON.parse(meta.meta) : meta.meta
      if (!metaObj?.permissions) {
        return true // If no permissions set, allow by default
      }

      const permissionValue = metaObj.permissions[permissionKey]
      if (!permissionValue) {
        return true // If permission not set, allow by default
      }

      // Check user role against permission requirement
      const userRole = baseRoles.value

      // Map permission values to required roles
      switch (permissionValue) {
        case PermissionOptionValue.CREATORS_AND_UP:
          // Only creators and owners can perform action
          return !!(userRole?.[ProjectRoles.CREATOR] || userRole?.[ProjectRoles.OWNER])

        case PermissionOptionValue.EDITORS_AND_UP:
          // Editors, creators, and owners can perform action
          return !!(
            userRole?.[ProjectRoles.EDITOR] ||
            userRole?.[ProjectRoles.CREATOR] ||
            userRole?.[ProjectRoles.OWNER]
          )

        case PermissionOptionValue.VIEWERS_AND_UP:
          // All roles can perform action
          return true

        case PermissionOptionValue.NOBODY:
          // No one can perform action
          return false

        case PermissionOptionValue.SPECIFIC_USERS:
          // TODO: Implement specific users check
          return true

        default:
          return true
      }
    } catch (e) {
      console.error('Error checking permission:', e)
      return true // On error, allow by default
    }
  }

  const getPermissionColor = (..._args: any[]): string => {
    return 'gray'
  }

  const getPermissionTextColor = (..._args: any[]): string => {
    return 'text-gray-700'
  }

  return {
    permissionOptions,
    permissionsByEntity,
    getPermissionOption,
    getPermissionLabel,
    getPermissionIcon,
    getPermissionColor,
    getPermissionTextColor,
    getPermissionSummary,
    getPermissionSummaryLabel,
    isAllowed,
    isTableAndFieldPermissionsEnabled,
  }
}
