import { useState, useEffect } from 'react';
import { FundData, fetchFundData } from '../utils/fundDataFetcher';

// Add this at the top of your file, outside the hook
let activeConnection = null;
let connectionAttemptTime = 0;
const MIN_RECONNECT_INTERVAL = 5000; // 5 seconds

export function useMonitorWebSocket(
  isConnected: boolean,
  setProjects: React.Dispatch<React.SetStateAction<FundData[]>>,
  addToast: (message: string) => void
) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isWsConnected, setIsWsConnected] = useState(false);

  useEffect(() => {
    if (!isConnected) return;
    
    // Prevent frequent reconnection attempts
    const now = Date.now();
    if (now - connectionAttemptTime < MIN_RECONNECT_INTERVAL) {
      console.log('Throttling connection attempts');
      return;
    }
    
    connectionAttemptTime = now;
    
    // Only create a new connection if there isn't one already
    if (activeConnection) {
      console.log('Using existing WebSocket connection');
      setSocket(activeConnection);
      setIsWsConnected(true);
      return;
    }
    
    console.log('Creating new WebSocket connection');
    const ws = new WebSocket('ws://localhost:3001');
    activeConnection = ws;
    
    // Define processMessage inside useEffect to prevent stale closures
    const processMessage = async (message) => {
      if (message.type === 'new_fund') {
        // Handle new fund creation
        const { address, name } = message.data;
        addToast(`New fund created: ${name}`);
        
        // Fetch the fund data
        const fundData = await fetchFundData(address);
        if (fundData) {
          setProjects(prev => {
            if (prev.some(p => p.address === address)) return prev;
            return [...prev, fundData];
          });
        }
      } 
      else if (message.type === 'connection_status') {
        console.log('Monitor connection status:', message.data.connected);
      }
    };
    
    ws.onopen = () => {
      console.log('Connected to monitor server');
      setIsWsConnected(true);
    };
    
    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Received websocket message:', message);
        
        if (message.type === 'batch_update') {
          // Handle batched updates
          console.log(`Processing batched update with ${message.updates.length} items`);
          
          // Process each update in the batch
          for (const update of message.updates) {
            await processMessage(update);
          }
        } else {
          // Process individual message
          await processMessage(message);
        }
      } catch (error) {
        console.error('Error processing websocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsWsConnected(false);
    };
    
    ws.onclose = () => {
      console.log('Disconnected from monitor server');
      setIsWsConnected(false);
    };
    
    setSocket(ws);
    
    return () => {
      // Only close if we're unmounting the app completely
      if (ws && !document.hidden) {
        console.log('Keeping WebSocket connection alive for app');
        // Don't actually close it
      } else {
        ws.close();
        activeConnection = null;
      }
    };
  }, [isConnected, setProjects, addToast]);

  return { isWsConnected };
} 