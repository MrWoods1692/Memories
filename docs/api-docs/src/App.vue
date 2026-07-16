<template>
  <!-- Mobile menu button -->
  <button class="mobile-menu-btn" @click="sidebarOpen = !sidebarOpen">☰</button>
  <div class="sidebar-overlay" :class="{ open: sidebarOpen }" @click="sidebarOpen = false"></div>

  <!-- Sidebar -->
  <Sidebar
    :is-open="sidebarOpen"
    :active-section="activeSection"
    :groups="endpointGroups"
    @navigate="handleNavigate"
    @close="sidebarOpen = false"
  />

  <!-- Main Content -->
  <main class="main-content" ref="mainRef">
    <ApiDocs />
  </main>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Sidebar from './components/Sidebar.vue'
import ApiDocs from './views/ApiDocs.vue'
import { endpointGroups, getAllEndpoints } from './data/apiEndpoints.js'

const sidebarOpen = ref(false)
const activeSection = ref('overview')
const mainRef = ref(null)

const allEndpoints = getAllEndpoints()

function handleNavigate(sectionId) {
  sidebarOpen.value = false
  activeSection.value = sectionId
  const el = document.getElementById(sectionId)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function onScroll() {
  const ids = ['overview', 'auth', ...allEndpoints.map(e => e.id), 'database']
  let current = 'overview'
  for (const id of ids) {
    const el = document.getElementById(id)
    if (el) {
      const rect = el.getBoundingClientRect()
      if (rect.top <= 120) current = id
    }
  }
  activeSection.value = current
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>
