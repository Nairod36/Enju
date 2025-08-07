import { API_CONFIG } from '@/config/api';
import { BRIDGE_CONFIG } from '@/config/networks';

export const useNearProxy = () => {
    const proxyNearRpc = async (rpcRequest: any) => {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/near/rpc`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(rpcRequest),
            });

            if (!response.ok) {
                throw new Error(`RPC proxy failed: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('NEAR RPC proxy error:', error);
            throw error;
        }
    };

    const getAccount = async (accountId: string) => {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/near/account/${accountId}`);

            if (!response.ok) {
                throw new Error(`Account lookup failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('NEAR account lookup error:', error);
            throw error;
        }
    };

    const viewFunction = async (contractId: string, method: string, args: any = {}) => {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/near/view-function`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ contractId, method, args }),
            });

            if (!response.ok) {
                throw new Error(`View function failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('NEAR view function error:', error);
            throw error;
        }
    };

    return {
        proxyNearRpc,
        getAccount,
        viewFunction,
    };
};