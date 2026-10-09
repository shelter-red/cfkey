<script setup lang="ts">
import { KeyRound } from "@lucide/vue";
import { NFlex, NIcon, NText } from "naive-ui";

defineProps<{ compact?: boolean }>();
</script>

<template>
  <NFlex align="center" :size="12" class="brand-lockup" :class="{ compact }" :wrap="false">
    <NIcon class="brand-mark" :size="23"><KeyRound /></NIcon>
    <NText strong class="brand-name">CFKey</NText>
  </NFlex>
</template>
