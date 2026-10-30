const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { APPS } = require('./apps');
const { formatViolations, SKIPPED_AXE_RULES } = require('./helpers');

// Pages de connexion : première impression de chaque application, accessible à tous.
for (const [name, app] of Object.entries(APPS)) {
  test(`${name} : la page de connexion n'a pas de violation WCAG 2.1 AA`, async ({ page }) => {
    await page.goto(`http://localhost:${app.port}/login`);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(SKIPPED_AXE_RULES)
      .analyze();

    const summary = formatViolations(results.violations);
    expect(summary, summary.join('\n')).toEqual([]);
  });

  test(`${name} : pas de défilement horizontal sur la page de connexion`, async ({ page }) => {
    await page.goto(`http://localhost:${app.port}/login`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
