<script setup lang="ts">
import { Check, Copy, Eye, EyeOff } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { mnemonicIssues, mnemonicWords } from "../mnemonic";

const props = defineProps<{ value?: string }>();
const emit = defineEmits<{
  copy: [];
  error: [value: unknown];
}>();

const words = computed(() => mnemonicWords(props.value));
const issues = computed(() => mnemonicIssues(words.value));
const revealed = ref(false);
const copiedWord = ref(-1);
const copiedAll = ref(false);

watch(() => props.value, () => { revealed.value = false; copiedWord.value = -1; copiedAll.value = false; });

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (value) {
    emit("error", value);
    return false;
  }
}

async function copyWord(index: number) {
  const word = words.value[index];
  if (!word) return;
  if (!(await copyText(word))) return;
  copiedWord.value = index;
  window.setTimeout(() => { if (copiedWord.value === index) copiedWord.value = -1; }, 1600);
}

async function copyEveryWord() {
  if (words.value.length === 0) return;
  if (!(await copyText(words.value.join(" ")))) return;
  copiedAll.value = true;
  emit("copy");
  window.setTimeout(() => { copiedAll.value = false; }, 1600);
}
</script>

<template>
  <div class="mnemonic-viewer">
    <template v-if="!revealed">
      <div class="mnemonic-masked">
        <span class="mnemonic-masked-text">{{ words.length }} 个单词已隐藏</span>
        <button type="button" class="mnemonic-action mnemonic-action--primary" @click="revealed = true">
          <Eye :size="14" />显示
        </button>
      </div>
    </template>
    <template v-else>
      <div class="mnemonic-words" role="group" :aria-label="`助记词，共 ${words.length} 个单词`">
        <button
          v-for="(word, index) in words"
          :key="`${index}-${word}`"
          type="button"
          class="mnemonic-word"
          :title="`复制第 ${index + 1} 个单词`"
          @click="copyWord(index)"
        >
          <span class="mnemonic-word-index" aria-hidden="true">{{ index + 1 }}</span>
          <span class="mnemonic-word-text">{{ word }}</span>
          <Check v-if="copiedWord === index" :size="14" class="mnemonic-word-icon" />
          <Copy v-else :size="14" class="mnemonic-word-icon" />
        </button>
      </div>
      <div class="mnemonic-meta">
        <span v-for="issue in issues" :key="issue" class="mnemonic-warning">{{ issue }}</span>
        <span v-if="copiedAll" class="mnemonic-ok">已复制全部</span>
      </div>
      <div class="mnemonic-actions">
        <button type="button" class="mnemonic-action" @click="revealed = false"><EyeOff :size="14" />隐藏</button>
        <button type="button" class="mnemonic-action" @click="copyEveryWord"><Copy :size="14" />复制全部</button>
      </div>
    </template>
  </div>
</template>
