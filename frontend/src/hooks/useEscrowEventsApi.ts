import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export interface EscrowEventData {
  id: string;
  eventType: 'SrcEscrowCreated' | 'DstEscrowCreated';
  escrowAddress: string;
  hashlock: string;
  txHash: string;
  blockNumber: number;
  orderHash?: string;
  maker?: string;
  taker?: string;
  amount?: number;
  token?: string;
  chainId: number;
  processed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UseEscrowEventsOptions {
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

const BACKEND_API_URL = 'http://localhost:3001';

/**
 * Hook to fetch escrow events from backend API instead of direct blockchain monitoring
 * This replaces the direct blockchain event listening to prevent API spam
 */
export function useEscrowEvents(options: UseEscrowEventsOptions = {}) {
  const {
    limit = 50,
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
  } = options;

  const [events, setEvents] = useState<EscrowEventData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch events from backend API
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${BACKEND_API_URL}/escrow-events`, {
        params: { limit },
        timeout: 10000,
      });

      if (response.data.success) {
        setEvents(response.data.data || []);
        setLastUpdated(new Date());
      } else {
        setError(response.data.error || 'Failed to fetch events');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch events');
      console.error('Error fetching escrow events:', err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Get events by specific hashlock
  const getEventsByHashlock = useCallback(async (hashlock: string) => {
    try {
      const response = await axios.get(`${BACKEND_API_URL}/escrow-events/by-hashlock`, {
        params: { hashlock },
        timeout: 10000,
      });

      if (response.data.success) {
        return response.data.data || [];
      } else {
        throw new Error(response.data.error || 'Failed to fetch events by hashlock');
      }
    } catch (err: any) {
      console.error('Error fetching events by hashlock:', err);
      throw err;
    }
  }, []);

  // Get event statistics
  const getEventStats = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_API_URL}/escrow-events/stats`, {
        timeout: 10000,
      });

      if (response.data.success) {
        return response.data.data || {};
      } else {
        throw new Error(response.data.error || 'Failed to fetch stats');
      }
    } catch (err: any) {
      console.error('Error fetching event stats:', err);
      throw err;
    }
  }, []);

  // Manual refresh
  const refresh = useCallback(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Set up auto-refresh
  useEffect(() => {
    // Initial fetch
    fetchEvents();

    // Set up interval for auto-refresh
    if (autoRefresh) {
      const interval = setInterval(fetchEvents, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchEvents, autoRefresh, refreshInterval]);

  // Filter events by type
  const srcEvents = events.filter(event => event.eventType === 'SrcEscrowCreated');
  const dstEvents = events.filter(event => event.eventType === 'DstEscrowCreated');

  return {
    // Data
    events,
    srcEvents,
    dstEvents,
    loading,
    error,
    lastUpdated,

    // Actions
    refresh,
    getEventsByHashlock,
    getEventStats,

    // Computed
    eventCount: events.length,
    srcEventCount: srcEvents.length,
    dstEventCount: dstEvents.length,
  };
}
