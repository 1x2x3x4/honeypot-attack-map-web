import { createRouter, createWebHistory } from 'vue-router'
import { attackMapRoutes } from './modules/attack-map'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/attack-map',
    },
    ...attackMapRoutes,
  ],
})

export default router
