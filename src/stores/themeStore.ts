import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'dark' | 'light'

const THEME_STORAGE_KEY = 'tpot-theme-mode'

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'dark' || value === 'light'
}

export const useThemeStore = defineStore('theme', () => {
  const themeMode = ref<ThemeMode>('dark')

  function applyTheme(mode: ThemeMode): void {
    document.documentElement.dataset.theme = mode
    document.documentElement.style.colorScheme = mode
  }

  function initTheme(): void {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    themeMode.value = isThemeMode(savedTheme) ? savedTheme : 'dark'
    applyTheme(themeMode.value)
  }

  function setThemeMode(mode: ThemeMode): void {
    themeMode.value = mode
    window.localStorage.setItem(THEME_STORAGE_KEY, mode)
    applyTheme(mode)
  }

  function toggleTheme(): void {
    setThemeMode(themeMode.value === 'dark' ? 'light' : 'dark')
  }

  return {
    themeMode,
    initTheme,
    setThemeMode,
    toggleTheme,
  }
})
