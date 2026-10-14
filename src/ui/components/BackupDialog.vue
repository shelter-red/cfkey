<script setup lang="ts">
import { Download, FileWarning, ShieldCheck, Upload } from "@lucide/vue";
import {
  NAlert, NButton, NFlex, NForm, NFormItem, NIcon, NInput, NModal,
  NTab, NTabs, NText,
} from "naive-ui";
import { computed, ref } from "vue";
import type { BackupFile } from "@shared/backup";
import { api } from "../api";
import { deriveKeyFromBackup, downloadBackup, parseBackupText, prepareBackupKey } from "../backup";
import type { ImportPreview, ImportResult } from "../types";

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{
  "update:show": [value: boolean];
  imported: [message: string];
  notify: [message: string];
  error: [value: unknown];
}>();

const tab = ref<"export" | "import">("export");
const fileInput = ref<HTMLInputElement | null>(null);

const exportPassword = ref("");
const exportConfirm = ref("");
const exportBusy = ref(false);

const importFile = ref<File | null>(null);
const importPassword = ref("");
const importBusy = ref(false);
const applying = ref(false);
const preview = ref<ImportPreview | null>(null);
let pending: { file: BackupFile; key: string } | null = null;

const canExport = computed(() => exportPassword.value.length > 0 && exportPassword.value === exportConfirm.value);
const exportMismatch = computed(() => exportConfirm.value.length > 0 && exportPassword.value !== exportConfirm.value);

function close(value: boolean) {
  emit("update:show", value);
}

function reset() {
  tab.value = "export";
  exportPassword.value = "";
  exportConfirm.value = "";
  exportBusy.value = false;
  importFile.value = null;
  importPassword.value = "";
  importBusy.value = false;
  applying.value = false;
  preview.value = null;
  pending = null;
  if (fileInput.value) fileInput.value.value = "";
}

async function runExport() {
  if (!canExport.value) return;
  exportBusy.value = true;
  try {
    const params = await prepareBackupKey(exportPassword.value);
    const file = await api<BackupFile>("/api/export", { method: "POST", body: JSON.stringify(params) });
    downloadBackup(file);
    exportPassword.value = "";
    exportConfirm.value = "";
    emit("notify", `已导出 ${file.itemCount} 条密钥`);
  } catch (value) {
    emit("error", value);
  } finally {
    exportBusy.value = false;
  }
}

function pickFile() {
  fileInput.value?.click();
}

function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  importFile.value = file;
  preview.value = null;
  pending = null;
  importPassword.value = "";
}

async function runPreview() {
  const selected = importFile.value;
  if (!selected || !importPassword.value) return;
  importBusy.value = true;
  try {
    const file = parseBackupText(await selected.text());
    const key = await deriveKeyFromBackup(importPassword.value, file);
    const result = await api<ImportPreview>("/api/import/preview", {
      method: "POST",
      body: JSON.stringify({ key, file }),
    });
    pending = { file, key };
    preview.value = result;
  } catch (value) {
    preview.value = null;
    pending = null;
    emit("error", value);
  } finally {
    importBusy.value = false;
  }
}

async function runImport(mode: "merge" | "overwrite") {
  if (!pending) return;
  applying.value = true;
  try {
    const result = await api<ImportResult>("/api/import", {
      method: "POST",
      body: JSON.stringify({ key: pending.key, file: pending.file, mode }),
    });
    const failed = result.failed > 0 ? `，${result.failed} 条失败` : "";
    emit("imported", `已导入 ${result.created} 条，覆盖 ${result.overwritten} 条${failed}`);
    emit("update:show", false);
  } catch (value) {
    emit("error", value);
  } finally {
    applying.value = false;
  }
}
</script>

<template>
  <NModal
    :show="props.show"
    preset="card"
    title="加密备份"
    class="backup-modal"
    :mask-closable="false"
    @update:show="close"
    @after-leave="reset"
  >
    <NFlex vertical :size="16">
      <NAlert type="info" :bordered="false" :show-icon="false">
        <NText depth="2">
          备份用口令派生的 AES-256-GCM 密钥加密，只有 CFKey 能再次导入。口令不会上传，派生密钥会发送到 Worker 用于加解密。
        </NText>
      </NAlert>

      <NTabs :value="tab" type="segment" :animated="false" @update:value="tab = $event as 'export' | 'import'">
        <NTab name="export">导出</NTab>
        <NTab name="import">导入</NTab>
      </NTabs>

      <NForm v-if="tab === 'export'" label-placement="top" @submit.prevent="runExport">
        <NFormItem label="备份口令" :show-feedback="false">
          <NInput v-model:value="exportPassword" type="password" show-password-on="click" autocomplete="new-password" />
        </NFormItem>
        <NFormItem
          label="确认口令"
          :validation-status="exportMismatch ? 'error' : undefined"
          :feedback="exportMismatch ? '两次输入的口令不一致' : undefined"
        >
          <NInput v-model:value="exportConfirm" type="password" show-password-on="click" autocomplete="new-password" />
        </NFormItem>
        <NFlex vertical :size="10">
          <NText depth="3">口令丢失后备份无法恢复，请单独保存。</NText>
          <NButton type="primary" attr-type="submit" :loading="exportBusy" :disabled="!canExport || exportBusy">
            <template #icon><NIcon><Download /></NIcon></template>导出全部未删除密钥
          </NButton>
        </NFlex>
      </NForm>

      <NFlex v-else vertical :size="14">
        <NFlex align="center" :size="10" :wrap="false">
          <NButton secondary @click="pickFile">
            <template #icon><NIcon><Upload /></NIcon></template>选择备份文件
          </NButton>
          <NText depth="3" class="backup-filename">{{ importFile?.name ?? "尚未选择文件" }}</NText>
        </NFlex>
        <input
          ref="fileInput"
          class="visually-hidden"
          type="file"
          accept=".json,.cfkey,application/json"
          @change="onFileChange"
        />

        <NForm v-if="importFile" label-placement="top" @submit.prevent="runPreview">
          <NFormItem label="备份口令" :show-feedback="false">
            <NInput v-model:value="importPassword" type="password" show-password-on="click" autocomplete="current-password" />
          </NFormItem>
          <NButton
            v-if="!preview"
            attr-type="submit"
            :loading="importBusy"
            :disabled="!importPassword || importBusy"
          >
            <template #icon><NIcon><ShieldCheck /></NIcon></template>读取备份内容
          </NButton>
        </NForm>

        <template v-if="preview">
          <NAlert type="warning" :bordered="false" :show-icon="false">
            <NFlex vertical :size="6">
              <NFlex align="center" :size="6">
                <NIcon><FileWarning /></NIcon>
                <NText>
                  该备份包含 {{ preview.itemCount }} 条密钥，其中 {{ preview.conflicting }} 条与现有记录 id 相同。
                </NText>
              </NFlex>
              <NText depth="3">合并新建不会覆盖任何现有内容；覆盖还原会用备份内容替换同 id 的记录。</NText>
            </NFlex>
          </NAlert>
          <NFlex :size="10" :wrap="false">
            <NButton type="primary" :loading="applying" :disabled="applying" @click="runImport('merge')">合并新建</NButton>
            <NButton :loading="applying" :disabled="applying" @click="runImport('overwrite')">覆盖还原</NButton>
          </NFlex>
        </template>
      </NFlex>
    </NFlex>
  </NModal>
</template>
