<script setup lang="ts">
import { ShieldCheck, Sparkles, Upload } from "@lucide/vue";
import {
  NButton, NCascader, NCheckbox, NDivider, NFlex, NForm, NFormItem, NFormItemGi, NGrid,
  NIcon, NInput, NModal, NSelect, NText, NUpload,
  type UploadFileInfo,
} from "naive-ui";
import { CLASSIFICATION_LEAF_BY_ID, type ClassificationCascaderOption } from "@shared/classification";
import type { SecretFieldDefinition, SecretTemplate } from "@shared/types";
import type { FormState, SelectOption } from "../types";
import MnemonicField from "./MnemonicField.vue";
import { computed, ref } from "vue";

const props = defineProps<{
  show: boolean;
  form: FormState;
  template: SecretTemplate;
  classificationOptions: ClassificationCascaderOption[];
  providerOptions: SelectOption[];
  saving: boolean;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  save: [];
  generate: [fieldId: string];
  connectionChange: [];
  imported: [message: string];
  error: [value: unknown];
  closed: [];
}>();

const MAX_IMPORTED_FIELD_BYTES = 60 * 1024;
const attempted = ref(false);
const visibleFields = computed(() => props.template.fields.filter((field) => !field.hidden));

/** Selects are advisory: an unlisted value is kept verbatim and an empty one becomes "". */
function setFieldValue(fieldId: string, value: string | number | null): void {
  props.form.fields[fieldId] = value == null ? "" : String(value);
}

/** Mirrors the server-side cap so a long custom value is clamped instead of silently truncated. */
const PROVIDER_MAX_LENGTH = 120;

function setProvider(value: string | number | null): void {
  props.form.provider = value == null ? "" : String(value).slice(0, PROVIDER_MAX_LENGTH);
}

function setCategory(value: string | number | null): void {
  const category = value == null ? "" : String(value).slice(0, 80);
  const leaf = CLASSIFICATION_LEAF_BY_ID.get(category);
  if (!leaf) return;
  if (props.form.id && leaf.templateId !== props.form.type) return;
  props.form.category = category;
  props.form.type = leaf.templateId;
  if (leaf.databaseEngine) props.form.fields.engine = leaf.databaseEngine;
}

function fieldError(field: SecretFieldDefinition): string | undefined {
  return attempted.value && field.required && !props.form.fields[field.id]?.trim()
    ? `请填写${field.label}`
    : undefined;
}

function submit() {
  attempted.value = true;
  emit("save");
}

function close(value: boolean) {
  if (!value) attempted.value = false;
  emit("update:show", value);
}

async function importField(field: SecretFieldDefinition, fileInfo: UploadFileInfo): Promise<boolean> {
  const file = fileInfo.file;
  if (!file) return false;
  if (file.size > MAX_IMPORTED_FIELD_BYTES) {
    emit("error", new Error("文件不能超过 60KB"));
    return false;
  }
  try {
    const content = await file.text();
    if (!content) throw new Error("文件内容为空");
    props.form.fields[field.id] = content;
    emit("imported", `已载入 ${file.name}`);
  } catch (value) {
    emit("error", value);
  }
  return false;
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="form.id ? '编辑密钥' : '新建密钥'"
    class="form-modal"
    :mask-closable="false"
    @update:show="close"
    @after-leave="attempted = false; emit('closed')"
  >
    <NForm class="editor-form" :model="form" label-placement="top" @submit.prevent="submit">
      <NGrid cols="1 820:2" responsive="self" :x-gap="16">
        <NFormItemGi label="名称" required :validation-status="attempted && !form.name.trim() ? 'error' : undefined" :feedback="attempted && !form.name.trim() ? '请输入名称' : undefined">
          <NInput v-model:value="form.name" maxlength="160" />
        </NFormItemGi>
        <NFormItemGi label="分类" required>
          <NCascader
            :value="form.category || null"
            :options="classificationOptions"
            check-strategy="child"
            filterable
            placeholder="选择大类 / 小类"
            @update:value="setCategory"
          />
        </NFormItemGi>
        <NFormItemGi label="服务商">
          <NSelect
            :value="form.provider || null"
            :options="providerOptions"
            filterable
            tag
            clearable
            placeholder="选择或直接输入"
            @update:value="setProvider"
          />
        </NFormItemGi>
        <NFormItemGi label="标签" span="1 820:2"><NInput v-model:value="form.tags" placeholder="使用逗号分隔" /></NFormItemGi>
      </NGrid>

      <NDivider title-placement="left">
        <NFlex align="baseline" :size="8">
          <NText strong>{{ template.name }}</NText>
          <NText depth="3">{{ template.description }}</NText>
        </NFlex>
      </NDivider>

      <NFlex vertical class="field-stack">
        <NFormItem
          v-for="field in visibleFields"
          :key="field.id"
          :label="field.label"
          :required="field.required"
          :validation-status="fieldError(field) ? 'error' : undefined"
          :feedback="fieldError(field)"
        >
          <NFlex class="field-editor" vertical :size="8">
            <MnemonicField
              v-if="field.kind === 'mnemonic'"
              v-model="form.fields[field.id]"
              @error="emit('error', $event)"
            />
            <NSelect
              v-else-if="field.options?.length"
              :value="form.fields[field.id] || null"
              :options="field.options"
              :placeholder="field.placeholder ?? '选择或直接输入'"
              filterable
              tag
              clearable
              @update:value="setFieldValue(field.id, $event)"
            />
            <NInput
              v-else
              v-model:value="form.fields[field.id]"
              :type="field.kind === 'textarea' ? 'textarea' : field.kind === 'password' ? 'password' : 'text'"
              :show-password-on="field.kind === 'password' ? 'click' : undefined"
              :input-props="field.kind === 'url' ? { type: 'url', inputmode: 'url' } : field.kind === 'number' ? { type: 'number', inputmode: 'decimal' } : undefined"
              :placeholder="field.placeholder"
              :autosize="field.kind === 'textarea' ? { minRows: 4, maxRows: 12 } : false"
              @change="form.type === 'database' && field.id === 'connectionString' ? emit('connectionChange') : undefined"
            />
            <NFlex v-if="field.uploadAccept || field.generate" justify="flex-end" :size="8">
              <NUpload
                v-if="field.uploadAccept"
                :show-file-list="false"
                :default-upload="false"
                :accept="field.uploadAccept"
                :max="1"
                @before-upload="({ file }) => importField(field, file)"
              >
                <NButton size="small" dashed>
                  <template #icon><NIcon><Upload /></NIcon></template>上传已有
                </NButton>
              </NUpload>
              <NButton v-if="field.generate" size="small" dashed @click="emit('generate', field.id)">
                <template #icon><NIcon><Sparkles /></NIcon></template>生成新的
              </NButton>
            </NFlex>
          </NFlex>
        </NFormItem>
      </NFlex>
      <NFormItem label="备注">
        <NInput v-model:value="form.notes" type="textarea" :autosize="{ minRows: 3, maxRows: 8 }" />
      </NFormItem>

      <NFlex class="form-footer" align="center" justify="space-between" :wrap="false">
        <NCheckbox v-model:checked="form.favorite">收藏</NCheckbox>
        <NButton type="primary" attr-type="submit" :loading="saving" :disabled="saving">
          <template #icon><NIcon><ShieldCheck /></NIcon></template>保存
        </NButton>
      </NFlex>
    </NForm>
  </NModal>
</template>
