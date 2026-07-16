<template>
  <div class="endpoint-card">
    <div class="endpoint-header" @click="expanded = !expanded">
      <span class="method-tag" :class="endpoint.method">{{ endpoint.method }}</span>
      <span class="path">{{ endpoint.path }}</span>
      <span class="summary">{{ endpoint.summary }}</span>
      <span class="expand-icon" :class="{ open: expanded }">▼</span>
    </div>

    <div class="endpoint-body" v-show="expanded">
      <!-- 认证徽章 -->
      <span class="auth-badge" :class="endpoint.auth">{{ authLabel }}</span>

      <!-- 描述 -->
      <p class="description">{{ endpoint.description }}</p>

      <!-- 路径参数 -->
      <ParamTable
        v-if="endpoint.pathParams?.length"
        title="路径参数"
        :rows="endpoint.pathParams"
        col1-label="参数"
      />

      <!-- 查询参数 -->
      <ParamTable
        v-if="endpoint.queryParams?.length"
        title="查询参数"
        :rows="endpoint.queryParams"
        :show-required="true"
        col1-label="参数"
      />

      <!-- 请求体参数 -->
      <ParamTable
        v-if="endpoint.bodyParams?.length"
        title="请求体 (application/x-www-form-urlencoded)"
        :rows="endpoint.bodyParams"
        :show-required="true"
        :show-default="true"
        col1-label="参数"
      />

      <!-- 响应示例 -->
      <template v-if="endpoint.response">
        <h4 class="section-label">
          响应{{ endpoint.responseDesc ? ' · ' + endpoint.responseDesc : '' }}
        </h4>
        <CodeBlock :text="endpoint.response.content">
          {{ endpoint.response.content }}
        </CodeBlock>
      </template>

      <!-- 纯文本响应 -->
      <template v-else-if="endpoint.responseDesc">
        <h4 class="section-label">响应</h4>
        <p class="response-desc">{{ endpoint.responseDesc }}</p>
      </template>

      <!-- 响应字段说明 -->
      <ParamTable
        v-if="endpoint.responseFields?.length"
        title="响应字段说明"
        :rows="endpoint.responseFields"
        col1-label="字段"
      />

      <!-- 注意事项 -->
      <div v-if="endpoint.notes" class="notes">
        ⚠️ {{ endpoint.notes }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ParamTable from './ParamTable.vue'
import CodeBlock from './CodeBlock.vue'

const props = defineProps({
  endpoint: { type: Object, required: true },
  defaultExpanded: { type: Boolean, default: false },
})

const expanded = ref(props.defaultExpanded)

const authLabel = computed(() => {
  switch (props.endpoint.auth) {
    case 'none':
      return '无需认证'
    case 'admin':
      return '管理员 (≥2) 或局域网'
    case 'reviewer':
      return '审核员 (≥1) 或局域网'
    default:
      return ''
  }
})
</script>

<style scoped>
.endpoint-card {
  background: var(--card-bg);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  margin-bottom: 14px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition), transform var(--transition);
}

.endpoint-card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

.endpoint-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 22px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}

.endpoint-header:hover {
  background: rgba(0,0,0,0.015);
}

.method-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  flex-shrink: 0;
}

.method-tag.GET {
  background: rgba(52,199,89,0.1);
  color: #1b7a36;
}

.method-tag.POST {
  background: rgba(0,113,227,0.1);
  color: #005bbf;
}

.method-tag.DELETE {
  background: rgba(255,59,48,0.1);
  color: #c41e16;
}

.path {
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  flex: 1;
  letter-spacing: -0.01em;
}

.summary {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  font-weight: 400;
}

.expand-icon {
  font-size: 11px;
  color: var(--text-secondary);
  transition: transform 0.25s ease;
  opacity: 0.5;
  flex-shrink: 0;
}

.expand-icon.open {
  transform: rotate(180deg);
  opacity: 0.8;
}

.endpoint-body {
  padding: 6px 22px 22px;
}

.auth-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 12px;
  border-radius: 20px;
  margin-bottom: 14px;
  letter-spacing: 0.01em;
}

.auth-badge.none {
  background: #f5f5f7;
  color: var(--text-secondary);
}

.auth-badge.admin {
  background: #fff3e0;
  color: #b45309;
}

.auth-badge.reviewer {
  background: var(--accent-light);
  color: var(--accent);
}

.description {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.6;
  font-weight: 400;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 18px 0 10px;
}

.response-desc {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  color: var(--text);
  background: var(--code-bg);
  padding: 12px 16px;
  border-radius: var(--radius-sm);
}

.notes {
  margin-top: 16px;
  padding: 12px 16px;
  background: #fffbeb;
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: #92400e;
  line-height: 1.5;
  border: 1px solid #fef3c7;
}

@media (max-width: 768px) {
  .endpoint-card { margin-bottom: 10px; }
  .endpoint-header {
    padding: 14px 16px;
    gap: 10px;
    flex-wrap: wrap;
  }
  .method-tag { font-size: 10px; padding: 3px 9px; }
  .path { font-size: 13px; width: 100%; order: 1; }
  .summary { display: none; }
  .expand-icon { margin-left: auto; }
  .endpoint-body { padding: 6px 16px 16px; }
  .description { font-size: 13px; }
  .notes { font-size: 12px; padding: 10px 12px; }
}
</style>
