import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync('src/app/globals.css', 'utf8').toLowerCase();
const tokens = JSON.parse(readFileSync('docs/design/open-window/tokens.json', 'utf8'));
const colorNames: Record<string, string> = {
  canvas: 'canvas', surface: 'surface', ink: 'ink', textSecondary: 'text-secondary', action: 'action', actionHover: 'action-hover',
  actionSoft: 'action-soft', actionStroke: 'action-stroke', buttercream: 'buttercream', skyStar: 'sky-star', blushStar: 'blush-star', dividerDecorative: 'line', controlBorder: 'control-edge',
  errorInk: 'error-ink', errorSurface: 'error-surface',
};

it('declares every design color exactly as the token file has it', () => {
  for (const [key, name] of Object.entries(colorNames)) {
    expect(tokens.colors[key], `token ${key} missing from tokens.json`).toBeTruthy();
    expect(css).toMatch(new RegExp(`--color-${name}:\\s*${tokens.colors[key].toLowerCase()}`));
  }
});
it('declares the radii, the font stacks, and reduced motion', () => {
  for (const [name, px] of Object.entries(tokens.radius)) expect(css).toMatch(new RegExp(`--radius-${name}:\\s*${px}px`));
  expect(css).toContain('--font-paperlogy');
  expect(css).toContain('--font-pretendard');
  expect(css).toContain('prefers-reduced-motion');
});
