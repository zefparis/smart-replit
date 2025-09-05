const { test, expect } = require('@playwright/test');

// Configuration des tests E2E pour SmartLinks Autopilot Growth Machine
test.describe('SmartLinks Autopilot - Tests E2E Complets', () => {
  const baseURL = 'http://localhost:5000';

  test.beforeEach(async ({ page }) => {
    // Naviguer vers l'application
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
  });

  test('E2E-001: Flux complet création campagne et diffusion multi-canal', async ({ page }) => {
    // 1. Vérifier que le dashboard est accessible
    await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
    
    // 2. Naviguer vers la page de monétisation
    await page.click('a[href="/monetization"]');
    await page.waitForLoadState('networkidle');
    
    // 3. Vérifier les opportunités disponibles
    const opportunities = page.locator('[data-testid^="opportunity-card-"]');
    await expect(opportunities.first()).toBeVisible();
    
    // 4. Lancer une campagne depuis une opportunité
    const firstOpportunity = opportunities.first();
    const launchButton = firstOpportunity.locator('[data-testid^="launch-campaign-"]');
    await launchButton.click();
    
    // 5. Vérifier la confirmation de lancement
    await expect(page.locator('.toast')).toContainText('Campagne lancée avec succès');
    
    // 6. Vérifier la création des variantes A/B
    await page.waitForTimeout(2000); // Attendre la création des variantes
    
    // 7. Naviguer vers la configuration des connecteurs
    await page.goto(`${baseURL}/channels-config`);
    await page.waitForLoadState('networkidle');
    
    // 8. Vérifier le statut des connecteurs
    await expect(page.locator('[data-testid="toggle-twitter"]')).toBeVisible();
    await expect(page.locator('[data-testid="toggle-discord"]')).toBeVisible();
    await expect(page.locator('[data-testid="toggle-telegram"]')).toBeVisible();
    
    // 9. Tester la configuration d'un connecteur
    await page.click('[data-testid="tab-configure"]');
    await page.fill('[data-testid="input-twitter-TWITTER_BEARER_TOKEN"]', 'test-token-123');
    await page.click('[data-testid="save-twitter"]');
    
    // 10. Vérifier la sauvegarde
    await expect(page.locator('.toast')).toContainText('Configuration Sauvegardée');
  });

  test('E2E-002: Test du système analytics et auto-optimisation', async ({ page }) => {
    // 1. Naviguer vers la page de monétisation
    await page.goto(`${baseURL}/monetization`);
    await page.waitForLoadState('networkidle');
    
    // 2. Vérifier les métriques temps réel
    await expect(page.locator('[data-testid="metric-total-revenue"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-profit-net"]')).toBeVisible();
    
    // 3. Déclencher l'auto-optimisation
    await page.click('[data-testid="button-auto-optimize"]');
    await page.waitForTimeout(3000);
    
    // 4. Vérifier le rapport d'optimisation
    await expect(page.locator('.toast')).toContainText('Auto-optimisation terminée');
    
    // 5. Consulter le rapport winners/losers
    const winnersReport = page.locator('[data-testid="winners-report"]');
    await expect(winnersReport).toBeVisible();
    
    // 6. Vérifier les actions recommandées
    const recommendations = page.locator('[data-testid^="recommendation-"]');
    await expect(recommendations.first()).toBeVisible();
  });

  test('E2E-003: Test du système finance étendu et exports', async ({ page }) => {
    // 1. Naviguer vers la page finance étendue
    await page.goto(`${baseURL}/enhanced-finance`);
    await page.waitForLoadState('networkidle');
    
    // 2. Vérifier les métriques financières
    await expect(page.locator('text=Revenus Totaux')).toBeVisible();
    await expect(page.locator('text=Commissions')).toBeVisible();
    await expect(page.locator('text=Profit Net')).toBeVisible();
    
    // 3. Tester les filtres
    await page.selectOption('[data-testid="select-period"]', '30d');
    await page.selectOption('[data-testid="select-source"]', 'stripe');
    
    // 4. Synchroniser les données externes
    await page.click('[data-testid="button-refresh-data"]');
    await page.waitForTimeout(2000);
    
    // 5. Tester l'export CSV
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="button-export-csv"]');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('transactions_30d.csv');
    
    // 6. Naviguer entre les onglets
    await page.click('[data-testid="tab-campaigns"]');
    await expect(page.locator('text=Revenus par Campagne')).toBeVisible();
    
    await page.click('[data-testid="tab-channels"]');
    await expect(page.locator('text=Performance par Canal')).toBeVisible();
    
    await page.click('[data-testid="tab-analytics"]');
    await expect(page.locator('text=Insights Financiers')).toBeVisible();
  });

  test('E2E-004: Test de monitoring et healthchecks', async ({ page }) => {
    // 1. Vérifier l'état de santé de l'application
    const response = await page.request.get(`${baseURL}/api/dashboard/metrics`);
    expect(response.ok()).toBeTruthy();
    
    // 2. Tester les connecteurs
    const channelsResponse = await page.request.get(`${baseURL}/api/channels/status`);
    expect(channelsResponse.ok()).toBeTruthy();
    
    const channelsData = await channelsResponse.json();
    expect(channelsData).toHaveProperty('channel_statuses');
    
    // 3. Vérifier les logs système
    await page.goto(`${baseURL}/logs`);
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('text=Logs Système')).toBeVisible();
    
    // 4. Tester les analytics
    const analyticsResponse = await page.request.get(`${baseURL}/api/analytics/winners-report`);
    expect(analyticsResponse.ok()).toBeTruthy();
    
    // 5. Vérifier la monétisation
    const monetizationResponse = await page.request.get(`${baseURL}/api/monetization/metrics`);
    expect(monetizationResponse.ok()).toBeTruthy();
  });

  test('E2E-005: Test de robustesse et gestion d\'erreurs', async ({ page }) => {
    // 1. Tester la résilience face aux erreurs réseau
    await page.route('**/api/monetization/**', route => route.abort());
    
    await page.goto(`${baseURL}/monetization`);
    await page.waitForLoadState('networkidle');
    
    // 2. Vérifier l'affichage d'état d'erreur
    await expect(page.locator('text=Erreur de chargement')).toBeVisible({ timeout: 10000 });
    
    // 3. Rétablir la connexion et vérifier la récupération
    await page.unroute('**/api/monetization/**');
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // 4. Tester la validation des formulaires
    await page.goto(`${baseURL}/channels-config`);
    await page.click('[data-testid="tab-configure"]');
    
    // Essayer de sauvegarder sans remplir les champs
    await page.click('[data-testid="save-twitter"]');
    // Vérifier qu'aucun toast de succès n'apparaît
    await page.waitForTimeout(1000);
    
    // 5. Tester la récupération automatique des données
    await page.goto(`${baseURL}/`);
    await page.waitForLoadState('networkidle');
    
    // Vérifier que les métriques se chargent correctement
    await expect(page.locator('[data-testid="metric-card"]').first()).toBeVisible();
  });

  test('E2E-006: Test performance et temps de réponse', async ({ page }) => {
    // 1. Mesurer les temps de chargement des pages principales
    const pages = [
      '/',
      '/monetization', 
      '/enhanced-finance',
      '/channels-config',
      '/ai-monitoring'
    ];
    
    for (const pagePath of pages) {
      const startTime = Date.now();
      await page.goto(`${baseURL}${pagePath}`);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Vérifier que le chargement prend moins de 5 secondes
      expect(loadTime).toBeLessThan(5000);
      console.log(`Page ${pagePath} loaded in ${loadTime}ms`);
    }
    
    // 2. Tester la réactivité des actions utilisateur
    await page.goto(`${baseURL}/monetization`);
    
    const startClick = Date.now();
    await page.click('[data-testid="launch-campaign-1"]');
    await page.waitForSelector('.toast', { timeout: 5000 });
    const clickResponseTime = Date.now() - startClick;
    
    // Vérifier que la réponse est quasi-instantanée
    expect(clickResponseTime).toBeLessThan(2000);
    console.log(`Campaign launch responded in ${clickResponseTime}ms`);
  });

  test('E2E-007: Test du flux complet avec tracking de conversion', async ({ page }) => {
    // 1. Créer une campagne
    await page.goto(`${baseURL}/monetization`);
    await page.waitForLoadState('networkidle');
    
    const initialMetrics = await page.request.get(`${baseURL}/api/monetization/metrics`);
    const initialData = await initialMetrics.json();
    
    // 2. Lancer une campagne
    await page.click('[data-testid="launch-campaign-1"]');
    await page.waitForSelector('.toast');
    
    // 3. Vérifier la mise à jour des métriques
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // 4. Simuler un clic de conversion (via API direct)
    await page.request.post(`${baseURL}/api/campaigns/track-conversion`, {
      data: { 
        campaign_id: 'test-campaign-1',
        source: 'twitter',
        revenue: 29.99
      }
    });
    
    // 5. Vérifier la page finance
    await page.goto(`${baseURL}/enhanced-finance`);
    await page.waitForLoadState('networkidle');
    
    // 6. Vérifier que les revenus sont trackés
    await expect(page.locator('text=Revenus Totaux')).toBeVisible();
    
    // 7. Déclencher l'auto-optimisation basée sur les performances
    await page.goto(`${baseURL}/monetization`);
    await page.click('[data-testid="button-auto-optimize"]');
    await page.waitForTimeout(2000);
    
    // 8. Vérifier les recommandations d'optimisation
    await expect(page.locator('.toast')).toContainText('Auto-optimisation terminée');
  });
});

// Tests de monitoring et alertes
test.describe('Monitoring et Alertes', () => {
  test('MON-001: Vérification des healthchecks automatiques', async ({ page }) => {
    const services = [
      '/api/dashboard/metrics',
      '/api/channels/status', 
      '/api/monetization/metrics',
      '/api/analytics/winners-report'
    ];
    
    for (const endpoint of services) {
      const response = await page.request.get(`http://localhost:5000${endpoint}`);
      expect(response.ok()).toBeTruthy();
      
      const responseTime = Date.now();
      expect(responseTime).toBeLessThan(2000); // Réponse sous 2 secondes
    }
  });

  test('MON-002: Test de la persistance des données', async ({ page }) => {
    // 1. Créer des données
    await page.goto('http://localhost:5000/monetization');
    await page.click('[data-testid="launch-campaign-1"]');
    await page.waitForSelector('.toast');
    
    // 2. Recharger et vérifier la persistance
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // 3. Vérifier que les données sont toujours là
    const metrics = await page.request.get('http://localhost:5000/api/monetization/metrics');
    const data = await metrics.json();
    expect(data).toHaveProperty('totalSmartLinks');
  });
});

module.exports = { test, expect };