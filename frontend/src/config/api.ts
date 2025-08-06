
// Configuration API centralis�e
export const API_CONFIG = {
  // Base URL du backend
  BASE_URL: 'http://152.228.163.97:3001/api/v1',

  // RPC Endpoint pour les appels blockchain
  RPC_URL: 'https://vps-b11044fd.vps.ovh.net/rpc',

  // Timeouts optimis�s pour un VPS avec ressources limit�es
  TIMEOUT: 30000, // 30 secondes
  RETRY_ATTEMPTS: 2, // Moins de tentatives pour �viter la surcharge

  // Headers par d�faut
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
  }
};

// Helper pour faire des requ�tes avec timeout et retry
export const apiRequest = async (url: string, options: RequestInit = {}, retries = API_CONFIG.RETRY_ATTEMPTS): Promise<Response> => {
  // Bloquer les URLs vides seulement
  if (!url || url === '') {
    throw new Error('API calls disabled - no URL provided');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...API_CONFIG.DEFAULT_HEADERS,
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok && retries > 0) {
      console.warn(`Request failed, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return apiRequest(url, options, retries - 1);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }

    if (retries > 0) {
      console.warn(`Request failed, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return apiRequest(url, options, retries - 1);
    }

    throw error;
  }
};

// Helper pour les requ�tes RPC
export const rpcRequest = async (method: string, params: any[], id: number = 1) => {
  return apiRequest(API_CONFIG.RPC_URL, {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id
    })
  });
};