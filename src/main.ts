import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'leaflet/dist/leaflet.css'
import App from './App.vue'
import router from './router'
import { useThemeStore } from './stores/themeStore'
import './styles/global.scss'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
useThemeStore(pinia).initTheme()
app.use(router)
app.mount('#app')
