import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const distDir = resolve(process.cwd(), 'dist')
const docsDir = resolve(process.cwd(), 'docs')

if (!existsSync(resolve(distDir, 'index.html'))) {
  throw new Error('Missing dist/index.html. Run npm run build:github-pages first.')
}

rmSync(docsDir, { recursive: true, force: true })
cpSync(distDir, docsDir, { recursive: true })
writeFileSync(resolve(docsDir, '.nojekyll'), '')
