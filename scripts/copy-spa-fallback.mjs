import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const distDir = resolve(process.cwd(), 'dist')
const indexPath = resolve(distDir, 'index.html')
const fallbackPath = resolve(distDir, '404.html')

if (!existsSync(indexPath)) {
  throw new Error('Missing dist/index.html. Run vite build before copying the SPA fallback.')
}

copyFileSync(indexPath, fallbackPath)
