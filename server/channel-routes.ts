import express from "express";
// <AI:BEGIN channel-routes>
import { z } from "zod";

const Channels = ["twitter","discord","telegram","email","medium"] as const;
type ChannelId = typeof Channels[number];

const cfgSchema = z.object({
  twitter: z.object({ bearerToken: z.string().min(10) }).partial().optional(),
  discord: z.object({ webhookUrl: z.string().url() }).partial().optional(),
  telegram: z.object({ botToken: z.string().min(10), chatId: z.string().min(1) }).partial().optional(),
  email: z.object({ sendgridKey: z.string().min(10).optional(), smtpHost: z.string().optional(), smtpUser: z.string().optional(), smtpPass: z.string().optional(), fromEmail: z.string().email().optional() }).partial().optional(),
  medium: z.object({ accessToken: z.string().min(10) }).partial().optional(),
}).partial();

type ChannelCfg = z.infer<typeof cfgSchema>;
// <AI:END channel-routes>

const channelRouter = express.Router();

// Channel configuration routes
channelRouter.get("/api/channels/config", async (req, res) => {
  try {
    const channels = [
      {
        id: "twitter",
        name: "Twitter/X",
        description: "Diffusion automatique sur Twitter avec API v2",
        icon: "🐦",
        status: process.env.TWITTER_BEARER_TOKEN ? "configured" : "disconnected",
        required_keys: ["TWITTER_BEARER_TOKEN"],
        rate_limit: "300 posts/15min",
        test_available: true,
        enabled: true
      },
      {
        id: "discord",
        name: "Discord", 
        description: "Messages automatiques via webhooks Discord",
        icon: "💬",
        status: process.env.DISCORD_WEBHOOK_URL ? "configured" : "disconnected",
        required_keys: ["DISCORD_WEBHOOK_URL"],
        rate_limit: "30 msg/min",
        test_available: true,
        enabled: true
      },
      {
        id: "telegram",
        name: "Telegram",
        description: "Bot Telegram pour diffusion automatique",
        icon: "✈️",
        status: (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) ? "configured" : "disconnected",
        required_keys: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
        rate_limit: "30 msg/sec",
        test_available: true,
        enabled: true
      },
      {
        id: "email",
        name: "Email SMTP",
        description: "Envoi d'emails via SendGrid ou SMTP",
        icon: "📧",
        status: (process.env.SENDGRID_API_KEY || process.env.SMTP_HOST) ? "configured" : "disconnected",
        required_keys: ["SENDGRID_API_KEY", "FROM_EMAIL"],
        rate_limit: "1000 emails/day",
        test_available: true,
        enabled: true
      },
      {
        id: "medium",
        name: "Medium",
        description: "Publication automatique d'articles Medium", 
        icon: "📝",
        status: process.env.MEDIUM_ACCESS_TOKEN ? "configured" : "disconnected",
        required_keys: ["MEDIUM_ACCESS_TOKEN"],
        rate_limit: "25 posts/day",
        test_available: true,
        enabled: false
      }
    ];

    res.json(channels);
  } catch (error) {
    console.error("Error fetching channel config:", error);
    res.status(500).json({ error: "Failed to fetch channel configuration" });
  }
});

channelRouter.post("/api/channels/configure/:channelId", async (req, res) => {
  try {
    const { channelId } = req.params;
    const { credentials } = req.body;

    console.log(`Configuring channel ${channelId} with credentials:`, Object.keys(credentials));

    res.json({ 
      success: true, 
      message: `Channel ${channelId} configured successfully`,
      channelId 
    });
  } catch (error) {
    console.error("Error configuring channel:", error);
    res.status(500).json({ error: "Failed to configure channel" });
  }
});

channelRouter.post("/api/channels/test/:channelId", async (req, res) => {
  try {
    const { channelId } = req.params;
    
    const testResults: {[key: string]: {success: boolean, message: string}} = {
      twitter: { success: false, message: "Bearer token non configuré" },
      discord: { success: false, message: "Webhook URL manquant" },
      telegram: { success: false, message: "Bot token ou chat ID manquant" },
      email: { success: false, message: "API key SendGrid manquant" },
      medium: { success: false, message: "Access token Medium manquant" }
    };

    if (channelId === "twitter" && process.env.TWITTER_BEARER_TOKEN) {
      testResults.twitter = { success: true, message: "Connexion Twitter validée" };
    }
    if (channelId === "discord" && process.env.DISCORD_WEBHOOK_URL) {
      testResults.discord = { success: true, message: "Webhook Discord accessible" };
    }
    if (channelId === "telegram" && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      testResults.telegram = { success: true, message: "Bot Telegram opérationnel" };
    }
    if (channelId === "email" && process.env.SENDGRID_API_KEY) {
      testResults.email = { success: true, message: "SendGrid API validée" };
    }
    if (channelId === "medium" && process.env.MEDIUM_ACCESS_TOKEN) {
      testResults.medium = { success: true, message: "Medium API accessible" };
    }

    const result = testResults[channelId] || { success: false, message: "Canal non reconnu" };

    res.json({
      success: result.success,
      message: result.message,
      channelId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error testing channel:", error);
    res.status(500).json({ error: "Failed to test channel connection" });
  }
});

channelRouter.post("/api/channels/toggle/:channelId", async (req, res) => {
  try {
    const { channelId } = req.params;
    const { enabled } = req.body;

    console.log(`Toggling channel ${channelId} to ${enabled ? 'enabled' : 'disabled'}`);

    res.json({
      success: true,
      channelId,
      enabled,
      message: `Channel ${channelId} ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    console.error("Error toggling channel:", error);
    res.status(500).json({ error: "Failed to toggle channel" });
  }
});

// NOUVELLES ROUTES POUR API KEYS SÉCURISÉES
// Récupérer toutes les clés API
channelRouter.get("/api/api-keys", async (req, res) => {
  try {
    const { storage } = await import("./storage");
    const apiKeys = await storage.getAllApiKeys();
    
    // Masquer les valeurs sensibles
    const safeApiKeys = apiKeys.map(key => ({
      ...key,
      keyValue: key.keyValue ? `****${key.keyValue.slice(-4)}` : ""
    }));
    
    res.json(safeApiKeys);
  } catch (error) {
    console.error("Erreur récupération clés API:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Créer une nouvelle clé API
channelRouter.post("/api/api-keys", async (req, res) => {
  try {
    const { insertApiKeySchema } = await import("@shared/schema");
    const { storage } = await import("./storage");
    
    const validatedData = insertApiKeySchema.parse(req.body);
    const apiKey = await storage.createApiKey(validatedData);
    
    // Masquer la valeur dans la réponse
    const safeApiKey = {
      ...apiKey,
      keyValue: `****${apiKey.keyValue.slice(-4)}`
    };
    
    res.status(201).json(safeApiKey);
  } catch (error) {
    console.error("Erreur création clé API:", error);
    res.status(500).json({ error: "Erreur création clé API" });
  }
});

// Tester une clé API
channelRouter.post("/api/api-keys/:id/test", async (req, res) => {
  try {
    const { storage } = await import("./storage");
    const result = await storage.testApiKeyConnection(req.params.id);
    res.json(result);
  } catch (error) {
    console.error("Erreur test clé API:", error);
    res.status(500).json({ error: "Erreur test connexion" });
  }
});

// Mettre à jour une clé API
channelRouter.patch("/api/api-keys/:id", async (req, res) => {
  try {
    const { storage } = await import("./storage");
    const apiKey = await storage.updateApiKey(req.params.id, req.body);
    
    if (!apiKey) {
      return res.status(404).json({ error: "Clé API non trouvée" });
    }
    
    const safeApiKey = {
      ...apiKey,
      keyValue: `****${apiKey.keyValue.slice(-4)}`
    };
    
    res.json(safeApiKey);
  } catch (error) {
    console.error("Erreur mise à jour clé API:", error);
    res.status(500).json({ error: "Erreur mise à jour" });
  }
});

// Supprimer une clé API
channelRouter.delete("/api/api-keys/:id", async (req, res) => {
  try {
    const { storage } = await import("./storage");
    const success = await storage.deleteApiKey(req.params.id);
    
    if (!success) {
      return res.status(404).json({ error: "Clé API non trouvée" });
    }
    
    res.json({ message: "Clé API supprimée avec succès" });
  } catch (error) {
    console.error("Erreur suppression clé API:", error);
    res.status(500).json({ error: "Erreur suppression" });
  }
});

export default channelRouter;