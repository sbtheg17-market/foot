import axe from 'axe-core';

/**
 * Run axe on a rendered container and return violations.
 * color-contrast is disabled because jsdom performs no real rendering, so
 * contrast cannot be computed deterministically outside a browser.
 */
export async function axeViolations(container: Element) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')),
  }));
}
