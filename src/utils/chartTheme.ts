export interface ChartThemeColors {
  accent: string
  accentArea: string
  axis: string
  border: string
  panel: string
  splitLine: string
  text: string
  muted: string
}

function readCssVariable(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  return styles.getPropertyValue(name).trim() || fallback
}

export function getChartThemeColors(): ChartThemeColors {
  const styles = window.getComputedStyle(document.documentElement)
  const accent = readCssVariable(styles, '--highlight-text', '#24d6ff')

  return {
    accent,
    accentArea: readCssVariable(styles, '--chart-accent-area', 'rgba(36, 214, 255, 0.12)'),
    axis: readCssVariable(styles, '--chart-axis', '#888888'),
    border: readCssVariable(styles, '--border-color', '#303030'),
    panel: readCssVariable(styles, '--bg-panel', '#191919'),
    splitLine: readCssVariable(styles, '--chart-grid-line', '#2d2d2d'),
    text: readCssVariable(styles, '--text-main', '#eeeeee'),
    muted: readCssVariable(styles, '--text-muted', '#9a9a9a'),
  }
}
