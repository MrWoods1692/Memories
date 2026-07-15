<template>
  <div>
    <!-- 架构概述 -->
    <section id="overview" class="section">
      <h2 class="section-title">📋 架构概述</h2>
      <p class="section-desc">
        Memories 是一个运行在 Android 设备上的图片分享与管理平台，内嵌两个基于
        <strong>NanoHTTPD</strong> 的 HTTP 服务器。
      </p>

      <div class="intro-grid">
        <div class="intro-card">
          <div class="icon">🖥️</div>
          <h3>API 服务器</h3>
          <p>端口 <code>8080</code>，处理所有 REST API 请求</p>
        </div>
        <div class="intro-card">
          <div class="icon">📦</div>
          <h3>管理面板</h3>
          <p>端口 <code>8081</code>，提供 React 管理界面静态文件</p>
        </div>
        <div class="intro-card">
          <div class="icon">🔒</div>
          <h3>局域网安全</h3>
          <p>只接受局域网请求，自动 CORS 支持</p>
        </div>
        <div class="intro-card">
          <div class="icon">🗄️</div>
          <h3>SQLite 存储</h3>
          <p>4 张表：images、users、config、banned_users</p>
        </div>
      </div>

      <div class="info-card">
        <h3>基础 URL</h3>
        <CodeBlock text="http://<设备局域网IP>:8080">http://<span style="color:#fde68a">&lt;设备局域网IP&gt;</span>:8080</CodeBlock>

        <h3>通用约定</h3>
        <ul class="convention-list">
          <li>POST 请求使用 <code>application/x-www-form-urlencoded</code> 编码</li>
          <li>响应为 <code>application/json</code> 或 <code>text/plain</code></li>
          <li>所有响应自动添加 CORS 头，允许跨端口调用</li>
          <li>局域网用户自动获得管理员权限</li>
        </ul>
      </div>
    </section>

    <!-- 认证与授权 -->
    <section id="auth" class="section">
      <h2 class="section-title">🔐 认证与授权</h2>

      <div class="info-card">
        <h3>角色体系</h3>
        <table class="simple-table">
          <thead>
            <tr><th>角色值</th><th>名称</th><th>权限</th></tr>
          </thead>
          <tbody>
            <tr><td><code>0</code></td><td>未注册用户</td><td>仅可上传图片</td></tr>
            <tr><td><code>1</code></td><td>审核员 (Reviewer)</td><td>审核图片（通过/拒绝）</td></tr>
            <tr><td><code>2</code></td><td>管理员 (Admin)</td><td>审核图片 + 管理用户 + 封禁管理 + 修改配置</td></tr>
          </tbody>
        </table>

        <h3>认证方式</h3>
        <ul class="convention-list">
          <li><strong>局域网自动授权</strong>：来自局域网的请求自动获得管理员权限</li>
          <li><strong>Header 认证</strong>：通过 <code>x-user-qq</code> 请求头传递 QQ 号，后端查用户表确定角色</li>
        </ul>

        <h3>权限矩阵</h3>
        <table class="simple-table">
          <thead>
            <tr><th>端点</th><th>方法</th><th>所需角色</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in authMatrix" :key="row.endpoint + row.method">
              <td><code>{{ row.endpoint }}</code></td>
              <td>{{ row.method }}</td>
              <td>{{ row.role }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- API 端点分组 -->
    <section v-for="group in groups" :key="group.title" :id="'group-' + group.title" class="section">
      <h2 class="section-title">{{ group.icon }} {{ group.title }}</h2>
      <p class="section-desc">{{ group.desc }}</p>
      <EndpointCard
        v-for="ep in group.endpoints"
        :key="ep.id"
        :id="ep.id"
        :endpoint="ep"
        :default-expanded="ep.id === 'health'"
      />
    </section>

    <!-- 数据库表结构 -->
    <section id="database" class="section">
      <h2 class="section-title">🗄️ 数据库表结构</h2>
      <p class="section-desc">
        Memories 使用 SQLite 数据库 <code>memories.db</code>，包含以下 4 张表。
      </p>

      <div v-for="tbl in tables" :key="tbl.name" class="info-card db-card">
        <div class="db-header" @click="toggleTable(tbl.name)">
          <span class="db-name">{{ tbl.name }}</span>
          <span class="db-desc">{{ tbl.desc }}</span>
          <span class="expand-icon" :class="{ open: expandedTables[tbl.name] }">▼</span>
        </div>
        <div class="db-body" v-show="expandedTables[tbl.name]">
          <CodeBlock :text="tbl.sql">{{ tbl.sql }}</CodeBlock>
          <ParamTable title="字段说明" :rows="tbl.columns" col1-label="列" />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import EndpointCard from '../components/EndpointCard.vue'
import CodeBlock from '../components/CodeBlock.vue'
import ParamTable from '../components/ParamTable.vue'
import { endpointGroups, databaseTables, authMatrix } from '../data/apiEndpoints.js'

defineProps({
  groups: { type: Array, default: () => endpointGroups },
  tables: { type: Array, default: () => databaseTables },
})

const expandedTables = reactive({})

function toggleTable(name) {
  expandedTables[name] = !expandedTables[name]
}
</script>

<style scoped>
.section {
  margin-bottom: 48px;
  scroll-margin-top: 24px;
}

.section-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 8px;
  letter-spacing: -0.02em;
}

.section-desc {
  color: var(--text-secondary);
  margin-bottom: 24px;
  font-size: 15px;
  line-height: 1.6;
}

.section-desc code {
  background: var(--code-bg);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 13px;
}

.intro-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.intro-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: var(--shadow);
}

.intro-card .icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.intro-card h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 4px;
}

.intro-card p {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.intro-card code {
  background: var(--code-bg);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
}

.info-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: var(--shadow);
  margin-bottom: 20px;
}

.info-card h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin: 16px 0 8px;
}

.info-card h3:first-child {
  margin-top: 0;
}

.convention-list {
  margin: 0 0 16px 20px;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.convention-list code {
  background: var(--code-bg);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 13px;
}

.simple-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  margin: 8px 0 16px;
}

.simple-table th {
  text-align: left;
  padding: 10px 14px;
  background: var(--code-bg);
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-bottom: 2px solid var(--border);
}

.simple-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

.simple-table code {
  background: var(--code-bg);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 13px;
}

/* Database cards */
.db-card {
  margin-bottom: 16px;
  overflow: hidden;
}

.db-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--border);
}

.db-header:hover {
  background: var(--code-bg);
}

.db-name {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-weight: 700;
  font-size: 15px;
}

.db-desc {
  color: var(--text-secondary);
  font-size: 13px;
  flex: 1;
}

.expand-icon {
  font-size: 12px;
  color: var(--text-secondary);
  transition: transform 0.2s;
}

.expand-icon.open {
  transform: rotate(180deg);
}

.db-body {
  padding: 20px;
}
</style>
