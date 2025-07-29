import React from 'react';
import { useEscrowEvents } from '../hooks/useEscrowEventsApi';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { RefreshCw, Activity, Clock, Hash } from 'lucide-react';

/**
 * Enhanced AppDashboard component that uses backend API instead of direct blockchain monitoring
 * This solves the API spam issue by fetching events from the backend database
 */
export function AppDashboard() {
  const {
    events,
    srcEvents,
    dstEvents,
    loading,
    error,
    lastUpdated,
    refresh,
    eventCount,
    srcEventCount,
    dstEventCount,
  } = useEscrowEvents({
    limit: 50,
    autoRefresh: true,
    refreshInterval: 30000, // Refresh every 30 seconds instead of real-time monitoring
  });

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatAmount = (amount?: number) => {
    if (!amount) return 'N/A';
    return `${parseFloat(amount.toString()).toFixed(4)} ETH`;
  };

  const getEventTypeColor = (eventType: string) => {
    return eventType === 'SrcEscrowCreated' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Escrow Event Dashboard</h1>
        <div className="flex items-center space-x-4">
          <Button 
            onClick={refresh}
            disabled={loading}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              Last updated: {formatTimestamp(lastUpdated.toISOString())}
            </span>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <Activity className="h-5 w-5" />
              <span>Error: {error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eventCount}</div>
            <p className="text-xs text-muted-foreground">
              Escrow events tracked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Source Escrows</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{srcEventCount}</div>
            <p className="text-xs text-muted-foreground">
              SrcEscrowCreated events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Destination Escrows</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{dstEventCount}</div>
            <p className="text-xs text-muted-foreground">
              DstEscrowCreated events
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Recent Escrow Events</span>
            {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 && !loading ? (
            <div className="text-center py-8 text-gray-500">
              No escrow events found. The cronjob service will populate events as they occur.
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge className={getEventTypeColor(event.eventType)}>
                        {event.eventType}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        Block {event.blockNumber}
                      </span>
                    </div>
                    
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="font-medium">Escrow:</span> 
                        <span className="ml-2 font-mono text-xs">{event.escrowAddress}</span>
                      </div>
                      <div>
                        <span className="font-medium">Hashlock:</span> 
                        <span className="ml-2 font-mono text-xs">{event.hashlock}</span>
                      </div>
                      {event.amount && (
                        <div>
                          <span className="font-medium">Amount:</span> 
                          <span className="ml-2">{formatAmount(event.amount)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right text-sm text-gray-500">
                    <div>{formatTimestamp(event.createdAt)}</div>
                    <div className="font-mono text-xs">
                      <a 
                        href={`https://etherscan.io/tx/${event.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {event.txHash.slice(0, 10)}...
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration Info */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Activity className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-800 mb-1">
                ✅ Backend API Integration Active
              </p>
              <p className="text-blue-700">
                This dashboard now fetches events from the backend API instead of directly monitoring the blockchain. 
                The cronjob service handles event monitoring and storage, preventing API timeouts.
              </p>
              <div className="mt-2 text-xs text-blue-600">
                • Events refresh every 30 seconds<br/>
                • Cronjob monitors blockchain every 30 seconds<br/>
                • No more API spam or timeouts
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
