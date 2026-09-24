// Close our server before Playwright's Windows process-tree cleanup.
// A reused manual server has no matching token and stays running.
module.exports = async config => {
  const token = config.webServer?.env?.SHINOBI_E2E_SERVER_TOKEN;
  if (!token) return;
  try {
    const response = await fetch('http://127.0.0.1:4173/__e2e_shutdown', {
      method: 'POST', headers: {authorization: 'Bearer ' + token},
      signal: AbortSignal.timeout(3000),
    });
    await response.text();
  } catch (error) {
    console.warn('E2E server shutdown:', error.message);
  }
};
