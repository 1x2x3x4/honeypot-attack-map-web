import type { RouteRecordRaw } from 'vue-router'
import AttackMapPage from '../../views/attack-map/index.vue'

export const attackMapRoutes: RouteRecordRaw[] = [
  {
    path: '/attack-map',
    name: 'attack-map',
    component: AttackMapPage,
    meta: {
      title: '攻击态势大屏',
    },
  },
]
