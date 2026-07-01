// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Attack Map build chunks', () => {
  it('contains responsibility-specific output chunks', () => {
    const files = readdirSync(resolve('dist/assets/js'))

    for (const prefix of ['attack-map-', 'vue-', 'leaflet-', 'echarts-', 'http-']) {
      expect(files.some((file) => file.startsWith(prefix))).toBe(true)
    }
  })
})
