import { useState, useEffect } from "react";
import { FundData, fetchFundData } from "../utils/fundDataFetcher";

// Add this at the top of your file, outside the hook
let activeConnection: WebSocket | null = null;
let connectionAttemptTime = 0;
const MIN_RECONNECT_INTERVAL = 5000; // 5 seconds

// Track funds we've already processed to avoid duplicates
let processedFunds = new Set<string>();

export function useMonitorWebSocket(
  isConnected: boolean,
  setProjects: React.Dispatch<React.SetStateAction<FundData[]>>,
  addToast: (message: string) => void,
) {
  const [isWsConnected, setIsWsConnected] = useState(false);

  useEffect(() => {
    if (!isConnected) return;

    // Prevent frequent reconnection attempts
    const now = Date.now();
    if (
      now - connectionAttemptTime < MIN_RECONNECT_INTERVAL &&
      !activeConnection
    ) {
      console.log("Skipping connection attempt (too frequent)");
      return;
    }

    connectionAttemptTime = now;

    if (activeConnection) {
      console.log("Using existing WebSocket connection");
      setIsWsConnected(true);
      return;
    }

    console.log("Creating new WebSocket connection");
    const ws = new WebSocket("wss://your-websocket-server.com");

    ws.onclose = () => {
      console.log("WebSocket connection closed");
      activeConnection = null;
      setIsWsConnected(false);
    };

    // Define processMessage inside useEffect to prevent stale closures
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processMessage = async (message: any) => {
      if (message.type === "new_fund") {
        const { address, name } = message.data;
        
        // Skip if we've already processed this fund
        if (processedFunds.has(address)) {
          console.log(`Skipping already processed fund: ${name} (${address})`);
          return;
        }
        
        // Mark as processed
        processedFunds.add(address);
        
        // Show only one toast notification
        addToast(`New fund created: ${name}`);
        
        // Check if we have a saved image URL for this fund
        let savedImage = "";
        try {
          const fundImages = JSON.parse(localStorage.getItem('fundImages') || '{}');
          savedImage = fundImages[name] || "";
        } catch (e) {
          console.error("Error retrieving saved image:", e);
        }
        
        // Fetch the fund data
        const fundData = await fetchFundData(address);
        if (fundData) {
          // If we had a saved image URL, use it instead of the generated one
          if (savedImage) {
            fundData.image = savedImage;
          }
          
          setProjects(prev => {
            if (prev.some(p => p.address === address)) return prev;
            return [...prev, fundData];
          });
        }
      } else if (message.type === "connection_status") {
        console.log("Monitor connection status:", message.data.connected);
      }
    };

    ws.onopen = () => {
      console.log("Connected to monitor server");
      setIsWsConnected(true);
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("Received websocket message:", message);

        if (message.type === "batch_update") {
          // Handle batched updates
          console.log(
            `Processing batched update with ${message.updates.length} items`,
          );

          // Process each update in the batch
          for (const update of message.updates) {
            await processMessage(update);
          }
        } else {
          // Process individual message
          await processMessage(message);
        }
      } catch (error) {
        console.error("Error processing websocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsWsConnected(false);
    };

    return () => {
      // Only close if we're unmounting the app completely
      if (ws && !document.hidden) {
        console.log("Keeping WebSocket connection alive for app");
        // Don't actually close it
      } else {
        ws.close();
        activeConnection = null;
      }
    };
  }, [isConnected, setProjects, addToast]);

  return { isWsConnected };
}
