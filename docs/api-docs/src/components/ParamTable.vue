<template>
  <div>
    <h4 v-if="title">{{ title }}</h4>
    <table class="param-table">
      <thead>
        <tr>
          <th v-if="showRequired">参数</th>
          <th v-else>{{ col1Label }}</th>
          <th>类型</th>
          <th v-if="showRequired">必填</th>
          <th v-if="showDefault">默认值</th>
          <th>说明</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.name">
          <td><code>{{ row.name }}</code></td>
          <td><code>{{ row.type }}</code></td>
          <td v-if="showRequired">
            <span :class="row.required ? 'badge-required' : 'badge-optional'">
              {{ row.required ? '是' : '否' }}
            </span>
          </td>
          <td v-if="showDefault"><code>{{ row.default || '-' }}</code></td>
          <td>{{ row.desc }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  rows: { type: Array, required: true },
  showRequired: { type: Boolean, default: false },
  showDefault: { type: Boolean, default: false },
  col1Label: { type: String, default: '字段' },
})
</script>

<style scoped>
h4 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin: 16px 0 8px;
}

.param-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin: 8px 0 16px;
}

.param-table th {
  text-align: left;
  padding: 8px 12px;
  background: var(--code-bg);
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-bottom: 2px solid var(--border);
}

.param-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

.param-table td:first-child {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-weight: 600;
}

.param-table code {
  font-size: 12px;
  background: var(--code-bg);
  padding: 1px 6px;
  border-radius: 3px;
}

.badge-required {
  color: var(--danger);
  font-weight: 700;
  font-size: 12px;
}

.badge-optional {
  color: var(--text-secondary);
  font-style: italic;
  font-size: 12px;
}
</style>
