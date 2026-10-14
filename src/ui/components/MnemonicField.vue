<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { mnemonicCellCount, mnemonicIssues, mnemonicWords, normalizeMnemonic } from "../mnemonic";

const props = defineProps<{ modelValue?: string; disabled?: boolean }>();
const emit = defineEmits<{
  "update:modelValue": [value: string];
  error: [value: unknown];
}>();

const local = ref<string[]>(mnemonicWords(props.modelValue));
const cellRefs = ref<HTMLInputElement[]>([]);

watch(() => props.modelValue, (value) => {
  if (normalizeMnemonic(value) === normalizeMnemonic(local.value.join(" "))) return;
  local.value = mnemonicWords(value);
});

const cells = computed(() => mnemonicCellCount(local.value.length));
const allWords = computed(() => local.value.filter(Boolean));
const issues = computed(() => mnemonicIssues(allWords.value));

function commit(next: string[]) {
  local.value = next.map((word) => word.trim()).filter(Boolean);
  emit("update:modelValue", local.value.join(" "));
}

function focusCell(index: number) {
  void nextTick(() => {
    const target = cellRefs.value[Math.min(Math.max(index, 0), cells.value - 1)];
    if (!target) return;
    target.focus();
    const end = target.value.length;
    target.setSelectionRange(end, end);
  });
}

function setCell(index: number, raw: string) {
  const tokens = mnemonicWords(raw);
  if (tokens.length > 1) {
    commit(tokens);
    focusCell(tokens.length);
    return;
  }
  const next = [...local.value];
  while (next.length <= index) next.push("");
  next[index] = tokens[0] ?? "";
  commit(next);
}

function onInput(index: number, event: Event) {
  setCell(index, (event.target as HTMLInputElement).value);
}

function onKeydown(index: number, event: KeyboardEvent) {
  if (event.isComposing) return;
  const input = event.target as HTMLInputElement;
  if (event.key === "Tab" && !event.shiftKey && index < cells.value - 1) {
    event.preventDefault();
    focusCell(index + 1);
    return;
  }
  if (event.key === "Tab" && event.shiftKey && index > 0) {
    event.preventDefault();
    focusCell(index - 1);
    return;
  }
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    focusCell(index + 1);
    return;
  }
  if (event.key === "Backspace" && input.value === "" && index > 0) {
    event.preventDefault();
    focusCell(index - 1);
    return;
  }
  if (event.key === "ArrowLeft" && (input.selectionStart ?? 0) === 0 && index > 0) {
    event.preventDefault();
    focusCell(index - 1);
    return;
  }
  if (event.key === "ArrowRight" && (input.selectionStart ?? 0) === input.value.length && index < cells.value - 1) {
    event.preventDefault();
    focusCell(index + 1);
  }
}

function onPaste(index: number, event: ClipboardEvent) {
  event.preventDefault();
  const tokens = mnemonicWords(event.clipboardData?.getData("text") ?? "");
  if (tokens.length === 0) return;
  if (tokens.length > 1) {
    commit(tokens);
    focusCell(tokens.length);
    return;
  }
  setCell(index, tokens[0]);
}

async function pasteFromClipboard() {
  try {
    const tokens = mnemonicWords(await navigator.clipboard.readText());
    if (tokens.length > 0) commit(tokens);
  } catch (value) {
    emit("error", value);
  }
}

function clearAll() {
  commit([]);
  focusCell(0);
}
</script>

<template>
  <div class="mnemonic-field">
    <div class="mnemonic-grid" role="group" :aria-label="`助记词，共 ${allWords.length} 个单词`">
      <label
        v-for="index in cells"
        :key="index"
        class="mnemonic-cell"
        :class="{ 'has-word': Boolean(local[index - 1]) }"
      >
        <span class="mnemonic-index" aria-hidden="true">{{ index }}</span>
        <input
          ref="cellRefs"
          class="mnemonic-input"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :disabled="disabled"
          :value="local[index - 1] ?? ''"
          :aria-label="`第 ${index} 个单词`"
          @input="onInput(index - 1, $event)"
          @keydown="onKeydown(index - 1, $event)"
          @paste="onPaste(index - 1, $event)"
        />
      </label>
    </div>
    <div class="mnemonic-meta">
      <span class="mnemonic-count">{{ allWords.length }} 个单词</span>
      <span v-for="issue in issues" :key="issue" class="mnemonic-warning">{{ issue }}</span>
    </div>
    <div class="mnemonic-actions">
      <button type="button" class="mnemonic-action" :disabled="disabled" @click="pasteFromClipboard">粘贴</button>
      <button type="button" class="mnemonic-action" :disabled="disabled || !allWords.length" @click="clearAll">清空</button>
    </div>
  </div>
</template>
