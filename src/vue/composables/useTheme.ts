import { computed, onBeforeUnmount, onMounted, reactive } from 'vue';

type ThemeKind = 'light' | 'dark' | 'high-contrast';

interface ThemePalette {
  surface: string;
  surfaceAlt: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  accent: string;
  accentHover: string;
  link: string;
  muted: string;
  success: string;
  warning: string;
  danger: string;
  scrollbar: string;
  shadow: string;
  fontFamily: string;
}

const paletteDefaults: Record<ThemeKind, ThemePalette> = {
  light: {
    surface: '#ffffff',
    surfaceAlt: '#f6f8fa',
    surfaceMuted: '#eaeef2',
    border: '#d0d7de',
    borderStrong: '#afb8c1',
    textPrimary: '#24292f',
    textSecondary: '#57606a',
    textTertiary: '#6e7781',
    textInverse: '#0d1117',
    accent: '#007acc',
    accentHover: '#005fa3',
    link: '#0969da',
    muted: 'rgba(0, 0, 0, 0.45)',
    success: '#2da44e',
    warning: '#bf8700',
    danger: '#cf222e',
    scrollbar: 'rgba(66, 66, 66, 0.35)',
    shadow: 'rgba(15, 23, 42, 0.24)',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  dark: {
    surface: '#1e1e1e',
    surfaceAlt: '#252526',
    surfaceMuted: '#2d2d2d',
    border: '#3c3c3c',
    borderStrong: '#5a5a5a',
    textPrimary: '#d4d4d4',
    textSecondary: '#9da5b4',
    textTertiary: 'rgba(212, 212, 212, 0.7)',
    textInverse: '#0d1117',
    accent: '#32B7BC',
    accentHover: '#41cad0',
    link: '#75beff',
    muted: 'rgba(255, 255, 255, 0.45)',
    success: '#4ec9b0',
    warning: '#d7ba7d',
    danger: '#f7768e',
    scrollbar: 'rgba(255, 255, 255, 0.25)',
    shadow: 'rgba(0, 0, 0, 0.35)',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  'high-contrast': {
    surface: '#000000',
    surfaceAlt: '#111111',
    surfaceMuted: '#1a1a1a',
    border: '#ffffff',
    borderStrong: '#ffffff',
    textPrimary: '#ffffff',
    textSecondary: '#d0d0d0',
    textTertiary: '#bfbfbf',
    textInverse: '#000000',
    accent: '#ffcc00',
    accentHover: '#ffd633',
    link: '#40a9ff',
    muted: 'rgba(255, 255, 255, 0.65)',
    success: '#61d345',
    warning: '#f0a732',
    danger: '#ff6464',
    scrollbar: 'rgba(255, 255, 255, 0.5)',
    shadow: 'rgba(0, 0, 0, 0.7)',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
};

const themeState = reactive({
  kind: 'dark' as ThemeKind,
  palette: { ...paletteDefaults.dark },
});

let initialized = false;
let observer: MutationObserver | null = null;

function readCssVar(variable: string, fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const styles = getComputedStyle(document.documentElement);
  const value = styles.getPropertyValue(variable).trim();
  if (value) {
    return value;
  }
  const bodyValue = getComputedStyle(document.body).getPropertyValue(variable).trim();
  return bodyValue || fallback;
}

function colorMix(base: string, mixWith: string, weight: number): string {
  const clamped = Math.min(1, Math.max(0, weight));
  const percent = Math.round(clamped * 100);
  return `color-mix(in srgb, ${base} ${percent}%, ${mixWith})`;
}

function detectThemeKind(): ThemeKind {
  if (typeof document === 'undefined') {
    return 'light';
  }
  const classList = document.body.classList;
  if ([...classList].some(cls => cls.includes('high-contrast'))) {
    return 'high-contrast';
  }
  if (classList.contains('vscode-light')) {
    return 'light';
  }
  if (classList.contains('vscode-dark')) {
    return 'dark';
  }
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

function mapThemeKind(input?: string): ThemeKind {
  if (!input) {
    return detectThemeKind();
  }
  if (input.includes('high') || input.includes('contrast')) {
    return 'high-contrast';
  }
  if (input.includes('light')) {
    return 'light';
  }
  return 'dark';
}

function buildPalette(kind: ThemeKind): ThemePalette {
  const base = { ...paletteDefaults[kind] };
  const overrides: Array<[keyof ThemePalette, string]> = [
    ['surface', '--vscode-editor-background'],
    ['surfaceAlt', '--vscode-sideBar-background'],
    ['surfaceMuted', '--vscode-input-background'],
    ['border', '--vscode-panel-border'],
    ['textPrimary', '--vscode-editor-foreground'],
    ['textSecondary', '--vscode-descriptionForeground'],
    ['textTertiary', '--vscode-disabledForeground'],
    ['accent', '--vscode-button-background'],
    ['accentHover', '--vscode-button-hoverBackground'],
    ['link', '--vscode-textLink-foreground'],
    ['success', '--vscode-testing-iconPassed'],
    ['warning', '--vscode-testing-iconQueued'],
    ['danger', '--vscode-testing-iconFailed'],
    ['scrollbar', '--vscode-scrollbarSlider-background'],
    ['shadow', '--vscode-widget-shadow'],
  ];

  for (const [key, cssVar] of overrides) {
    const value = readCssVar(cssVar, base[key]);
    if (value) {
      base[key] = value;
    }
  }

  base.borderStrong = colorMix(base.border, base.textPrimary, 0.35);
  base.accentHover = readCssVar('--vscode-button-hoverBackground', base.accentHover);
  base.fontFamily = readCssVar('--vscode-editor-font-family', base.fontFamily);
  return base;
}

function applyCssVariables(palette: ThemePalette, kind: ThemeKind) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const rtVars: Record<string, string> = {
    '--rt-font-family': palette.fontFamily,
    '--rt-surface': palette.surface,
    '--rt-surface-alt': palette.surfaceAlt,
    '--rt-surface-muted': palette.surfaceMuted,
    '--rt-border': palette.border,
    '--rt-border-strong': palette.borderStrong,
    '--rt-text-primary': palette.textPrimary,
    '--rt-text-secondary': palette.textSecondary,
    '--rt-text-tertiary': palette.textTertiary,
    '--rt-text-inverse': palette.textInverse,
    '--rt-link': palette.link,
    '--rt-muted': palette.muted,
    '--rt-accent': palette.accent,
    '--rt-accent-hover': palette.accentHover,
    '--rt-danger': palette.danger,
    '--rt-warning': palette.warning,
    '--rt-success': palette.success,
    '--rt-scrollbar': palette.scrollbar,
    '--rt-shadow': palette.shadow,
  };

  const elVars: Record<string, string> = {
    '--el-bg-color': palette.surface,
    '--el-bg-color-page': palette.surface,
    '--el-bg-color-overlay': palette.surfaceAlt,
    '--el-fill-color': palette.surfaceAlt,
    '--el-fill-color-light': palette.surfaceMuted,
    '--el-fill-color-lighter': palette.surfaceMuted,
    '--el-fill-color-blank': palette.surface,
    '--el-color-primary': palette.accent,
    '--el-color-primary-light-3': colorMix(palette.accent, '#ffffff', 0.7),
    '--el-color-primary-light-5': colorMix(palette.accent, '#ffffff', 0.55),
    '--el-color-primary-light-7': colorMix(palette.accent, '#ffffff', 0.4),
    '--el-color-primary-light-8': colorMix(palette.accent, '#ffffff', 0.3),
    '--el-color-primary-light-9': colorMix(palette.accent, '#ffffff', 0.15),
    '--el-color-primary-dark-2': colorMix(palette.accent, '#000000', 0.65),
    '--el-color-success': palette.success,
    '--el-color-warning': palette.warning,
    '--el-color-danger': palette.danger,
    '--el-color-info': palette.textSecondary,
    '--el-text-color-primary': palette.textPrimary,
    '--el-text-color-regular': palette.textPrimary,
    '--el-text-color-secondary': palette.textSecondary,
    '--el-text-color-placeholder': palette.textTertiary,
    '--el-text-color-disabled': palette.textTertiary,
    '--el-border-color': palette.border,
    '--el-border-color-light': colorMix(palette.border, palette.surface, 0.75),
    '--el-border-color-lighter': colorMix(palette.border, palette.surface, 0.85),
    '--el-border-color-extra-light': colorMix(palette.border, palette.surface, 0.9),
    '--el-border-color-dark': colorMix(palette.border, '#000000', 0.6),
    '--el-border-color-darker': colorMix(palette.border, '#000000', 0.75),
    '--el-box-shadow': `0 12px 28px 0 ${palette.shadow}`,
    '--el-box-shadow-light': `0 12px 28px 0 ${palette.shadow}`,
    '--el-box-shadow-lighter': `0 8px 20px 0 ${palette.shadow}`,
  };

  for (const [key, value] of Object.entries({ ...rtVars, ...elVars })) {
    root.style.setProperty(key, value);
  }

  document.body.style.backgroundColor = palette.surface;
  document.body.style.color = palette.textPrimary;
  document.body.style.fontFamily = palette.fontFamily;
  document.body.dataset.rtTheme = kind;
  root.style.setProperty('color-scheme', kind === 'light' ? 'light' : 'dark');
  root.dataset.rtTheme = kind;
}

function updateTheme(forcedKind?: ThemeKind) {
  if (typeof window === 'undefined') {
    return;
  }
  const nextKind = forcedKind ?? detectThemeKind();
  const palette = buildPalette(nextKind);
  themeState.kind = nextKind;
  themeState.palette = palette;
  applyCssVariables(palette, nextKind);
}

function handleThemeMessage(event: MessageEvent) {
  const data = event.data as { type?: string; themeKind?: string };
  if (data?.type === 'vscode:colorTheme') {
    updateTheme(mapThemeKind(data.themeKind));
  }
}

function initializeTheme() {
  if (initialized || typeof window === 'undefined') {
    return;
  }
  initialized = true;
  updateTheme();
  window.addEventListener('message', handleThemeMessage);
  observer = new MutationObserver(() => updateTheme());
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

function teardownTheme() {
  if (!initialized || typeof window === 'undefined') {
    return;
  }
  window.removeEventListener('message', handleThemeMessage);
  observer?.disconnect();
  observer = null;
  initialized = false;
}

export function useTheme() {
  if (typeof window !== 'undefined') {
    initializeTheme();
  }

  onMounted(() => {
    initializeTheme();
  });

  onBeforeUnmount(() => {
    // keep listeners alive for other consumers; teardown occurs only when explicitly called
  });

  return {
    theme: computed(() => themeState.palette),
    themeKind: computed(() => themeState.kind),
    refreshTheme: () => updateTheme(),
    teardown: teardownTheme,
  };
}
