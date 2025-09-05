import { Request, Response, Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const router = Router();

// Helper pour exécuter les scripts Python AliExpress
function executePythonScript(scriptName: string, args: string[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(process.cwd(), 'external_scrapers', scriptName);
        
        if (!fs.existsSync(scriptPath)) {
            reject(new Error(`Script not found: ${scriptPath}`));
            return;
        }
        
        const pythonProcess = spawn('python3', [scriptPath, ...args], {
            cwd: path.join(process.cwd(), 'external_scrapers'),
            env: { ...process.env }
        });
        
        let stdout = '';
        let stderr = '';
        
        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    // Tenter de parser la sortie JSON
                    const output = stdout.trim();
                    const lines = output.split('\n');
                    const lastLine = lines[lines.length - 1];
                    
                    if (lastLine.startsWith('{') || lastLine.startsWith('[')) {
                        resolve(JSON.parse(lastLine));
                    } else {
                        resolve({ output, success: true });
                    }
                } catch (e) {
                    resolve({ output: stdout, success: true });
                }
            } else {
                reject(new Error(`Python script failed with code ${code}: ${stderr || stdout}`));
            }
        });
        
        pythonProcess.on('error', (error) => {
            reject(error);
        });
    });
}

// Status et configuration AliExpress
router.get('/status', async (req: Request, res: Response) => {
    try {
        // Vérifier les variables d'environnement
        const hasAppKey = !!process.env.ALIEXPRESS_APP_KEY;
        const hasAppSecret = !!process.env.ALIEXPRESS_APP_SECRET;
        const hasCallbackUrl = !!process.env.ALIEXPRESS_CALLBACK_URL;
        
        // Vérifier l'existence du token
        const tokenPath = path.join(process.cwd(), 'external_scrapers', 'aliexpress_token.json');
        const hasToken = fs.existsSync(tokenPath);
        
        let tokenInfo = null;
        if (hasToken) {
            try {
                const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
                tokenInfo = {
                    hasAccessToken: !!tokenData.access_token,
                    obtainedAt: tokenData.obtained_at,
                    expiresIn: tokenData.expires_in
                };
            } catch (e) {
                tokenInfo = { hasAccessToken: false };
            }
        }
        
        const status = {
            configured: hasAppKey && hasAppSecret && hasCallbackUrl,
            authenticated: hasToken && tokenInfo?.hasAccessToken,
            appKey: hasAppKey ? process.env.ALIEXPRESS_APP_KEY?.substring(0, 4) + '***' : null,
            callbackUrl: process.env.ALIEXPRESS_CALLBACK_URL,
            tokenInfo,
            scriptsAvailable: {
                dropship: fs.existsSync(path.join(process.cwd(), 'external_scrapers', 'aliexpress_dropship.py')),
                oauth: fs.existsSync(path.join(process.cwd(), 'external_scrapers', 'aliexpress_oauth_helper.py')),
                test: fs.existsSync(path.join(process.cwd(), 'external_scrapers', 'test_aliexpress.py'))
            }
        };
        
        res.json(status);
    } catch (error) {
        console.error('AliExpress status error:', error);
        res.status(500).json({ error: 'Failed to get AliExpress status' });
    }
});

// Générer l'URL OAuth
router.get('/oauth/url', async (req: Request, res: Response) => {
    try {
        const result = await executePythonScript('aliexpress_oauth_helper.py', ['--get-url']);
        res.json(result);
    } catch (error) {
        console.error('OAuth URL generation error:', error);
        res.status(500).json({ error: 'Failed to generate OAuth URL' });
    }
});

// Échanger le code OAuth contre un token
router.post('/oauth/token', async (req: Request, res: Response) => {
    try {
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({ error: 'Authorization code is required' });
        }
        
        const result = await executePythonScript('aliexpress_oauth_helper.py', ['--exchange-token', code]);
        res.json(result);
    } catch (error) {
        console.error('OAuth token exchange error:', error);
        res.status(500).json({ error: 'Failed to exchange OAuth code' });
    }
});

// Recherche de produits
router.get('/products/search', async (req: Request, res: Response) => {
    try {
        const { sku, query } = req.query;
        
        if (!sku && !query) {
            return res.status(400).json({ error: 'SKU or query is required' });
        }
        
        const args = [];
        if (sku) args.push('--sku', sku as string);
        if (query) args.push('--query', query as string);
        
        const result = await executePythonScript('aliexpress_dropship.py', ['--search', ...args]);
        res.json(result);
    } catch (error) {
        console.error('Product search error:', error);
        res.status(500).json({ error: 'Failed to search products' });
    }
});

// Détails d'un produit
router.get('/products/:productId', async (req: Request, res: Response) => {
    try {
        const { productId } = req.params;
        
        const result = await executePythonScript('aliexpress_dropship.py', ['--product-details', productId]);
        res.json(result);
    } catch (error) {
        console.error('Product details error:', error);
        res.status(500).json({ error: 'Failed to get product details' });
    }
});

// Créer une commande
router.post('/orders', async (req: Request, res: Response) => {
    try {
        const orderData = req.body;
        
        // Valider les données de commande
        if (!orderData.buyer || !orderData.items || !Array.isArray(orderData.items)) {
            return res.status(400).json({ error: 'Invalid order data' });
        }
        
        // Sauvegarder temporairement les données de commande
        const tempFile = path.join(process.cwd(), 'external_scrapers', `temp_order_${Date.now()}.json`);
        fs.writeFileSync(tempFile, JSON.stringify(orderData, null, 2));
        
        try {
            const result = await executePythonScript('aliexpress_dropship.py', ['--create-order', tempFile]);
            
            // Nettoyer le fichier temporaire
            fs.unlinkSync(tempFile);
            
            res.json(result);
        } catch (error) {
            // Nettoyer le fichier temporaire même en cas d'erreur
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
            throw error;
        }
    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Statut d'une commande
router.get('/orders/:orderId/status', async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;
        
        const result = await executePythonScript('aliexpress_dropship.py', ['--order-status', orderId]);
        res.json(result);
    } catch (error) {
        console.error('Order status error:', error);
        res.status(500).json({ error: 'Failed to get order status' });
    }
});

// Suivi d'une commande
router.get('/orders/track/:trackingNumber', async (req: Request, res: Response) => {
    try {
        const { trackingNumber } = req.params;
        
        const result = await executePythonScript('aliexpress_dropship.py', ['--track-order', trackingNumber]);
        res.json(result);
    } catch (error) {
        console.error('Order tracking error:', error);
        res.status(500).json({ error: 'Failed to track order' });
    }
});

// Lister les commandes
router.get('/orders', async (req: Request, res: Response) => {
    try {
        const { status, limit = '10' } = req.query;
        
        const args = ['--list-orders', '--limit', limit as string];
        if (status) args.push('--status', status as string);
        
        const result = await executePythonScript('aliexpress_dropship.py', args);
        res.json(result);
    } catch (error) {
        console.error('Orders list error:', error);
        res.status(500).json({ error: 'Failed to list orders' });
    }
});

// Méthodes de livraison
router.get('/shipping/methods', async (req: Request, res: Response) => {
    try {
        const { country = 'FR' } = req.query;
        
        const result = await executePythonScript('aliexpress_dropship.py', ['--shipping-methods', country as string]);
        res.json(result);
    } catch (error) {
        console.error('Shipping methods error:', error);
        res.status(500).json({ error: 'Failed to get shipping methods' });
    }
});

// Test de connexion
router.get('/test', async (req: Request, res: Response) => {
    try {
        const result = await executePythonScript('test_aliexpress.py', ['--quick-test']);
        res.json(result);
    } catch (error) {
        console.error('AliExpress test error:', error);
        res.status(500).json({ error: 'Failed to test AliExpress connection' });
    }
});

export default router;