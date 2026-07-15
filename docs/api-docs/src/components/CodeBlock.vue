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
  background: #1d1d1f;
  color: #f5f5f7;
  padding: 18px 22px;
  border-radius: var(--radius);
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
  overflow-x: auto;
  position: relative;
  margin: 10px 0 18px;
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
  top: 10px;
  right: 14px;
  background: rgba(255,255,255,0.08);
  border: none;
  color: rgba(255,255,255,0.5);
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.01em;
  transition: all 0.18s ease;
  z-index: 1;
}

.copy-btn:hover {
  background: rgba(255,255,255,0.16);
  color: rgba(255,255,255,0.9);
}

.copy-btn.copied {
  background: rgba(52,199,89,0.2);
  color: #34c759;
}
</style>
