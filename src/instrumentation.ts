export async function register() {
  // Validation belongs to runtime startup, not static compilation.
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const { getConfig } = await import('./lib/config');
    getConfig();
  }
}
