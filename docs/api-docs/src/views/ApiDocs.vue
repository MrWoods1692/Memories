<template>
  <div>
    <!-- 架构概述 -->
    <section id="overview" class="section">
      <h2 class="section-title"><IconLayout :size="28" /> 架构概述</h2>
      <p class="section-desc">
        Memories 是一个运行在 Android 设备上的图片分享与管理平台，内嵌两个基于
        <strong>NanoHTTPD</strong> 的 HTTP 服务器。
      </p>

      <div class="intro-grid">
        <div class="intro-card">
          <div class="icon"><IconServer :size="28" /></div>
          <h3>API 服务器</h3>
          <p>端口 <code>8080</code>，REST API，<strong>允许外网访问 + 跨域</strong></p>
        </div>
        <div class="intro-card">
          <div class="icon"><IconBox :size="28" /></div>
          <h3>管理面板</h3>
          <p>端口 <code>8081</code>，React 管理界面，<strong>仅限局域网访问</strong></p>
        </div>
        <div class="intro-card">
          <div class="icon"><IconGlobe :size="28" /></div>
          <h3>CORS 跨域支持</h3>
          <p>API 服务器对所有响应自动添加 CORS 头，允许任意来源调用</p>
        </div>
        <div class="intro-card">
          <div class="icon"><IconDatabase :size="28" /></div>
          <h3>SQLite 存储</h3>
          <p>4 张表：images、users、config、banned_users</p>
        </div>
      </div>

      <div class="info-card">
        <h3>基础 URL</h3>
        <CodeBlock text="http://<设备局域网IP>:8080" lang="plain" />

        <h3>通用约定</h3>
        <ul class="convention-list">
          <li>POST 请求使用 <code>application/x-www-form-urlencoded</code> 编码</li>
          <li>响应为 <code>application/json</code> 或 <code>text/plain</code></li>
          <li><strong>API 服务器 (8080)</strong>：允许外网访问，所有响应自动添加 CORS 头</li>
          <li><strong>管理面板 (8081)</strong>：仅限局域网访问（10.x / 172.16-31.x / 192.168.x / 127.x），外网不可访问</li>
          <li>局域网用户自动获得管理员权限</li>
        </ul>
      </div>
    </section>

    <!-- 认证与授权 -->
    <section id="auth" class="section">
      <h2 class="section-title"><IconLock :size="28" /> 认证与授权</h2>

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

        <h3>网络访问策略</h3>
        <table class="simple-table">
          <thead>
            <tr><th>服务</th><th>端口</th><th>跨域 (CORS)</th><th>外网访问</th><th>局域网访问</th></tr>
          </thead>
          <tbody>
            <tr><td>API 服务器</td><td><code>8080</code></td><td><span class="check-mark">✓</span> 允许</td><td><span class="check-mark">✓</span> 允许</td><td><span class="check-mark">✓</span> 允许</td></tr>
            <tr><td>管理面板</td><td><code>8081</code></td><td>—</td><td><span class="cross-mark">✗</span> 禁止</td><td><span class="check-mark">✓</span> 允许</td></tr>
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
      <h2 class="section-title">
        <component :is="group.icon" :size="28" />
        {{ group.title }}
      </h2>
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
      <h2 class="section-title"><IconDatabase :size="28" /> 数据库表结构</h2>
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
          <CodeBlock :text="tbl.sql" lang="sql" />
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
import IconServer from '../components/icons/IconServer.vue'
import IconBox from '../components/icons/IconBox.vue'
import IconGlobe from '../components/icons/IconGlobe.vue'
import IconDatabase from '../components/icons/IconDatabase.vue'
import IconLayout from '../components/icons/IconLayout.vue'
import IconLock from '../components/icons/IconLock.vue'
import IconImage from '../components/icons/IconImage.vue'
import IconUser from '../components/icons/IconUser.vue'
import IconBan from '../components/icons/IconBan.vue'
import IconSettings from '../components/icons/IconSettings.vue'
import IconChart from '../components/icons/IconChart.vue'
import IconCloud from '../components/icons/IconCloud.vue'
import IconTag from '../components/icons/IconTag.vue'
import IconCode from '../components/icons/IconCode.vue'
import IconKey from '../components/icons/IconKey.vue'
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
  margin-bottom: 56px;
  scroll-margin-top: 32px;
}

.section-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 6px;
  letter-spacing: -0.025em;
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-title :deep(svg) {
  stroke: var(--accent);
  flex-shrink: 0;
}

.check-mark { color: var(--success); font-weight: 700; }
.cross-mark { color: var(--danger); font-weight: 700; }

.intro-card .icon {
  color: var(--accent);
  margin-bottom: 10px;
}

.intro-card .icon :deep(svg) {
  stroke: var(--accent);
}

.section-desc {
  color: var(--text-secondary);
  margin-bottom: 28px;
  font-size: 15px;
  line-height: 1.55;
  font-weight: 400;
}

.section-desc code {
  background: var(--code-bg);
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 13px;
}

.intro-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 14px;
  margin-bottom: 32px;
}

.intro-card {
  background: var(--card-bg);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition), transform var(--transition);
}

.intro-card:hover {
  box-shadow: var(--shadow);
  transform: translateY(-2px);
}

.intro-card .icon {
  font-size: 28px;
  margin-bottom: 10px;
}

.intro-card h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 5px;
  color: var(--text);
  letter-spacing: -0.01em;
}

.intro-card p {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.intro-card code {
  background: var(--code-bg);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.info-card {
  background: var(--card-bg);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 18px;
}

.info-card h3 {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 20px 0 10px;
}

.info-card h3:first-child {
  margin-top: 0;
}

.convention-list {
  margin: 0 0 18px 22px;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.9;
}

.convention-list code {
  background: var(--code-bg);
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
}

.simple-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  margin: 10px 0 18px;
}

.simple-table th {
  text-align: left;
  padding: 11px 16px;
  background: var(--code-bg);
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 2px solid var(--border-light);
}

.simple-table td {
  padding: 11px 16px;
  border-bottom: 1px solid var(--border-light);
  vertical-align: top;
}

.simple-table tr:last-child td {
  border-bottom: none;
}

.simple-table code {
  background: var(--code-bg);
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 13px;
  font-weight: 500;
}

/* Database cards */
.db-card {
  margin-bottom: 14px;
  overflow: hidden;
}

.db-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 24px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}

.db-header:hover {
  background: rgba(0,0,0,0.015);
}

.db-name {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: -0.01em;
}

.db-desc {
  color: var(--text-secondary);
  font-size: 13px;
  flex: 1;
  font-weight: 400;
}

.expand-icon {
  font-size: 11px;
  color: var(--text-secondary);
  transition: transform 0.25s ease;
  opacity: 0.5;
}

.expand-icon.open {
  transform: rotate(180deg);
  opacity: 0.8;
}

.db-body {
  padding: 4px 24px 24px;
}

/* ===== Mobile ===== */
@media (max-width: 768px) {
  .section { margin-bottom: 40px; }
  .section-title { font-size: 22px; gap: 8px; }
  .section-desc { font-size: 14px; margin-bottom: 20px; }

  .intro-grid {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .intro-card { padding: 18px; }
  .intro-card h3 { font-size: 14px; }
  .intro-card p { font-size: 12px; }
  .intro-card .icon { margin-bottom: 6px; }
  .intro-card .icon :deep(svg) { width: 22px; height: 22px; }

  .info-card { padding: 18px; margin-bottom: 14px; }
  .info-card h3 { font-size: 11px; margin: 14px 0 8px; }

  .simple-table { font-size: 12px; }
  .simple-table th, .simple-table td { padding: 8px 10px; }

  .convention-list { font-size: 13px; margin-left: 18px; }
  .convention-list code { font-size: 11px; }

  .db-header { padding: 14px 18px; }
  .db-name { font-size: 14px; }
  .db-body { padding: 4px 16px 18px; }
}

@media (max-width: 480px) {
  .section { margin-bottom: 32px; }
  .section-title { font-size: 19px; gap: 6px; }
  .section-title :deep(svg) { width: 22px; height: 22px; }

  .intro-grid { grid-template-columns: 1fr; gap: 8px; }
  .intro-card { padding: 16px; }

  .info-card { padding: 14px; margin-bottom: 10px; }
  .info-card h3 { font-size: 10px; }

  .simple-table { font-size: 11px; }
  .simple-table th, .simple-table td { padding: 6px 8px; }
  .simple-table code { font-size: 11px; padding: 1px 5px; }

  .db-header { padding: 12px 14px; gap: 8px; }
}
</style>
