<script lang="ts" setup>
import { PermissionEntity, PermissionKey, PermissionMeta, PermissionOptionValue } from 'nocodb-sdk'

interface Props {
  visible: boolean
  viewId: string
  title?: string
}

const props = defineProps<Props>()

const emit = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emit)

const { $e, $api } = useNuxtApp()

const { base } = storeToRefs(useBase())

const isLoading = ref(false)

const permissions = ref<Record<string, PermissionOptionValue>>({
  [PermissionKey.VIEW_ACCESS]: PermissionOptionValue.VIEWERS_AND_UP,
})

const selectedUsers = ref<Record<string, string[]>>({
  [PermissionKey.VIEW_ACCESS]: [],
})

const { getPermissionLabel, getPermissionIcon, permissionOptions } = usePermissions()

const { getBaseUsers } = useBases()

const baseUsers = ref<any[]>([])

// Load existing permissions
const loadPermissions = async () => {
  if (!props.viewId || !base.value?.id) return

  isLoading.value = true
  try {
    // Load permissions from API
    const response = await $api.instance.get(`/api/v2/meta/bases/${base.value.id}/permissions`, {
      params: {
        entity: PermissionEntity.VIEW,
        entityId: props.viewId,
        permission: PermissionKey.VIEW_ACCESS,
      },
    })

    if (response.data && response.data.length > 0) {
      const permission = response.data[0]
      
      // Convert granted_type and granted_role to PermissionOptionValue
      if (permission.granted_type === 'nobody') {
        permissions.value[PermissionKey.VIEW_ACCESS] = PermissionOptionValue.NOBODY
      } else if (permission.granted_type === 'user') {
        permissions.value[PermissionKey.VIEW_ACCESS] = PermissionOptionValue.SPECIFIC_USERS
        selectedUsers.value[PermissionKey.VIEW_ACCESS] = permission.subjects?.map((s: any) => s.id) || []
      } else if (permission.granted_type === 'role') {
        if (permission.granted_role === 'viewer') {
          permissions.value[PermissionKey.VIEW_ACCESS] = PermissionOptionValue.VIEWERS_AND_UP
        } else if (permission.granted_role === 'editor') {
          permissions.value[PermissionKey.VIEW_ACCESS] = PermissionOptionValue.EDITORS_AND_UP
        } else if (permission.granted_role === 'creator') {
          permissions.value[PermissionKey.VIEW_ACCESS] = PermissionOptionValue.CREATORS_AND_UP
        }
      }
    }
  } catch (e: any) {
    // If no permissions found, use default
    console.log('No existing permissions found, using defaults')
  } finally {
    isLoading.value = false
  }
}

// Load base users
const loadBaseUsers = async () => {
  if (!base.value?.id) return

  try {
    const { users } = await getBaseUsers({
      baseId: base.value.id,
      force: true,
    })
    baseUsers.value = users.filter((u: any) => !u?.deleted)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// Save permissions
const savePermissions = async () => {
  if (!props.viewId || !base.value?.id) return

  isLoading.value = true
  try {
    const permissionValue = permissions.value[PermissionKey.VIEW_ACCESS]
    const subjects =
      permissionValue === PermissionOptionValue.SPECIFIC_USERS
        ? selectedUsers.value[PermissionKey.VIEW_ACCESS].map((userId) => ({
            type: 'user' as const,
            id: userId,
          }))
        : undefined

    // Use the set endpoint
    await $api.instance.post(`/api/v2/meta/bases/${base.value.id}/permissions/set`, {
      entity: PermissionEntity.VIEW,
      entity_id: props.viewId,
      permission: PermissionKey.VIEW_ACCESS,
      permission_value: permissionValue,
      subjects,
    })

    message.success('View permissions updated successfully')
    $e('a:view:permissions:update')
    visible.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

watch(visible, (newVal) => {
  if (newVal) {
    loadPermissions()
    loadBaseUsers()
  }
})

const viewPermissionKeys = [PermissionKey.VIEW_ACCESS]

const getPermissionMeta = (key: PermissionKey) => {
  return PermissionMeta[key] || { label: key, description: '' }
}

const showUserSelector = computed(() => {
  return permissions.value[PermissionKey.VIEW_ACCESS] === PermissionOptionValue.SPECIFIC_USERS
})
</script>

<template>
  <NcModal
    v-model:visible="visible"
    size="large"
    :class="{ 'nc-modal-view-permissions': true }"
    :show-separator="false"
  >
    <template #header>
      <div class="flex flex-row items-center gap-x-2 text-base">
        <GeneralIcon icon="ncLock" class="w-5 h-5 text-gray-600" />
        <span class="text-base font-semibold text-gray-800">
          {{ $t('title.viewPermissions') }}
        </span>
        <span v-if="title" class="text-sm text-gray-500">- {{ title }}</span>
      </div>
    </template>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <GeneralLoader />
    </div>

    <div v-else class="mt-4">
      <div class="text-sm text-gray-600 mb-4">
        {{ $t('msg.info.viewAndEditPermissionsForThisView') }}
      </div>

      <div class="space-y-4">
        <div
          v-for="permissionKey in viewPermissionKeys"
          :key="permissionKey"
          class="flex flex-col gap-4 p-4 border border-gray-200 rounded-lg"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 flex-1">
              <GeneralIcon :icon="getPermissionIcon(permissions[permissionKey])" class="w-5 h-5 text-gray-600" />
              <div>
                <div class="font-medium text-gray-800">
                  {{ getPermissionMeta(permissionKey).label }}
                </div>
                <div class="text-sm text-gray-500">
                  {{ getPermissionMeta(permissionKey).description }}
                </div>
              </div>
            </div>

            <NcSelect
              v-model:value="permissions[permissionKey]"
              class="w-48"
              :options="permissionOptions.map((opt) => ({
                label: opt.label,
                value: opt.value,
              }))"
              :placeholder="$t('general.select')"
            />
          </div>

          <!-- User selector for specific users -->
          <div v-if="showUserSelector" class="mt-2">
            <div class="text-sm text-gray-600 mb-2">
              {{ getPermissionMeta(permissionKey).userSelectorDescription }}
            </div>
            <NcSelect
              v-model:value="selectedUsers[permissionKey]"
              class="w-full"
              :options="baseUsers.map((user) => ({
                label: user.display_name || user.email,
                value: user.id,
              }))"
              :placeholder="$t('general.select')"
              multiple
            />
          </div>
        </div>
      </div>

      <div class="flex flex-row justify-end gap-x-2 mt-6">
        <NcButton type="secondary" size="small" :disabled="isLoading" @click="visible = false">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton
          key="submit"
          type="primary"
          size="small"
          :loading="isLoading"
          @click="savePermissions"
        >
          {{ $t('general.save') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style scoped lang="scss">
.nc-modal-view-permissions {
  :deep(.nc-modal-body) {
    @apply max-h-[70vh] overflow-y-auto;
  }
}
</style>

