<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { LogOut, Plus, RefreshCw, Search, ShieldCheck, SlidersHorizontal } from "@lucide/vue";
import {
  NButton, NCard, NConfigProvider, NDrawer, NDrawerContent, NFlex, NForm,
  NFormItem, NGlobalStyle, NH1, NIcon, NInput, NLayout, NLayoutHeader,
  NList, NListItem, NP, NResult, NSpin, NTag, NText, NThing,
  createDiscreteApi, zhCN, type GlobalThemeOverrides,
} from "naive-ui";
import { bytesToBase64Url } from "@shared/base64-url";
import { REQUIRED_SECRET_NAMES } from "@shared/config";
import { SECRET_TEMPLATES, TEMPLATE_BY_ID } from "@shared/templates";
import type { ItemInput, VaultItem, VaultItemPage, VaultSecretData } from "@shared/types";
import { api, ApiError } from "./api";
import BrandLockup from "./components/BrandLockup.vue";
import VaultDetailPane from "./components/VaultDetailPane.vue";
import VaultEditorModal from "./components/VaultEditorModal.vue";
import VaultListPane from "./components/VaultListPane.vue";
import { buildDatabaseConnectionString, parseDatabaseConnectionString } from "./database-connection";
import type { FormState, SessionState, ViewMode } from "./types";

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: "#11786d",
    primaryColorHover: "#0f6b61",
    primaryColorPressed: "#0a5f57",
    primaryColorSuppl: "#0f6b61",
    borderRadius: "6px",
    fontFamily: '"Inter Variable", Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  Button: { borderRadiusMedium: "6px", heightMedium: "40px" },
  Card: { borderRadius: "8px" },
  Input: { borderRadius: "6px", heightMedium: "42px" },
};
const discreteConfig = computed(() => ({ themeOverrides }));
const { message: uiMessage, dialog } = createDiscreteApi(["message", "dialog"], { configProviderProps: discreteConfig });

const session = ref<SessionState | null>(null);
const password = ref("");
const loginBusy = ref(false);
const items = ref<VaultItem[]>([]);
const selectedId = ref("");
const nextCursor = ref<string | null>(null);
const currentPage = ref(1);
const pageCursors = ref<(string | null)[]>([null]);
const loadingItems = ref(false);
const query = ref("");
const typeFilter = ref("");
const favoriteFilter = ref(false);
const trashFilter = ref(false);
const filtersOpen = ref(false);
const formOpen = ref(false);
const saving = ref(false);
const copiedField = ref("");
const secretData = ref<VaultSecretData | null>(null);
const secretItemId = ref("");
const secretLoading = ref(false);
const secretError = ref("");
let searchTimer: ReturnType<typeof setTimeout> | undefined;

const emptyForm = (): FormState => ({
  id: "", name: "", type: "generic", provider: "", category: "",
  tags: "", favorite: false, fields: {}, notes: "",
});
const form = reactive<FormState>(emptyForm());
const formTypeOptions = SECRET_TEMPLATES.map((template) => ({ label: template.name, value: template.id }));
const typeOptions = [{ label: "全部类型", value: "" }, ...formTypeOptions];

const selected = computed(() => items.value.find((item) => item.id === selectedId.value) ?? null);
const formTemplate = computed(() => TEMPLATE_BY_ID.get(form.type) ?? SECRET_TEMPLATES.at(-1)!);
const activeFilters = computed(() => Number(Boolean(typeFilter.value)) + Number(favoriteFilter.value) + Number(trashFilter.value));
const viewMode = computed<ViewMode>({
  get: () => trashFilter.value ? "trash" : favoriteFilter.value ? "favorites" : "all",
  set: (value) => {
    favoriteFilter.value = value === "favorites";
    trashFilter.value = value === "trash";
  },
});
const canSave = computed(() => Boolean(form.name.trim()) && formTemplate.value.fields
  .filter((field) => field.required)
  .every((field) => Boolean(form.fields[field.id]?.trim())));

function normalizeSession(value: unknown): SessionState {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const ready = record.ready === true;
  const required = Array.isArray(record.required)
    ? record.required.filter((name): name is string => typeof name === "string")
    : [...REQUIRED_SECRET_NAMES];
  const reportedMissing = Array.isArray(record.missing)
    ? record.missing.filter((name): name is string => typeof name === "string")
    : [];
  return {
    ready,
    required: required.length ? required : [...REQUIRED_SECRET_NAMES],
    missing: !ready && reportedMissing.length === 0 ? [...REQUIRED_SECRET_NAMES] : reportedMissing,
    authenticated: record.authenticated === true,
  };
}

function announce(text: string) { uiMessage.success(text, { duration: 2200 }); }
function showError(value: unknown) { uiMessage.error(value instanceof Error ? value.message : "操作失败", { duration: 4000 }); }
function readySession(authenticated: boolean): SessionState {
  return { ready: true, required: [...REQUIRED_SECRET_NAMES], missing: [], authenticated };
}

async function refreshSession() {
  session.value = normalizeSession(await api<unknown>("/api/auth/session"));
  if (session.value.authenticated) await reloadFirstPage();
}

async function login() {
  loginBusy.value = true;
  try {
    await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password: password.value }) });
    password.value = "";
    session.value = readySession(true);
    await reloadFirstPage();
  } catch (value) { showError(value); }
  finally { loginBusy.value = false; }
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  formOpen.value = false;
  clearSecretData();
  clearFormFields();
  items.value = [];
  selectedId.value = "";
  session.value = readySession(false);
}

function itemQuery(cursor?: string | null) {
  const params = new URLSearchParams();
  if (query.value.trim()) params.set("q", query.value.trim());
  if (typeFilter.value) params.set("type", typeFilter.value);
  if (favoriteFilter.value) params.set("favorite", "1");
  if (trashFilter.value) params.set("trash", "1");
  if (cursor) params.set("cursor", cursor);
  return `/api/items?${params}`;
}

function resetPagination() {
  currentPage.value = 1;
  pageCursors.value = [null];
  nextCursor.value = null;
}

async function loadItems(page = 1, cursor: string | null = pageCursors.value[page - 1] ?? null) {
  loadingItems.value = true;
  try {
    const result = await api<VaultItemPage>(itemQuery(cursor));
    items.value = result.items;
    currentPage.value = page;
    nextCursor.value = result.nextCursor;
    if (!items.value.some((item) => item.id === selectedId.value)) {
      clearSecretData();
      selectedId.value = "";
    }
    const selectedItem = items.value.find((item) => item.id === selectedId.value);
    if (selectedItem && !trashFilter.value) await loadSecretData(selectedItem);
    else if (!selectedItem || trashFilter.value) clearSecretData();
  } catch (value) {
    if (value instanceof ApiError && value.status === 401) return logout();
    showError(value);
  } finally {
    loadingItems.value = false;
  }
}

async function reloadFirstPage() {
  resetPagination();
  await loadItems(1, null);
}

async function nextPage() {
  if (!nextCursor.value) return;
  pageCursors.value[currentPage.value] = nextCursor.value;
  await loadItems(currentPage.value + 1, nextCursor.value);
}

async function previousPage() {
  if (currentPage.value <= 1) return;
  await loadItems(currentPage.value - 1, pageCursors.value[currentPage.value - 2] ?? null);
}

watch([query, typeFilter, favoriteFilter, trashFilter], () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => void reloadFirstPage(), 350);
});

function selectItem(item: VaultItem) {
  selectedId.value = item.id;
  if (trashFilter.value) clearSecretData();
  else void loadSecretData(item);
}

function resetForm() { Object.assign(form, emptyForm()); }
function openCreate() { resetForm(); formOpen.value = true; }
function tagsForSubmit(): string[] { return form.tags.split(/[,，]/).map((value) => value.trim()).filter(Boolean); }

function applyDatabaseConnectionString() {
  const raw = form.fields.connectionString?.trim();
  if (!raw || form.type !== "database") return;
  const parsed = parseDatabaseConnectionString(raw);
  for (const [key, value] of Object.entries(parsed)) if (value !== undefined) form.fields[key] = value;
  syncDatabaseConnectionString();
}

function syncDatabaseConnectionString() {
  if (form.type !== "database") return;
  const value = buildDatabaseConnectionString(form.fields);
  if (value) form.fields.connectionString = value;
}

function formPayload(): ItemInput {
  return {
    name: form.name, type: form.type, provider: form.provider, category: form.category,
    tags: tagsForSubmit(), favorite: form.favorite,
    secretData: { fields: { ...form.fields }, notes: form.notes },
  };
}

async function saveItem() {
  if (!canSave.value) return;
  syncDatabaseConnectionString();
  saving.value = true;
  try {
    if (form.id) {
      await api(`/api/items/${form.id}`, { method: "PUT", body: JSON.stringify(formPayload()) });
      announce("密钥已更新");
    } else {
      await api("/api/items", { method: "POST", body: JSON.stringify(formPayload()) });
      announce("密钥已创建");
    }
    formOpen.value = false;
    clearFormFields();
    clearSecretData();
    await reloadFirstPage();
  } catch (value) { showError(value); }
  finally { saving.value = false; }
}

function clearSecretData() {
  secretData.value = null;
  secretItemId.value = "";
  secretLoading.value = false;
  secretError.value = "";
  copiedField.value = "";
}

async function loadSecretData(item: VaultItem, force = false) {
  const itemId = item.id;
  if (!force && secretItemId.value === itemId && secretData.value) return;
  secretLoading.value = true;
  secretError.value = "";
  secretData.value = null;
  secretItemId.value = itemId;
  try {
    const result = await api<{ secretData: VaultSecretData }>(`/api/items/${itemId}/access`, { method: "POST" });
    if (selectedId.value === itemId) secretData.value = result.secretData;
  } catch (value) {
    if (value instanceof ApiError && value.status === 401) return logout();
    if (selectedId.value === itemId) secretError.value = value instanceof Error ? value.message : "密钥内容读取失败";
  } finally {
    if (selectedId.value === itemId) secretLoading.value = false;
  }
}

async function copyField(fieldId: string) {
  const value = secretData.value?.fields[fieldId];
  if (typeof value !== "string") return;
  try {
    await navigator.clipboard.writeText(value);
    copiedField.value = fieldId;
    window.setTimeout(() => { if (copiedField.value === fieldId) copiedField.value = ""; }, 1600);
    announce("已复制");
  } catch (value) { showError(value); }
}

async function openEdit(item: VaultItem) {
  if (secretItemId.value !== item.id || !secretData.value) await loadSecretData(item);
  if (!secretData.value || secretItemId.value !== item.id) return;
  Object.assign(form, {
    id: item.id, name: item.name, type: item.type, provider: item.provider,
    category: item.category, tags: item.tags.join(", "), favorite: item.favorite,
    fields: { ...secretData.value.fields }, notes: secretData.value.notes,
  });
  if (item.type === "database") applyDatabaseConnectionString();
  formOpen.value = true;
}

async function toggleFavorite(item: VaultItem) {
  try {
    await api(`/api/items/${item.id}/favorite`, { method: "PATCH", body: JSON.stringify({ favorite: !item.favorite }) });
    item.favorite = !item.favorite;
  } catch (value) { showError(value); }
}

function removeItem(item: VaultItem) {
  dialog.warning({
    title: trashFilter.value ? "永久删除密钥" : "移入回收站",
    content: trashFilter.value ? "删除后无法恢复。" : `确认将“${item.name}”移入回收站？`,
    positiveText: trashFilter.value ? "永久删除" : "移入回收站",
    negativeText: "取消",
    positiveButtonProps: { type: "error" },
    onPositiveClick: async () => {
      try {
        await api(trashFilter.value ? `/api/items/${item.id}/permanent` : `/api/items/${item.id}`, { method: "DELETE" });
        announce(trashFilter.value ? "密钥已永久删除" : "密钥已移入回收站");
        selectedId.value = "";
        await reloadFirstPage();
      } catch (value) { showError(value); }
    },
  });
}

async function restoreItem(item: VaultItem) {
  try {
    await api(`/api/items/${item.id}/restore`, { method: "POST" });
    announce("密钥已恢复");
    await reloadFirstPage();
  } catch (value) { showError(value); }
}

function generateField(fieldId: string) {
  form.fields[fieldId] = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  announce("已生成新的随机值");
}

function clearFormFields() { form.fields = {}; form.notes = ""; }
function chooseType(type: string) { typeFilter.value = type; trashFilter.value = false; filtersOpen.value = false; }
function closeDetail() { selectedId.value = ""; clearSecretData(); }

watch(() => form.type, () => {
  const valid = new Set(formTemplate.value.fields.map((field) => field.id));
  form.fields = Object.fromEntries(Object.entries(form.fields).filter(([key]) => valid.has(key)));
  syncDatabaseConnectionString();
});
watch(
  () => form.type === "database" ? [form.fields.engine, form.fields.host, form.fields.port, form.fields.database, form.fields.username, form.fields.password] : [],
  syncDatabaseConnectionString,
);

onMounted(() => { void refreshSession().catch(showError); });
onUnmounted(() => { window.clearTimeout(searchTimer); });
</script>

<template>
  <NConfigProvider :locale="zhCN" :theme-overrides="themeOverrides">
    <NGlobalStyle />
    <NLayout class="app-root">
      <NFlex v-if="!session" class="state-screen" vertical align="center" justify="center">
        <NSpin size="large" /><NText depth="3">正在读取部署状态</NText>
      </NFlex>

      <NFlex v-else-if="!session.ready" class="state-screen" vertical align="center" justify="center">
        <NCard class="setup-card" :bordered="false">
          <NResult status="warning" title="部署配置不完整" description="当前 Worker 运行版本的密钥配置检测结果">
            <template #footer>
              <NList bordered>
                <NListItem v-for="name in session.required" :key="name">
                  <NThing :title="name">
                    <template #header-extra>
                      <NTag :type="session.missing.includes(name) ? 'error' : 'success'" size="small">
                        {{ session.missing.includes(name) ? "未检测到" : "已检测到" }}
                      </NTag>
                    </template>
                  </NThing>
                </NListItem>
              </NList>
              <NFlex vertical align="center" class="setup-actions">
                <NText depth="3">这里只检查配置是否存在，不会读取密钥内容。</NText>
                <NButton type="primary" @click="refreshSession">
                  <template #icon><NIcon><RefreshCw /></NIcon></template>重新检查
                </NButton>
              </NFlex>
            </template>
          </NResult>
        </NCard>
      </NFlex>

      <NFlex v-else-if="!session.authenticated" class="login-screen" align="center" justify="center">
        <NFlex class="login-brand" vertical>
          <BrandLockup />
          <NH1>密钥管理器</NH1>
          <NP depth="3">集中管理部署密钥、证书和访问令牌。</NP>
        </NFlex>
        <NCard title="登录" class="login-card" :bordered="false">
          <NForm label-placement="top" @submit.prevent="login">
            <NFormItem label="管理员密码">
              <NInput v-model:value="password" type="password" show-password-on="click" autocomplete="current-password" autofocus />
            </NFormItem>
            <NButton block type="primary" attr-type="submit" :loading="loginBusy" :disabled="!password">
              <template #icon><NIcon><ShieldCheck /></NIcon></template>登录
            </NButton>
          </NForm>
        </NCard>
      </NFlex>

      <template v-else>
        <NLayoutHeader class="app-header" :class="{ 'detail-mode': selected }" bordered>
          <NFlex class="app-header-inner" align="center" :wrap="false">
            <BrandLockup compact />
            <NInput v-model:value="query" clearable placeholder="搜索名称或服务商" aria-label="搜索密钥">
              <template #prefix><NIcon><Search /></NIcon></template>
            </NInput>
            <NFlex class="header-actions" :wrap="false" :size="4">
              <NButton class="mobile-filter" quaternary circle title="筛选类型" @click="filtersOpen = true">
                <template #icon><NIcon><SlidersHorizontal /></NIcon></template>
              </NButton>
              <NButton quaternary circle title="退出登录" @click="logout">
                <template #icon><NIcon><LogOut /></NIcon></template>
              </NButton>
              <NButton type="primary" class="add-button" aria-label="新建" @click="openCreate">
                <template #icon><NIcon><Plus /></NIcon></template><NText class="add-label">新建</NText>
              </NButton>
            </NFlex>
          </NFlex>
        </NLayoutHeader>

        <NLayout class="workspace" has-sider :class="{ 'detail-active': selected }">
          <VaultListPane
            :items="items" :selected-id="selectedId" :loading="loadingItems"
            :query="query" :active-filters="activeFilters" :type-filter="typeFilter"
            :type-options="typeOptions" :view-mode="viewMode" :current-page="currentPage"
            :next-cursor="nextCursor"
            @update:type-filter="typeFilter = $event" @update:view-mode="viewMode = $event"
            @select="selectItem" @create="openCreate" @previous="previousPage" @next="nextPage"
          />
          <VaultDetailPane
            :selected="selected" :trash="trashFilter" :secret-data="secretData"
            :secret-loading="secretLoading" :secret-error="secretError" :copied-field="copiedField"
            @close="closeDetail" @favorite="toggleFavorite" @edit="openEdit"
            @restore="restoreItem" @remove="removeItem" @retry="loadSecretData($event, true)" @copy="copyField"
          />
        </NLayout>
      </template>

      <NDrawer v-model:show="filtersOpen" placement="bottom" height="70vh">
        <NDrawerContent title="类型筛选" closable>
          <NFlex vertical>
            <NButton
              v-for="option in typeOptions" :key="option.value" block
              :type="typeFilter === option.value ? 'primary' : 'default'"
              :secondary="typeFilter !== option.value" @click="chooseType(option.value)"
            >{{ option.label }}</NButton>
          </NFlex>
        </NDrawerContent>
      </NDrawer>

      <VaultEditorModal
        v-model:show="formOpen" :form="form" :template="formTemplate"
        :type-options="formTypeOptions" :saving="saving"
        @save="saveItem" @generate="generateField" @connection-change="applyDatabaseConnectionString"
        @imported="announce" @error="showError" @closed="clearFormFields"
      />
    </NLayout>
  </NConfigProvider>
</template>
