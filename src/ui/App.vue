<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import {
  ArrowLeft, Check, ClipboardCheck, Copy, Eye, EyeOff, FileClock, KeyRound, LockKeyhole,
  LogOut, Pencil, Plus, RefreshCw, RotateCcw, Search, ShieldCheck, SlidersHorizontal,
  Sparkles, Star, Trash2, X,
} from "@lucide/vue";
import { SECRET_TEMPLATES, TEMPLATE_BY_ID } from "@shared/templates";
import type { AuditEvent, AuditPage, ItemInput, VaultItem, VaultItemPage, VaultSecretData } from "@shared/types";
import { api, ApiError } from "./api";

type SessionState = { ready: boolean; missing: string[]; authenticated: boolean };
type FormState = {
  id: string;
  name: string;
  type: string;
  provider: string;
  category: string;
  tags: string;
  favorite: boolean;
  fields: Record<string, string>;
  notes: string;
};

const session = ref<SessionState | null>(null);
const password = ref("");
const loginBusy = ref(false);
const message = ref("");
const error = ref("");
const items = ref<VaultItem[]>([]);
const selectedId = ref("");
const nextCursor = ref<string | null>(null);
const loadingItems = ref(false);
const loadingMore = ref(false);
const query = ref("");
const typeFilter = ref("");
const favoriteFilter = ref(false);
const trashFilter = ref(false);
const filtersOpen = ref(false);
const formOpen = ref(false);
const unlockOpen = ref(false);
const auditOpen = ref(false);
const revealOpen = ref(false);
const revealField = ref("");
const revealValue = ref("");
const unlockPassword = ref("");
const unlockBusy = ref(false);
const saving = ref(false);
const auditEvents = ref<AuditEvent[]>([]);
const auditCursor = ref<string | null>(null);
const auditBusy = ref(false);
const copiedField = ref("");
const pendingAction = ref<null | (() => Promise<void>)>(null);
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let revealTimer: ReturnType<typeof setTimeout> | undefined;

const emptyForm = (): FormState => ({
  id: "",
  name: "",
  type: "generic",
  provider: "",
  category: "",
  tags: "",
  favorite: false,
  fields: {},
  notes: "",
});
const form = reactive<FormState>(emptyForm());

const selected = computed(() => items.value.find((item) => item.id === selectedId.value) ?? null);
const selectedTemplate = computed(() => selected.value ? TEMPLATE_BY_ID.get(selected.value.type) : undefined);
const formTemplate = computed(() => TEMPLATE_BY_ID.get(form.type) ?? SECRET_TEMPLATES.at(-1)!);
const activeFilters = computed(() => Number(Boolean(typeFilter.value)) + Number(favoriteFilter.value) + Number(trashFilter.value));

function announce(text: string) {
  message.value = text;
  window.setTimeout(() => { if (message.value === text) message.value = ""; }, 2400);
}

function showError(value: unknown) {
  error.value = value instanceof Error ? value.message : "操作失败";
  window.setTimeout(() => { error.value = ""; }, 4000);
}

async function refreshSession() {
  session.value = await api<SessionState>("/api/auth/session");
  if (session.value.authenticated) await loadItems(false);
}

async function login() {
  loginBusy.value = true;
  error.value = "";
  try {
    await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password: password.value }) });
    password.value = "";
    session.value = { ready: true, missing: [], authenticated: true };
    await loadItems(false);
  } catch (value) {
    showError(value);
  } finally {
    loginBusy.value = false;
  }
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  formOpen.value = false;
  clearSensitiveState(true);
  items.value = [];
  selectedId.value = "";
  session.value = { ready: true, missing: [], authenticated: false };
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

async function loadItems(append: boolean) {
  if (append && !nextCursor.value) return;
  append ? (loadingMore.value = true) : (loadingItems.value = true);
  try {
    const page = await api<VaultItemPage>(itemQuery(append ? nextCursor.value : null));
    items.value = append ? [...items.value, ...page.items] : page.items;
    nextCursor.value = page.nextCursor;
    if (!append && !items.value.some((item) => item.id === selectedId.value)) {
      selectedId.value = window.matchMedia("(max-width: 820px)").matches ? "" : (items.value[0]?.id ?? "");
    }
  } catch (value) {
    if (value instanceof ApiError && value.status === 401) return logout();
    showError(value);
  } finally {
    loadingItems.value = false;
    loadingMore.value = false;
  }
}

watch([query, typeFilter, favoriteFilter, trashFilter], () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => void loadItems(false), 350);
});

function selectItem(item: VaultItem) {
  selectedId.value = item.id;
  clearSensitiveState();
}

function resetForm() {
  Object.assign(form, emptyForm());
}

function openCreate() {
  resetForm();
  formOpen.value = true;
}

function tagsForSubmit(): string[] {
  return form.tags.split(/[,，]/).map((value) => value.trim()).filter(Boolean);
}

function formPayload(includeSecret: boolean): ItemInput {
  return {
    name: form.name,
    type: form.type,
    provider: form.provider,
    category: form.category,
    tags: tagsForSubmit(),
    favorite: form.favorite,
    ...(includeSecret ? { secretData: { fields: { ...form.fields }, notes: form.notes } } : {}),
  };
}

async function saveItem() {
  saving.value = true;
  try {
    if (form.id) {
      await api(`/api/items/${form.id}`, { method: "PUT", body: JSON.stringify(formPayload(true)) });
      announce("密钥已更新");
    } else {
      await api("/api/items", { method: "POST", body: JSON.stringify(formPayload(true)) });
      announce("密钥已创建");
    }
    formOpen.value = false;
    clearSensitiveState();
    await loadItems(false);
  } catch (value) {
    showError(value);
  } finally {
    saving.value = false;
  }
}

async function runUnlocked(action: () => Promise<void>) {
  try {
    await action();
  } catch (value) {
    if (value instanceof ApiError && value.code === "UNLOCK_REQUIRED") {
      pendingAction.value = action;
      unlockOpen.value = true;
      await nextTick();
      document.querySelector<HTMLInputElement>("#unlock-password")?.focus();
      return;
    }
    showError(value);
  }
}

async function unlock() {
  unlockBusy.value = true;
  try {
    await api("/api/auth/unlock", { method: "POST", body: JSON.stringify({ password: unlockPassword.value }) });
    unlockPassword.value = "";
    unlockOpen.value = false;
    const action = pendingAction.value;
    pendingAction.value = null;
    if (action) await action();
  } catch (value) {
    showError(value);
  } finally {
    unlockBusy.value = false;
  }
}

async function lockVault() {
  await api("/api/auth/lock", { method: "POST" }).catch(() => undefined);
  formOpen.value = false;
  clearSensitiveState(true);
  announce("保险库已锁定");
}

function strictConfirmation(item: VaultItem): boolean {
  if (!TEMPLATE_BY_ID.get(item.type)?.strict) return true;
  return window.confirm("该条目包含高风险恢复短语。确认在当前环境中访问？");
}

async function accessField(item: VaultItem, fieldId: string, mode: "copy" | "reveal") {
  if (!strictConfirmation(item)) return;
  await runUnlocked(async () => {
    const result = await api<{ value: string }>(`/api/items/${item.id}/access`, {
      method: "POST",
      body: JSON.stringify({ fieldId, purpose: "copy", confirm: TEMPLATE_BY_ID.get(item.type)?.strict === true }),
    });
    if (mode === "copy") {
      await navigator.clipboard.writeText(result.value);
      copiedField.value = fieldId;
      window.setTimeout(() => { if (copiedField.value === fieldId) copiedField.value = ""; }, 1600);
      announce("已复制");
    } else {
      revealField.value = fieldId;
      revealValue.value = result.value;
      revealOpen.value = true;
      window.clearTimeout(revealTimer);
      revealTimer = window.setTimeout(clearSensitiveState, 30_000);
    }
  });
}

async function copyRevealed() {
  try {
    await navigator.clipboard.writeText(revealValue.value);
    announce("已复制");
  } catch (value) {
    showError(value);
  }
}

async function openEdit(item: VaultItem) {
  if (!strictConfirmation(item)) return;
  await runUnlocked(async () => {
    const result = await api<{ secretData: VaultSecretData }>(`/api/items/${item.id}/access`, {
      method: "POST",
      body: JSON.stringify({ purpose: "edit", confirm: TEMPLATE_BY_ID.get(item.type)?.strict === true }),
    });
    Object.assign(form, {
      id: item.id,
      name: item.name,
      type: item.type,
      provider: item.provider,
      category: item.category,
      tags: item.tags.join(", "),
      favorite: item.favorite,
      fields: { ...result.secretData.fields },
      notes: result.secretData.notes,
    });
    formOpen.value = true;
  });
}

async function toggleFavorite(item: VaultItem) {
  try {
    await api(`/api/items/${item.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: item.name,
        type: item.type,
        provider: item.provider,
        category: item.category,
        tags: item.tags,
        favorite: !item.favorite,
      }),
    });
    item.favorite = !item.favorite;
  } catch (value) {
    showError(value);
  }
}

async function removeItem(item: VaultItem) {
  if (!window.confirm(trashFilter.value ? "永久删除后无法恢复，确认继续？" : "将此密钥移入回收站？")) return;
  try {
    await api(trashFilter.value ? `/api/items/${item.id}/permanent` : `/api/items/${item.id}`, { method: "DELETE" });
    announce(trashFilter.value ? "密钥已永久删除" : "密钥已移入回收站");
    selectedId.value = "";
    await loadItems(false);
  } catch (value) {
    showError(value);
  }
}

async function restoreItem(item: VaultItem) {
  try {
    await api(`/api/items/${item.id}/restore`, { method: "POST" });
    announce("密钥已恢复");
    await loadItems(false);
  } catch (value) {
    showError(value);
  }
}

async function loadAudit(append = false) {
  auditBusy.value = true;
  try {
    const page = await api<AuditPage>(`/api/audit${append && auditCursor.value ? `?cursor=${encodeURIComponent(auditCursor.value)}` : ""}`);
    auditEvents.value = append ? [...auditEvents.value, ...page.events] : page.events;
    auditCursor.value = page.nextCursor;
    auditOpen.value = true;
  } catch (value) {
    showError(value);
  } finally {
    auditBusy.value = false;
  }
}

function generateField(fieldId: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  form.fields[fieldId] = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function clearSensitiveState(forceForm = false) {
  revealValue.value = "";
  revealField.value = "";
  revealOpen.value = false;
  copiedField.value = "";
  window.clearTimeout(revealTimer);
  if (forceForm || !formOpen.value) {
    form.fields = {};
    form.notes = "";
  }
}

function handleVisibility() {
  if (document.hidden && session.value?.authenticated) void lockVault();
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(value);
}

function auditLabel(action: string) {
  return ({
    ITEM_CREATED: "创建密钥",
    ITEM_UPDATED: "更新密钥",
    ITEM_DELETED: "移入回收站",
    ITEM_RESTORED: "恢复密钥",
    ITEM_PURGED: "永久删除",
    SECRET_ACCESS: "访问秘密字段",
    SECRET_EDIT_OPEN: "打开秘密编辑",
  } as Record<string, string>)[action] ?? action;
}

watch(() => form.type, () => {
  const valid = new Set(formTemplate.value.fields.map((field) => field.id));
  form.fields = Object.fromEntries(Object.entries(form.fields).filter(([key]) => valid.has(key)));
});

onMounted(() => {
  void refreshSession().catch(showError);
  document.addEventListener("visibilitychange", handleVisibility);
});

onUnmounted(() => {
  document.removeEventListener("visibilitychange", handleVisibility);
  window.clearTimeout(searchTimer);
  window.clearTimeout(revealTimer);
});
</script>

<template>
  <div class="aurora-shell">
    <div class="mesh-layer" aria-hidden="true"></div>

    <main v-if="!session" class="loading-screen" aria-live="polite">
      <RefreshCw class="spin" />
      <span>正在读取部署状态</span>
    </main>

    <main v-else-if="!session.ready" class="setup-screen">
      <div class="brand-mark"><KeyRound /></div>
      <h1>部署配置不完整</h1>
      <p>请在 Worker 中配置以下 Secret，然后重新部署。</p>
      <div class="missing-list">
        <code v-for="name in session.missing" :key="name">{{ name }}</code>
      </div>
      <button class="primary-button" type="button" @click="refreshSession"><RefreshCw />重新检查</button>
    </main>

    <main v-else-if="!session.authenticated" class="login-screen">
      <section class="login-copy">
        <div class="brand-lockup"><span class="brand-mark"><KeyRound /></span><span>CFKey</span></div>
        <h1>密钥管理器</h1>
        <p>搜索、整理和按需访问部署凭据。</p>
      </section>
      <form class="login-form" @submit.prevent="login">
        <label for="login-password">管理员密码</label>
        <input id="login-password" v-model="password" type="password" autocomplete="current-password" required autofocus />
        <button class="primary-button" :disabled="loginBusy || !password" type="submit">
          <ShieldCheck />{{ loginBusy ? "登录中" : "登录" }}
        </button>
      </form>
    </main>

    <template v-else>
      <header class="app-header">
        <div class="brand-lockup compact"><span class="brand-mark"><KeyRound /></span><span>CFKey</span></div>
        <div class="header-search">
          <Search />
          <input v-model="query" type="search" placeholder="按名称或服务商前缀搜索" aria-label="搜索密钥" />
          <button v-if="query" class="icon-button" type="button" title="清除搜索" @click="query = ''"><X /></button>
        </div>
        <div class="header-actions">
          <button class="icon-button mobile-filter" type="button" title="筛选" @click="filtersOpen = true">
            <SlidersHorizontal /><span v-if="activeFilters" class="counter">{{ activeFilters }}</span>
          </button>
          <button class="icon-button" type="button" title="审计记录" @click="loadAudit(false)"><FileClock /></button>
          <button class="icon-button" type="button" title="锁定保险库" @click="lockVault"><LockKeyhole /></button>
          <button class="icon-button" type="button" title="退出" @click="logout"><LogOut /></button>
          <button class="primary-button add-button" type="button" @click="openCreate"><Plus />新建</button>
        </div>
      </header>

      <main class="workspace" :class="{ 'detail-active': selected }">
        <aside class="filter-rail" :class="{ open: filtersOpen }">
          <div class="mobile-sheet-head"><strong>筛选</strong><button class="icon-button" @click="filtersOpen = false"><X /></button></div>
          <button class="filter-option" :class="{ active: !typeFilter && !favoriteFilter && !trashFilter }" @click="typeFilter = ''; favoriteFilter = false; trashFilter = false; filtersOpen = false">全部密钥</button>
          <button class="filter-option" :class="{ active: favoriteFilter }" @click="favoriteFilter = !favoriteFilter; trashFilter = false; filtersOpen = false"><Star />收藏</button>
          <div class="rail-label">类型</div>
          <button v-for="template in SECRET_TEMPLATES" :key="template.id" class="filter-option" :class="{ active: typeFilter === template.id }" @click="typeFilter = typeFilter === template.id ? '' : template.id; trashFilter = false; filtersOpen = false">
            {{ template.name }}
          </button>
          <div class="rail-spacer"></div>
          <button class="filter-option danger" :class="{ active: trashFilter }" @click="trashFilter = !trashFilter; filtersOpen = false"><Trash2 />回收站</button>
        </aside>
        <div v-if="filtersOpen" class="sheet-backdrop" @click="filtersOpen = false"></div>

        <section class="item-pane">
          <div class="pane-heading">
            <div><span class="pane-index">01</span><h2>{{ trashFilter ? "回收站" : "密钥" }}</h2></div>
            <span>{{ items.length }} 条</span>
          </div>
          <div v-if="loadingItems" class="loading-block"><RefreshCw class="spin" />正在读取</div>
          <div v-else-if="!items.length" class="empty-state">
            <KeyRound />
            <strong>{{ query || activeFilters ? "没有符合条件的密钥" : "尚未保存密钥" }}</strong>
            <button v-if="!trashFilter && !query && !activeFilters" class="secondary-button" @click="openCreate"><Plus />新建密钥</button>
          </div>
          <div v-else class="item-list">
            <button v-for="(item, index) in items" :key="item.id" class="item-row" :class="{ selected: selectedId === item.id }" @click="selectItem(item)">
              <span class="row-number">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="row-content">
                <span class="row-title"><strong>{{ item.name }}</strong><Star v-if="item.favorite" class="favorite-icon" /></span>
                <span class="row-meta">{{ TEMPLATE_BY_ID.get(item.type)?.name || item.type }}<template v-if="item.provider"> · {{ item.provider }}</template></span>
                <span v-if="item.tags.length" class="tag-line"><span v-for="tag in item.tags.slice(0, 3)" :key="tag">{{ tag }}</span></span>
              </span>
              <span class="row-date">{{ formatDate(item.updatedAt) }}</span>
            </button>
            <button v-if="nextCursor" class="load-more" :disabled="loadingMore" @click="loadItems(true)">{{ loadingMore ? "读取中" : "加载更多" }}</button>
          </div>
        </section>

        <section class="detail-pane">
          <div v-if="!selected" class="empty-detail"><Sparkles /><span>选择一条密钥查看详情</span></div>
          <template v-else>
            <header class="detail-header">
              <button class="icon-button mobile-back" title="返回列表" @click="selectedId = ''"><ArrowLeft /></button>
              <div class="spectral-rail" aria-hidden="true"></div>
              <div class="detail-title">
                <span class="pane-index">02</span>
                <h2>{{ selected.name }}</h2>
                <p>{{ selectedTemplate?.description }}</p>
              </div>
              <div class="detail-actions">
                <button class="icon-button" :title="selected.favorite ? '取消收藏' : '收藏'" @click="toggleFavorite(selected)"><Star :class="{ filled: selected.favorite }" /></button>
                <button v-if="!trashFilter" class="icon-button" title="编辑" @click="openEdit(selected)"><Pencil /></button>
                <button v-if="trashFilter" class="icon-button" title="恢复" @click="restoreItem(selected)"><RotateCcw /></button>
                <button class="icon-button danger" :title="trashFilter ? '永久删除' : '移入回收站'" @click="removeItem(selected)"><Trash2 /></button>
              </div>
            </header>

            <div class="metadata-band">
              <div><span>类型</span><strong>{{ selectedTemplate?.name || selected.type }}</strong></div>
              <div><span>服务商</span><strong>{{ selected.provider || "未填写" }}</strong></div>
              <div><span>分类</span><strong>{{ selected.category || "未分类" }}</strong></div>
              <div><span>更新时间</span><strong>{{ formatDate(selected.updatedAt) }}</strong></div>
            </div>

            <div class="secret-section">
              <div class="section-heading"><span class="pane-index">03</span><h3>秘密字段</h3><LockKeyhole /></div>
              <div class="secret-fields">
                <div v-for="field in selectedTemplate?.fields" :key="field.id" class="secret-field">
                  <div><span>{{ field.label }}</span><code>••••••••••••</code></div>
                  <div class="field-actions">
                    <button class="icon-button" type="button" :title="`显示${field.label}`" @click="accessField(selected, field.id, 'reveal')"><Eye /></button>
                    <button v-if="field.copyable" class="icon-button" type="button" :title="`复制${field.label}`" @click="accessField(selected, field.id, 'copy')">
                      <Check v-if="copiedField === field.id" /><Copy v-else />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="selected.tags.length" class="detail-tags"><span v-for="tag in selected.tags" :key="tag">{{ tag }}</span></div>
          </template>
        </section>
      </main>
    </template>

    <div class="toast-stack" aria-live="polite">
      <div v-if="message" class="toast success"><ClipboardCheck />{{ message }}</div>
      <div v-if="error" class="toast error"><X />{{ error }}</div>
    </div>

    <div v-if="formOpen" class="modal-backdrop" @mousedown.self="formOpen = false; clearSensitiveState()">
      <section class="modal form-modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <header><div><span class="pane-index">04</span><h2 id="form-title">{{ form.id ? "编辑密钥" : "新建密钥" }}</h2></div><button class="icon-button" @click="formOpen = false; clearSensitiveState()"><X /></button></header>
        <form @submit.prevent="saveItem">
          <div class="form-grid metadata-form">
            <label><span>名称</span><input v-model="form.name" required maxlength="160" /></label>
            <label><span>类型</span><select v-model="form.type" :disabled="Boolean(form.id)"><option v-for="template in SECRET_TEMPLATES" :key="template.id" :value="template.id">{{ template.name }}</option></select></label>
            <label><span>服务商</span><input v-model="form.provider" maxlength="120" /></label>
            <label><span>分类</span><input v-model="form.category" maxlength="80" /></label>
            <label class="wide"><span>标签</span><input v-model="form.tags" placeholder="使用逗号分隔" /></label>
          </div>
          <div class="form-divider"><span>{{ formTemplate.name }}</span><small>{{ formTemplate.description }}</small></div>
          <div class="form-grid secret-form">
            <label v-for="field in formTemplate.fields" :key="field.id" :class="{ wide: field.kind === 'textarea' }">
              <span>{{ field.label }}</span>
              <div class="input-action">
                <textarea v-if="field.kind === 'textarea'" v-model="form.fields[field.id]" :required="field.required" rows="4"></textarea>
                <input v-else v-model="form.fields[field.id]" :type="field.kind === 'password' ? 'password' : field.kind" :required="field.required" autocomplete="off" />
                <button v-if="field.sensitive" class="icon-button" type="button" :title="`生成${field.label}`" @click="generateField(field.id)"><Sparkles /></button>
              </div>
            </label>
            <label class="wide"><span>备注</span><textarea v-model="form.notes" rows="3"></textarea></label>
          </div>
          <footer><label class="checkbox-label"><input v-model="form.favorite" type="checkbox" />收藏</label><button class="primary-button" type="submit" :disabled="saving || !form.name"><ShieldCheck />{{ saving ? "保存中" : "保存" }}</button></footer>
        </form>
      </section>
    </div>

    <div v-if="unlockOpen" class="modal-backdrop" @mousedown.self="unlockOpen = false; pendingAction = null">
      <section class="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="unlock-title">
        <header><div><span class="pane-index">05</span><h2 id="unlock-title">解锁保险库</h2></div><button class="icon-button" @click="unlockOpen = false; pendingAction = null"><X /></button></header>
        <form @submit.prevent="unlock">
          <label><span>管理员密码</span><input id="unlock-password" v-model="unlockPassword" type="password" autocomplete="current-password" required /></label>
          <p>解锁状态持续 5 分钟；切换到其他页面后立即锁定。</p>
          <button class="primary-button" type="submit" :disabled="unlockBusy || !unlockPassword"><LockKeyhole />{{ unlockBusy ? "验证中" : "解锁" }}</button>
        </form>
      </section>
    </div>

    <div v-if="revealOpen" class="modal-backdrop" @mousedown.self="clearSensitiveState()">
      <section class="modal compact-modal reveal-modal" role="dialog" aria-modal="true">
        <header><div><span class="pane-index">06</span><h2>{{ selectedTemplate?.fields.find((field) => field.id === revealField)?.label }}</h2></div><button class="icon-button" @click="clearSensitiveState()"><EyeOff /></button></header>
        <pre>{{ revealValue }}</pre>
        <button class="primary-button" @click="copyRevealed"><Copy />复制</button>
      </section>
    </div>

    <div v-if="auditOpen" class="modal-backdrop" @mousedown.self="auditOpen = false">
      <section class="modal audit-modal" role="dialog" aria-modal="true" aria-labelledby="audit-title">
        <header><div><span class="pane-index">07</span><h2 id="audit-title">审计记录</h2></div><button class="icon-button" @click="auditOpen = false"><X /></button></header>
        <div v-if="auditBusy && !auditEvents.length" class="loading-block"><RefreshCw class="spin" />正在读取</div>
        <div v-else-if="!auditEvents.length" class="empty-state"><FileClock /><strong>暂无审计记录</strong></div>
        <div v-else class="audit-list">
          <div v-for="event in auditEvents" :key="event.id" class="audit-row">
            <span>{{ formatDate(event.createdAt) }}</span>
            <strong>{{ auditLabel(event.action) }}</strong>
            <span>{{ event.itemName || "系统" }}</span>
            <code v-if="event.detail">{{ event.detail }}</code>
          </div>
          <button v-if="auditCursor" class="load-more" :disabled="auditBusy" @click="loadAudit(true)">{{ auditBusy ? "读取中" : "加载更多" }}</button>
        </div>
      </section>
    </div>
  </div>
</template>
