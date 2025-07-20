import { useEffect, useState, useCallback, useRef } from "react";
import type { DirectusMessage } from "../lib/directus";
import {
  subscribeToClientMessages,
  publishMessageToClient,
  AblyMessage,
  getAblyInstance,
} from "../lib/ably";

// Global state to manage Ably connection across the app
let globalAblyConnection: {
  isConnected: boolean;
  currentClientSubscription: string | null;
  unsubscribeFunction: (() => void) | null;
} = {
  isConnected: false,
  currentClientSubscription: null,
  unsubscribeFunction: null,
};

export function useGlobalMessages(currentUserId: string) {
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const messageCallbacksRef = useRef<Set<(message: DirectusMessage, conversationId: string) => void>>(new Set());

  // Convert Ably message to Directus format
  const convertAblyToDirectusMessage = useCallback(
    (ablyMessage: AblyMessage): DirectusMessage => ({
      id: ablyMessage.id,
      message: ablyMessage.message,
      date_created: ablyMessage.timestamp,
      sender: {
        id: ablyMessage.senderId,
        user: { 
          id: ablyMessage.senderId,
          first_name: "",
          last_name: "",
          email: ""
        },
      } as any,
      conversation: {
        id: ablyMessage.conversationId,
      } as any,
    }),
    []
  );

  // Subscribe to the current user's client channel
  const subscribeToUserChannel = useCallback(async (userId: string) => {
    // If already subscribed to this user, return
    if (globalAblyConnection.currentClientSubscription === userId) {
      return;
    }

    // Unsubscribe from previous subscription if exists
    if (globalAblyConnection.unsubscribeFunction) {
      console.log(`Unsubscribing from previous client: ${globalAblyConnection.currentClientSubscription}`);
      globalAblyConnection.unsubscribeFunction();
      globalAblyConnection.unsubscribeFunction = null;
      globalAblyConnection.currentClientSubscription = null;
    }

    try {
      console.log(`Subscribing to user channel: ${userId}`);
      
      const unsubscribe = await subscribeToClientMessages(
        userId,
        (ablyMessage: AblyMessage) => {
          console.log("Global message received for user:", userId, ablyMessage);
          
          const directusMessage = convertAblyToDirectusMessage(ablyMessage);
          
          // Notify all registered callbacks
          messageCallbacksRef.current.forEach(callback => {
            callback(directusMessage, ablyMessage.conversationId);
          });
        }
      );

      globalAblyConnection.unsubscribeFunction = unsubscribe;
      globalAblyConnection.currentClientSubscription = userId;
      console.log(`Successfully subscribed to user channel: ${userId}`);
    } catch (err) {
      console.error(`Error subscribing to user channel ${userId}:`, err);
      setError(err instanceof Error ? err : new Error("Failed to subscribe to user channel"));
    }
  }, [convertAblyToDirectusMessage]);

  // Initialize global connection and subscribe to user channel
  const initializeGlobalConnection = useCallback(async () => {
    try {
      const ably = getAblyInstance();
      
      // Monitor global connection state
      const handleConnectionStateChange = (stateChange: any) => {
        console.log("Global Ably connection state:", stateChange.current);
        const connected = stateChange.current === "connected";
        setIsConnected(connected);
        globalAblyConnection.isConnected = connected;

        if (stateChange.current === "failed" || stateChange.current === "suspended") {
          setError(new Error(`Connection ${stateChange.current}: ${stateChange.reason}`));
        } else {
          setError(null);
        }

        // If connected and we have a user ID, ensure we're subscribed
        if (connected && currentUserId) {
          subscribeToUserChannel(currentUserId);
        }
      };

      ably.connection.on(handleConnectionStateChange);
      
      // Set initial connection state
      const initialConnected = ably.connection.state === "connected";
      setIsConnected(initialConnected);
      globalAblyConnection.isConnected = initialConnected;

      // If already connected and we have a user ID, subscribe immediately
      if (initialConnected && currentUserId) {
        await subscribeToUserChannel(currentUserId);
      }

    } catch (err) {
      console.error("Error initializing global Ably connection:", err);
      setError(err instanceof Error ? err : new Error("Failed to initialize connection"));
    }
  }, [currentUserId, subscribeToUserChannel]);

  // Initialize connection and subscribe when user ID changes
  useEffect(() => {
    if (!currentUserId) return;

    initializeGlobalConnection();
  }, [currentUserId, initializeGlobalConnection]);

  // Register a callback for receiving messages
  const onMessageReceived = useCallback((callback: (message: DirectusMessage, conversationId: string) => void) => {
    messageCallbacksRef.current.add(callback);
    
    return () => {
      messageCallbacksRef.current.delete(callback);
    };
  }, []);

  // Send message function - publishes to the receiver's channel
  const sendMessage = useCallback(
    async (conversationId: string, message: string, senderId: string, receiverId: string) => {
      if (!message.trim()) {
        throw new Error("Message cannot be empty");
      }

      if (message.length > 1000) {
        throw new Error("Message too long (max 1000 characters)");
      }

      if (!globalAblyConnection.isConnected) {
        throw new Error("Not connected to real-time service");
      }

      if (!receiverId) {
        throw new Error("Receiver ID is required");
      }

      try {
        const ablyMessage: AblyMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conversationId,
          senderId,
          receiverId,
          message: message.trim(),
          timestamp: new Date().toISOString(),
        };

        // Publish to the receiver's channel
        await publishMessageToClient(`client:${receiverId}`, ablyMessage);
        return ablyMessage;
      } catch (err) {
        console.error("Error sending message:", err);
        throw err instanceof Error ? err : new Error("Failed to send message");
      }
    },
    []
  );

  return {
    sendMessage,
    onMessageReceived,
    isConnected,
    error,
  };
}