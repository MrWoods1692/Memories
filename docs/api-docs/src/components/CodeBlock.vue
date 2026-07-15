<template>
  <div class="code-block">
    <button class="copy-btn" :class="{ copied }" @click="handleCopy">{{ copied ? '已复制!' : '复制' }}</button>
    <pre><code><slot /></code></pre>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  text: String,
})

const copied = ref(false)

function handleCopy() {
  const content = props.text || ''
  navigator.clipboard.writeText(content).then(() => {
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  })
}
</script>

<style scoped>
.code-block {
  background: #1e293b;
  color: #e2e8f0;
  padding: 14px 18px;
  border-radius: var(--radius);
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.65;
  overflow-x: auto;
  position: relative;
  margin: 8px 0 16px;
}

.code-block pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.code-block code {
  font-family: inherit;
}

.copy-btn {
  position: absolute;
  top: 8px;
  right: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #94a3b8;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
  z-index: 1;
}

.copy-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #e2e8f0;
}

.copy-btn.copied {
  color: #4ade80;
}
</style>
