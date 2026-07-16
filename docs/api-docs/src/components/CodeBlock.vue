<template>
  <div class="code-block">
    <div class="code-header">
      <div class="dots">
        <span class="dot dot-red"></span>
        <span class="dot dot-yellow"></span>
        <span class="dot dot-green"></span>
      </div>
      <span class="code-lang">{{ langLabel }}</span>
      <button class="copy-btn" :class="{ copied }" @click="handleCopy">
        <svg v-if="!copied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
    </div>
    <pre><code v-html="highlightedCode"></code></pre>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  text: String,
  lang: { type: String, default: 'json' },
})

const copied = ref(false)

const langLabel = computed(() => {
  return props.lang === 'json' ? 'JSON' : props.lang.toUpperCase()
})

function handleCopy() {
  const content = props.text || ''
  navigator.clipboard.writeText(content).then(() => {
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  })
}

function highlightJson(code) {
  if (!code) return ''
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"((?:[^"\\]|\\.)*)"/g, '<span class="hl-str">"$1"</span>')
    .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="hl-num">$1</span>')
    .replace(/\b(true|false)\b/g, '<span class="hl-bool">$1</span>')
    .replace(/\b(null)\b/g, '<span class="hl-null">$1</span>')
    .replace(/<span class="hl-str">"([^"]+)"<\/span>\s*:/g, '<span class="hl-key">"$1"</span>:')
}

const highlightedCode = computed(() => {
  if (props.lang === 'json') return highlightJson(props.text || '')
  const t = props.text || ''
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
})
</script>

<style scoped>
.code-block {
  background: #1d1d1f;
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin: 10px 0 18px;
  box-shadow: var(--shadow-lg);
}

.code-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #2a2a2d;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  user-select: none;
}

.dots {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}

.dot-red { background: #ff5f57; }
.dot-yellow { background: #febc2e; }
.dot-green { background: #28c840; }

.code-lang {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255,255,255,0.35);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex: 1;
  text-align: center;
  margin-right: 28px;
}

.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 28px;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.3);
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.18s ease;
  flex-shrink: 0;
}

.copy-btn:hover {
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.7);
}

.copy-btn.copied {
  color: #28c840;
}

.code-block pre {
  margin: 0;
  padding: 16px 20px;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
  color: #f5f5f7;
  overflow-x: auto;
}

.code-block code {
  font-family: inherit;
}

:deep(.hl-key) { color: #79c0ff; }
:deep(.hl-str) { color: #a5d6ff; }
:deep(.hl-num) { color: #ffab70; }
:deep(.hl-bool) { color: #d2a8ff; }
:deep(.hl-null) { color: #8b949e; }

@media (max-width: 768px) {
  .code-block { margin: 8px 0 14px; border-radius: var(--radius); }
  .code-header { padding: 8px 12px; }
  .dot { width: 9px; height: 9px; }
  .code-lang { font-size: 10px; }
  .code-block pre { padding: 12px 14px; font-size: 12px; line-height: 1.6; }
}

@media (max-width: 480px) {
  .code-block pre { padding: 10px 12px; font-size: 11px; }
  .code-header { padding: 7px 10px; }
  .dots { gap: 4px; }
  .dot { width: 8px; height: 8px; }
}
</style>
