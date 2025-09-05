// <AI:BEGIN ui-amazon-create>
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CreateAmazonLink() {
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [out, setOut] = useState<any>(null);

  const submit = async () => {
    setCreating(true);
    try {
      const r = await fetch("/api/monetization/smart-links/amazon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input })
      });
      const j = await r.json();
      setOut(j);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer un SmartLink Amazon</CardTitle>
        <CardDescription>
          Entrez un ASIN ou une URL Amazon pour créer un lien affilié automatiquement
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="amazon-input">ASIN ou URL Amazon</Label>
          <Input
            id="amazon-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="B0CXXXXXXX ou https://www.amazon.fr/dp/B0CXXXXXXX"
            data-testid="input-amazon-link"
          />
        </div>
        
        <Button 
          disabled={!input || creating} 
          onClick={submit}
          className="w-full"
          data-testid="button-create-amazon-link"
        >
          {creating ? "Création..." : "Créer SmartLink Amazon"}
        </Button>
        
        {out && (
          <div className="mt-4">
            <Label>Résultat:</Label>
            <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-64 bg-muted p-3 rounded border">
              {JSON.stringify(out, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
// <AI:END ui-amazon-create>