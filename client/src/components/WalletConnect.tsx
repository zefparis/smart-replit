import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, AlertCircle, RefreshCw, ExternalLink, Copy, Check } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useIASToken } from '@/hooks/useIASToken';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface WalletConnectProps {
  showBalance?: boolean;
  showAddToken?: boolean;
  className?: string;
}

export function WalletConnect({ 
  showBalance = true, 
  showAddToken = true,
  className = "" 
}: WalletConnectProps) {
  const { toast } = useToast();
  const [copiedAddress, setCopiedAddress] = useState(false);
  
  const {
    isConnected,
    account,
    balance,
    network,
    isLoading: walletLoading,
    error: walletError,
    connect,
    disconnect,
    switchNetwork,
    requestAddToken,
  } = useWallet();

  const iasToken = useIASToken(import.meta.env.VITE_IAS_CONTRACT_ADDRESS);

  const handleConnect = async () => {
    try {
      await connect();
      toast({
        title: 'Wallet Connected!',
        description: 'Your wallet has been connected successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to connect wallet',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = () => {
    disconnect();
    toast({
      title: 'Wallet Disconnected',
      description: 'Your wallet has been disconnected.',
    });
  };

  const handleSwitchToSepolia = async () => {
    try {
      await switchNetwork(11155111); // Sepolia chainId
      toast({
        title: 'Network Switched',
        description: 'Successfully switched to Sepolia testnet.',
      });
    } catch (error: any) {
      toast({
        title: 'Network Switch Failed',
        description: error.message || 'Failed to switch network',
        variant: 'destructive',
      });
    }
  };

  const handleAddIASToken = async () => {
    try {
      if (!import.meta.env.VITE_IAS_CONTRACT_ADDRESS) {
        throw new Error('IAS token address not configured');
      }
      
      await requestAddToken(
        import.meta.env.VITE_IAS_CONTRACT_ADDRESS,
        'IAS',
        18
      );
      
      toast({
        title: 'Token Added!',
        description: 'IAS token has been added to your wallet.',
      });
    } catch (error: any) {
      toast({
        title: 'Add Token Failed',
        description: error.message || 'Failed to add IAS token',
        variant: 'destructive',
      });
    }
  };

  const copyAddress = async () => {
    if (account) {
      await navigator.clipboard.writeText(account);
      setCopiedAddress(true);
      toast({
        title: 'Address Copied',
        description: 'Wallet address copied to clipboard.',
      });
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    return num.toFixed(4);
  };

  if (!isConnected) {
    return (
      <Card className={className} data-testid="wallet-connect-card">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Connect Your Wallet</CardTitle>
          <CardDescription>
            Connect your MetaMask wallet to start earning IAS token rewards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {walletError && (
            <Alert variant="destructive" data-testid="wallet-error-alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{walletError}</AlertDescription>
            </Alert>
          )}
          
          <Button 
            onClick={handleConnect} 
            disabled={walletLoading}
            className="w-full"
            size="lg"
            data-testid="button-connect-wallet"
          >
            {walletLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </>
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <p>Make sure you have MetaMask installed</p>
            <a 
              href="https://metamask.io/download/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center"
              data-testid="link-install-metamask"
            >
              Install MetaMask <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isSepoliaNetwork = network?.chainId === 11155111;

  return (
    <Card className={className} data-testid="wallet-connected-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
            </div>
            <div>
              <CardTitle className="text-lg">Wallet Connected</CardTitle>
              <CardDescription>
                {network?.name || 'Unknown Network'}
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDisconnect}
            data-testid="button-disconnect-wallet"
          >
            Disconnect
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Address */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Address</p>
            <p className="font-mono text-sm" data-testid="text-wallet-address">
              {formatAddress(account!)}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={copyAddress}
            data-testid="button-copy-address"
          >
            {copiedAddress ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Network Status */}
        {!isSepoliaNetwork && (
          <Alert data-testid="alert-wrong-network">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Switch to Sepolia testnet to earn IAS rewards</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSwitchToSepolia}
                data-testid="button-switch-network"
              >
                Switch Network
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Balances */}
        {showBalance && (
          <div className="grid grid-cols-2 gap-4">
            {/* ETH Balance */}
            <div className="p-3 border rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold">Ξ</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">ETH Balance</p>
                  <p className="text-sm font-medium" data-testid="text-eth-balance">
                    {formatBalance(balance)} ETH
                  </p>
                </div>
              </div>
            </div>

            {/* IAS Balance */}
            <div className="p-3 border rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">IAS</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">IAS Balance</p>
                  {iasToken.isLoading ? (
                    <div className="flex items-center space-x-1">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span className="text-xs">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-sm font-medium" data-testid="text-ias-balance">
                      {iasToken.balance ? formatBalance(iasToken.balance) : '0'} IAS
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add IAS Token */}
        {showAddToken && isSepoliaNetwork && (
          <Button 
            variant="outline" 
            onClick={handleAddIASToken}
            className="w-full"
            data-testid="button-add-ias-token"
          >
            Add IAS Token to Wallet
          </Button>
        )}

        {/* Network Badge */}
        <div className="flex items-center justify-center">
          <Badge 
            variant={isSepoliaNetwork ? "default" : "destructive"}
            data-testid="badge-network-status"
          >
            {network?.name || 'Unknown'} Network
            {isSepoliaNetwork && ' ✓'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}