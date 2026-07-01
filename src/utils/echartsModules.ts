import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts'
import { GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import { init, graphic, use, type ECharts } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
])

export { graphic, init }
export type { ECharts }
