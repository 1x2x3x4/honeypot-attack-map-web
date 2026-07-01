# 蜜罐攻击态势图

Vue 3 + TypeScript + Vite 实现的蜜罐攻击态势图前端。项目通过 REST 接口加载历史与统计数据，通过 WebSocket 接收实时攻击批次，并使用 Leaflet 与 ECharts 呈现地图、实时表格和 24 小时滚动统计。

## 技术栈

- Vue 3
- TypeScript
- Vite
- Pinia
- Leaflet
- ECharts
- Axios

## 目录结构

```text
src/
  api/attack-map/       # REST / WebSocket API 封装
  components/           # 地图、实时表格、统计面板等组件
  stores/attackStore.ts # 攻击事件状态源
  types/attack.ts       # 共享数据契约
  utils/                # 动画、协议、国家代码、时间窗口等工具
public/
  favicon.svg
```

## 环境变量

复制 `.env.example` 为本地环境文件，并按后端地址调整：

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_WS_URL=ws://127.0.0.1:8000/ws/attacks
VITE_ENABLE_WS=true
VITE_MAP_TILE_URL=
VITE_MAP_TILE_ATTRIBUTION=
```

本地 `.env`、`.env.local` 等文件不会提交到仓库。

## 开发命令

```powershell
npm install
npm run dev
npm run build
npm run preview
npm run test:unit
npm run test:e2e
```

完整校验：

```powershell
npm test
```

## API 契约

前端依赖以下后端接口：

```text
GET /api/attacks/latest
GET /api/attacks/map/aggregate
GET /api/stats/summary
GET /api/stats/top-ips
GET /api/stats/top-countries
WS  /ws/attacks
```

WebSocket 实时消息使用 `attack_batch`。底部统计面板与刷新逻辑基于滚动 24 小时数据。

## 构建说明

Vite 生产构建会按职责拆分主要 chunk：

- `vue`
- `leaflet`
- `echarts`
- `http`
- Attack Map 应用代码
