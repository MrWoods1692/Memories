<template>
  <aside class="sidebar" :class="{ open: isOpen }">
    <div class="sidebar-header">
      <h1>Memories API</h1>
      <div class="version">v1.0 · REST API 参考</div>
    </div>
    <nav class="sidebar-nav">
      <!-- 概览 -->
      <div class="nav-group">
        <div class="nav-group-title">概览</div>
        <a
          class="nav-item"
          :class="{ active: activeSection === 'overview' }"
          @click="$emit('navigate', 'overview')"
        >
          <span class="nav-icon">📋</span>
          架构概述
        </a>
        <a
          class="nav-item"
          :class="{ active: activeSection === 'auth' }"
          @click="$emit('navigate', 'auth')"
        >
          <span class="nav-icon">🔐</span>
          认证与授权
        </a>
      </div>

      <!-- API 端点 -->
      <div class="nav-group">
        <div class="nav-group-title">API 端点</div>
        <template v-for="group in groups" :key="group.title">
          <div class="nav-subtitle">{{ group.icon }} {{ group.title }}</div>
          <a
            v-for="ep in group.endpoints"
            :key="ep.id"
            class="nav-item nav-endpoint"
            :class="{ active: activeSection === ep.id }"
            @click="$emit('navigate', ep.id)"
          >
            <span class="method-badge" :class="ep.method.toLowerCase()">{{ ep.method }}</span>
            <span class="ep-summary">{{ ep.summary }}</span>
          </a>
        </template>
      </div>

      <!-- 数据库 -->
      <div class="nav-group">
        <div class="nav-group-title">参考</div>
        <a
          class="nav-item"
          :class="{ active: activeSection === 'database' }"
          @click="$emit('navigate', 'database')"
        >
          <span class="nav-icon">🗄️</span>
          数据库表结构
        </a>
      </div>
    </nav>
  </aside>
</template>

<script setup>
import { getAllEndpoints } from '../data/apiEndpoints.js'

defineProps({
  isOpen: Boolean,
  activeSection: String,
  groups: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['navigate'])
</script>

<style scoped>
.sidebar {
  width: 270px;
  min-width: 270px;
  background: var(--blur-bg);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  color: var(--sidebar-text);
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  overflow-y: auto;
  z-index: 100;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-light);
  transition: transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.sidebar-header {
  padding: 28px 24px 20px;
  border-bottom: 1px solid var(--border-light);
}

.sidebar-header h1 {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.02em;
  margin: 0;
}

.sidebar-header .version {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-top: 3px;
}

.sidebar-nav {
  flex: 1;
  padding: 8px 0 24px;
}

.nav-group {
  margin-bottom: 4px;
}

.nav-group-title {
  padding: 12px 24px 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

.nav-subtitle {
  padding: 8px 24px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  opacity: 0.6;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 20px;
  margin: 1px 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.18s ease;
  border-radius: 8px;
  color: var(--sidebar-text);
  text-decoration: none;
  user-select: none;
}

.nav-item:hover {
  background: var(--sidebar-hover);
  color: var(--text);
}

.nav-item.active {
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 600;
}

.nav-endpoint {
  padding: 5px 20px;
  font-size: 12px;
}

.nav-icon {
  font-size: 15px;
  width: 20px;
  text-align: center;
}

.ep-summary {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.method-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  min-width: 36px;
  text-align: center;
  flex-shrink: 0;
  letter-spacing: 0.03em;
}

.method-badge.get {
  background: rgba(52,199,89,0.12);
  color: #248a3d;
}

.method-badge.post {
  background: rgba(0,113,227,0.1);
  color: #0066cc;
}

.method-badge.delete {
  background: rgba(255,59,48,0.1);
  color: #d63128;
}

.sidebar::-webkit-scrollbar { width: 3px; }
.sidebar::-webkit-scrollbar-track { background: transparent; }
.sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
  }
  .sidebar.open {
    transform: translateX(0);
  }
}
</style>
