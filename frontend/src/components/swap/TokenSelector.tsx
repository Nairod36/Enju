import React, { useState } from "react";
import { Button } from "../ui/button";
import { TokenLogo } from "../ui/token-logo";
import { ChevronDown, X } from "lucide-react";

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
}

interface TokenSelectorProps {
  selectedToken: Token;
  onTokenSelect: (token: Token) => void;
  tokens: Record<string, Token>;
  balances: Record<string, string>;
  excludeToken?: Token; // Pour éviter de sélectionner le même token
}

export const TokenSelector: React.FC<TokenSelectorProps> = ({
  selectedToken,
  onTokenSelect,
  tokens,
  balances,
  excludeToken,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const availableTokens = Object.entries(tokens).filter(
    ([key, token]) => !excludeToken || token.address !== excludeToken.address
  );

  // Trouver le solde du token sélectionné
  const selectedTokenKey = Object.keys(tokens).find(
    (key) => tokens[key].address === selectedToken.address
  );
  const selectedTokenBalance = selectedTokenKey
    ? balances[selectedTokenKey]
    : "0";

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between h-20 px-3 border-1 hover:border-gray-300"
      >
        <div className="flex items-center space-x-2">
          <TokenLogo symbol={selectedToken.symbol} size="sm" />
          <div className="text-left">
            <div className="font-semibold">{selectedToken.symbol}</div>
            <div className="text-xs text-gray-500">{selectedToken.name}</div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="text-right">
            <div className="text-sm font-medium">{selectedTokenBalance}</div>
            <div className="text-xs text-gray-500">Balance</div>
          </div>
          <ChevronDown className="w-4 h-4" />
        </div>
      </Button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
            <div className="p-2">
              <div className="flex items-center justify-between mb-2 px-2">
                <span className="text-sm font-medium text-gray-700">
                  Select Token
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-1">
                {availableTokens.map(([key, token]) => (
                  <button
                    key={token.address}
                    onClick={() => {
                      onTokenSelect(token);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <TokenLogo symbol={token.symbol} size="sm" />
                      <div className="text-left">
                        <div className="font-medium text-sm">
                          {token.symbol}
                        </div>
                        <div className="text-xs text-gray-500">
                          {token.name}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {balances[key] || "0"}
                      </div>
                      <div className="text-xs text-gray-500">Balance</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
