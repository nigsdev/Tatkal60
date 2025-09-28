// src/components/EventBusStatus.tsx
import { useState } from 'react';
import { Wifi, WifiOff, Clock } from 'lucide-react';

interface EventBusStatusProps {
  status: { connected: boolean; mode: 'websocket' | 'polling' };
  className?: string;
}

export default function EventBusStatus({ status, className = '' }: EventBusStatusProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusColor = () => {
    if (status.connected && status.mode === 'websocket') {
      return 'text-green-400';
    } else if (status.connected && status.mode === 'polling') {
      return 'text-yellow-400';
    } else {
      return 'text-red-400';
    }
  };

  const getStatusIcon = () => {
    if (status.connected && status.mode === 'websocket') {
      return <Wifi size={14} className="text-green-400" />;
    } else if (status.connected && status.mode === 'polling') {
      return <Clock size={14} className="text-yellow-400" />;
    } else {
      return <WifiOff size={14} className="text-red-400" />;
    }
  };

  const getStatusText = () => {
    if (status.connected && status.mode === 'websocket') {
      return 'Live';
    } else if (status.connected && status.mode === 'polling') {
      return 'Polling';
    } else {
      return 'Offline';
    }
  };

  const getStatusDescription = () => {
    if (status.connected && status.mode === 'websocket') {
      return 'Real-time updates via WebSocket';
    } else if (status.connected && status.mode === 'polling') {
      return 'Updates every 4 seconds';
    } else {
      return 'No connection available';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors duration-200 hover:bg-white/10 ${getStatusColor()}`}
        title={getStatusDescription()}
      >
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </button>

      {showDetails && (
        <div className="absolute top-full right-0 mt-1 p-3 bg-black/90 border border-white/20 rounded-lg shadow-lg z-50 min-w-48">
          <div className="text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Connection:</span>
              <span className={getStatusColor()}>{getStatusText()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Mode:</span>
              <span className="text-white capitalize">{status.mode}</span>
            </div>
            <div className="text-gray-400 text-xs">
              {getStatusDescription()}
            </div>
            {status.mode === 'polling' && (
              <div className="text-gray-400 text-xs">
                WebSocket not available, using polling fallback
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
