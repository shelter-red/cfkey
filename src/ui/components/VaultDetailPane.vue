<script setup lang="ts">
import { ArrowLeft, Check, Copy, Pencil, RotateCcw, Star, Trash2 } from "@lucide/vue";
import {
  NAlert, NButton, NCard, NCode, NEmpty, NFlex, NGi, NGrid, NH3,
  NIcon, NLayoutContent, NList, NListItem, NP, NPageHeader, NSpin,
  NTag, NText,
} from "naive-ui";
import { TEMPLATE_BY_ID } from "@shared/templates";
import type { SecretFieldDefinition, VaultItem, VaultSecretData } from "@shared/types";
import { formatShortDate } from "../format";

const props = defineProps<{
  selected: VaultItem | null;
  trash: boolean;
  secretData: VaultSecretData | null;
  secretLoading: boolean;
  secretError: string;
  copiedField: string;
}>();

const emit = defineEmits<{
  close: [];
  favorite: [item: VaultItem];
  edit: [item: VaultItem];
  restore: [item: VaultItem];
  remove: [item: VaultItem];
  retry: [item: VaultItem];
  copy: [fieldId: string];
}>();

function visibleFields(item: VaultItem): SecretFieldDefinition[] {
  const template = TEMPLATE_BY_ID.get(item.type);
  return template?.fields.filter((field) => Boolean(props.secretData?.fields[field.id])) ?? [];
}
</script>

<template>
  <NLayoutContent class="detail-pane">
    <NEmpty v-if="!selected" description="选择一条密钥查看详情" class="detail-empty" />
    <template v-else>
      <NButton class="mobile-back" quaternary @click="emit('close')">
        <template #icon><NIcon><ArrowLeft /></NIcon></template>返回列表
      </NButton>
      <NPageHeader :title="selected.name" :subtitle="TEMPLATE_BY_ID.get(selected.type)?.description" class="detail-header">
        <template #extra>
          <NFlex :wrap="false" :size="4">
            <NButton quaternary circle :title="selected.favorite ? '取消收藏' : '收藏'" @click="emit('favorite', selected)">
              <template #icon><NIcon :color="selected.favorite ? '#b68221' : undefined"><Star /></NIcon></template>
            </NButton>
            <NButton v-if="!trash" quaternary circle title="编辑" :disabled="secretLoading" @click="emit('edit', selected)">
              <template #icon><NIcon><Pencil /></NIcon></template>
            </NButton>
            <NButton v-if="trash" quaternary circle title="恢复" @click="emit('restore', selected)">
              <template #icon><NIcon><RotateCcw /></NIcon></template>
            </NButton>
            <NButton quaternary circle type="error" :title="trash ? '永久删除' : '移入回收站'" @click="emit('remove', selected)">
              <template #icon><NIcon><Trash2 /></NIcon></template>
            </NButton>
          </NFlex>
        </template>
      </NPageHeader>

      <NGrid cols="1 820:3" responsive="self" class="metadata-grid">
        <NGi>
          <NFlex class="metadata-cell" vertical :size="4">
            <NText depth="3" class="metadata-label">服务商</NText>
            <NText strong class="metadata-value">{{ selected.provider || "未填写" }}</NText>
          </NFlex>
        </NGi>
        <NGi>
          <NFlex class="metadata-cell" vertical :size="4">
            <NText depth="3" class="metadata-label">分类</NText>
            <NText strong class="metadata-value">{{ selected.category || "未分类" }}</NText>
          </NFlex>
        </NGi>
        <NGi>
          <NFlex class="metadata-cell" vertical :size="4">
            <NText depth="3" class="metadata-label">更新时间</NText>
            <NText strong class="metadata-value">{{ formatShortDate(selected.updatedAt) }}</NText>
          </NFlex>
        </NGi>
      </NGrid>

      <NFlex class="secret-section" vertical :size="14">
        <NH3>密钥内容</NH3>
        <NEmpty v-if="trash" description="恢复后可查看密钥内容" class="secret-state" />
        <NFlex v-else-if="secretLoading" class="secret-state" vertical align="center" justify="center">
          <NSpin />
          <NText depth="3">正在解密</NText>
        </NFlex>
        <NAlert v-else-if="secretError" type="error" title="密钥内容读取失败">
          <NFlex align="center" justify="space-between">
            <NText>{{ secretError }}</NText>
            <NButton size="small" @click="emit('retry', selected)">重新加载</NButton>
          </NFlex>
        </NAlert>
        <NList v-else-if="secretData && visibleFields(selected).length" bordered class="secret-list">
          <NListItem v-for="field in visibleFields(selected)" :key="field.id">
            <NFlex class="secret-row" align="flex-start" justify="space-between" :wrap="false">
              <NFlex class="secret-content" vertical :size="4">
                <NText depth="3" class="secret-label">{{ field.label }}</NText>
                <NCode :code="secretData.fields[field.id]" word-wrap internal-no-highlight />
              </NFlex>
              <NButton v-if="field.copyable" quaternary circle :title="`复制${field.label}`" @click="emit('copy', field.id)">
                <template #icon><NIcon><Check v-if="copiedField === field.id" /><Copy v-else /></NIcon></template>
              </NButton>
            </NFlex>
          </NListItem>
        </NList>
        <NEmpty v-else-if="secretData && !secretData.notes" description="未填写密钥内容" class="secret-state" />
        <NCard v-if="secretData?.notes" size="small" title="备注" class="notes-block" :bordered="false">
          <NP>{{ secretData.notes }}</NP>
        </NCard>
        <NFlex v-if="selected.tags.length" class="detail-tags" :size="4">
          <NTag v-for="tag in selected.tags" :key="tag" size="small" :bordered="false">{{ tag }}</NTag>
        </NFlex>
      </NFlex>
    </template>
  </NLayoutContent>
</template>
