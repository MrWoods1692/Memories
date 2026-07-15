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
  width: 280px;
  min-width: 280px;
  background: var(--sidebar-bg);
  color: var(--sidebar-text);
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  overflow-y: auto;
  z-index: 100;
  display: flex;
  flex-direction: column;
  transition: transform 0.25s;
}

.sidebar-header {
  padding: 24px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-header h1 {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.02em;
  margin: 0;
}

.sidebar-header .version {
  font-size: 12px;
  color: var(--sidebar-text);
  margin-top: 4px;
}

.sidebar-nav {
  flex: 1;
  padding: 12px 0;
}

.nav-group {
  margin-bottom: 4px;
}

.nav-group-title {
  padding: 8px 20px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}

.nav-subtitle {
  padding: 6px 20px 2px;
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 20px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
  border-left: 3px solid transparent;
  color: var(--sidebar-text);
  text-decoration: none;
  user-select: none;
}

.nav-item:hover {
  background: var(--sidebar-hover);
  color: #e2e8f0;
}

.nav-item.active {
  background: rgba(56, 189, 248, 0.1);
  color: var(--sidebar-active);
  border-left-color: var(--sidebar-active);
}

.nav-endpoint {
  padding: 5px 20px;
  font-size: 13px;
}

.nav-icon {
  font-size: 14px;
}

.ep-summary {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.method-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
  min-width: 38px;
  text-align: center;
  flex-shrink: 0;
}

.method-badge.get {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.method-badge.post {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.method-badge.delete {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.sidebar::-webkit-scrollbar {
  width: 4px;
}

.sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
  }
  .sidebar.open {
    transform: translateX(0);
  }
}
</style>
