<script setup lang="ts">
import { ChevronLeft, ChevronRight, Star } from "@lucide/vue";
import {
  NButton, NEmpty, NFlex, NIcon, NLayoutSider, NList, NListItem,
  NScrollbar, NSelect, NSpin, NTab, NTabs, NTag, NText, NThing,
} from "naive-ui";
import { TEMPLATE_BY_ID } from "@shared/templates";
import type { VaultItem } from "@shared/types";
import { formatShortDate } from "../format";
import type { SelectOption, ViewMode } from "../types";

const props = defineProps<{
  items: VaultItem[];
  selectedId: string;
  loading: boolean;
  query: string;
  activeFilters: number;
  typeFilter: string;
  typeOptions: SelectOption[];
  viewMode: ViewMode;
  currentPage: number;
  nextCursor: string | null;
}>();

const emit = defineEmits<{
  "update:typeFilter": [value: string];
  "update:viewMode": [value: ViewMode];
  select: [item: VaultItem];
  create: [];
  previous: [];
  next: [];
}>();
</script>

<template>
  <NLayoutSider class="vault-pane" :width="390" bordered>
    <NScrollbar class="vault-scroll">
      <NFlex class="pane-toolbar" align="center" justify="space-between" :wrap="false">
        <NFlex align="baseline" :size="8" :wrap="false">
          <NText strong>{{ viewMode === "trash" ? "回收站" : viewMode === "favorites" ? "收藏" : "全部密钥" }}</NText>
          <NText depth="3">本页 {{ items.length }} 条</NText>
        </NFlex>
        <NSelect
          class="type-select"
          size="small"
          :value="typeFilter"
          :options="typeOptions"
          @update:value="emit('update:typeFilter', $event)"
        />
      </NFlex>

      <NTabs
        :value="viewMode"
        type="segment"
        size="small"
        class="view-tabs"
        :animated="false"
        @update:value="emit('update:viewMode', $event as ViewMode)"
      >
        <NTab name="all">全部</NTab>
        <NTab name="favorites">收藏</NTab>
        <NTab name="trash">回收站</NTab>
      </NTabs>

      <NFlex v-if="loading" class="pane-state" vertical align="center" justify="center">
        <NSpin />
        <NText depth="3">正在读取</NText>
      </NFlex>
      <NEmpty
        v-else-if="!items.length"
        :description="query || activeFilters ? '没有符合条件的密钥' : '尚未保存密钥'"
        class="pane-state"
      >
        <template v-if="viewMode !== 'trash' && !query && !activeFilters" #extra>
          <NButton @click="emit('create')">新建密钥</NButton>
        </template>
      </NEmpty>
      <NList v-else hoverable clickable class="item-list">
        <NListItem
          v-for="item in items"
          :key="item.id"
          class="item-row"
          :class="{ selected: selectedId === item.id }"
          role="button"
          tabindex="0"
          @click="emit('select', item)"
          @keydown.enter.prevent="emit('select', item)"
          @keydown.space.prevent="emit('select', item)"
        >
          <NThing>
            <template #header>
              <NFlex class="item-title" align="center" :size="7" :wrap="false">
                <NText>{{ item.name }}</NText>
                <NIcon v-if="item.favorite" color="#b68221"><Star /></NIcon>
              </NFlex>
            </template>
            <template #header-extra>
              <NText depth="3" class="item-date">{{ formatShortDate(item.updatedAt) }}</NText>
            </template>
            <template #description>
              {{ TEMPLATE_BY_ID.get(item.type)?.name || item.type }}<template v-if="item.provider"> · {{ item.provider }}</template>
            </template>
            <template v-if="item.tags.length" #footer>
              <NFlex :size="4"><NTag v-for="tag in item.tags.slice(0, 3)" :key="tag" size="tiny" :bordered="false">{{ tag }}</NTag></NFlex>
            </template>
          </NThing>
        </NListItem>
      </NList>

      <NFlex v-if="items.length || currentPage > 1" class="pagination-bar" align="center" justify="space-between" :wrap="false">
        <NButton quaternary :disabled="currentPage <= 1 || loading" @click="emit('previous')">
          <template #icon><NIcon><ChevronLeft /></NIcon></template><NText class="pagination-label">上一页</NText>
        </NButton>
        <NText depth="3">第 {{ currentPage }} 页</NText>
        <NButton quaternary :disabled="!nextCursor || loading" @click="emit('next')">
          <NText class="pagination-label">下一页</NText><template #icon><NIcon><ChevronRight /></NIcon></template>
        </NButton>
      </NFlex>
    </NScrollbar>
  </NLayoutSider>
</template>
