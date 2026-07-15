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
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 20px;
  overflow: hidden;
  box-shadow: var(--shadow);
  transition: box-shadow 0.2s;
}

.endpoint-card:hover {
  box-shadow: var(--shadow-lg);
}

.endpoint-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  user-select: none;
}

.method-tag {
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.method-tag.GET {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.method-tag.POST {
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}

.method-tag.DELETE {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.path {
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  flex: 1;
}

.summary {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.expand-icon {
  font-size: 12px;
  color: var(--text-secondary);
  transition: transform 0.2s;
}

.expand-icon.open {
  transform: rotate(180deg);
}

.endpoint-body {
  padding: 20px;
}

.auth-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 12px;
  margin-bottom: 12px;
}

.auth-badge.none {
  background: #f1f5f9;
  color: #64748b;
}

.auth-badge.admin {
  background: #fef3c7;
  color: #92400e;
}

.auth-badge.reviewer {
  background: #dbeafe;
  color: #1e40af;
}

.description {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.6;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin: 16px 0 8px;
}

.response-desc {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  color: var(--text);
  background: var(--code-bg);
  padding: 10px 14px;
  border-radius: 6px;
}

.notes {
  margin-top: 12px;
  padding: 10px 14px;
  background: #fefce8;
  border-radius: 6px;
  font-size: 13px;
  color: #854d0e;
  line-height: 1.5;
}
</style>
