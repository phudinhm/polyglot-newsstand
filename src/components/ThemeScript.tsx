import { ACCENT_COLORS, DEFAULT_SETTINGS, SETTINGS_KEY } from "@/lib/settings";

/**
 * Runs before first paint so a reader never sees a white flash before their
 * sepia or dark theme loads. Kept deliberately small and dependency free.
 */
export function ThemeScript() {
  const script = `
(function () {
  try {
    var d = ${JSON.stringify({
      theme: DEFAULT_SETTINGS.theme,
      accentColor: DEFAULT_SETTINGS.accentColor,
      font: DEFAULT_SETTINGS.font,
      fontSize: DEFAULT_SETTINGS.fontSize,
      lineHeight: DEFAULT_SETTINGS.lineHeight,
      measure: DEFAULT_SETTINGS.measure,
      tracking: DEFAULT_SETTINGS.tracking,
      zoom: DEFAULT_SETTINGS.zoom,
    })};
    var accents = ${JSON.stringify(ACCENT_COLORS)};
    var raw = localStorage.getItem(${JSON.stringify(SETTINGS_KEY)});
    var s = raw ? Object.assign({}, d, JSON.parse(raw)) : d;
    var theme = s.theme;
    if (theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'ink' : 'paper';
    }
    var r = document.documentElement;
    r.dataset.theme = theme;
    r.dataset.font = s.font || d.font;
    r.dataset.accent = s.accentColor || 'default';
    if (s.accentColor && s.accentColor !== 'default') {
      var isDark = theme === 'slate' || theme === 'ink';
      for (var i = 0; i < accents.length; i++) {
        if (accents[i].id === s.accentColor) {
          var p = isDark ? accents[i].dark : accents[i].light;
          r.style.setProperty('--accent', p.accent);
          r.style.setProperty('--accent-fg', p.accentFg);
          r.style.setProperty('--highlight', p.highlight);
          r.style.setProperty('--color-accent', p.accent);
          r.style.setProperty('--color-accent-fg', p.accentFg);
          break;
        }
      }
    }
    r.style.setProperty('--ui-zoom', String(s.zoom || 1));
    r.style.setProperty('--reading-size', (s.fontSize || d.fontSize) + 'px');
    r.style.setProperty('--reading-leading', String(s.lineHeight || d.lineHeight));
    r.style.setProperty('--reading-measure', (s.measure || d.measure) + 'ch');
    r.style.setProperty('--reading-tracking', (s.tracking || 0) + 'em');
    r.style.colorScheme = theme === 'paper' || theme === 'sepia' || theme === 'modern' || theme === 'forest' || theme === 'nordic' ? 'light' : 'dark';
  } catch (e) {}
})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
