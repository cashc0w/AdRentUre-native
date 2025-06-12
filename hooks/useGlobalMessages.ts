import { useEffect, useState, useCallback, useRef } from "react";
import type { DirectusMessage } from "../lib/directus";
import {
  subscribeToMessages,
  publishMessage,
  AblyMessage,
  getAblyInstance,
} from "../lib/ably";

// Global state to manage Ably connection across the app
let globalAblyConnection: {
  isConnected: boolean;
  subscriptions: Map<string, Set<(message: DirectusMessage) => void>>;
  unsubscribeFunctions: Map<string, () => void>;
} = {
  isConnected: false,
  subscriptions: new Map(),
  unsubscribeFunctions: new Map(),
};

export function useGlobalMessages(userConversationIds: string[] = []) {
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

  // Subscribe to a specific conversation
  const subscribeToConversation = useCallback(async (conversationId: string) => {
    if (globalAblyConnection.unsubscribeFunctions.has(conversationId)) {
      return; // Already subscribed
    }

    try {
      console.log(`Subscribing to conversation: ${conversationId}`);
      
      const unsubscribe = await subscribeToMessages(
        conversationId,
        (ablyMessage: AblyMessage) => {
          console.log("Global message received:", ablyMessage);
          
          const directusMessage = convertAblyToDirectusMessage(ablyMessage);
          
          // Notify all registered callbacks
          messageCallbacksRef.current.forEach(callback => {
            callback(directusMessage, conversationId);
          });
        }
      );

      globalAblyConnection.unsubscribeFunctions.set(conversationId, unsubscribe);
      console.log(`Successfully subscribed to conversation: ${conversationId}`);
    } catch (err) {
      console.error(`Error subscribing to conversation ${conversationId}:`, err);
      setError(err instanceof Error ? err : new Error("Failed to subscribe to conversation"));
    }
  }, [convertAblyToDirectusMessage]);

  // Unsubscribe from a specific conversation
  const unsubscribeFromConversation = useCallback((conversationId: string) => {
    const unsubscribe = globalAblyConnection.unsubscribeFunctions.get(conversationId);
    if (unsubscribe) {
      console.log(`Unsubscribing from conversation: ${conversationId}`);
      unsubscribe();
      globalAblyConnection.unsubscribeFunctions.delete(conversationId);
    }
  }, []);

  // Initialize global connection
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
      };

      ably.connection.on(handleConnectionStateChange);
      
      // Set initial connection state
      setIsConnected(ably.connection.state === "connected");
      globalAblyConnection.isConnected = ably.connection.state === "connected";

    } catch (err) {
      console.error("Error initializing global Ably connection:", err);
      setError(err instanceof Error ? err : new Error("Failed to initialize connection"));
    }
  }, []);

  // Subscribe to all user conversations
  useEffect(() => {
    if (userConversationIds.length === 0) return;

    // Initialize connection if not already done
    if (!globalAblyConnection.isConnected) {
      initializeGlobalConnection();
    }

    // Get current subscriptions
    const currentSubscriptions = new Set(globalAblyConnection.unsubscribeFunctions.keys());
    const newConversations = new Set(userConversationIds);

    // Unsubscribe from conversations that are no longer in the list
    currentSubscriptions.forEach(conversationId => {
      if (!newConversations.has(conversationId)) {
        unsubscribeFromConversation(conversationId);
      }
    });

    // Subscribe to new conversations
    newConversations.forEach(conversationId => {
      if (!currentSubscriptions.has(conversationId)) {
        subscribeToConversation(conversationId);
      }
    });

  }, [userConversationIds, initializeGlobalConnection, subscribeToConversation, unsubscribeFromConversation]);

  // Initialize connection on mount
  useEffect(() => {
    initializeGlobalConnection();
  }, [initializeGlobalConnection]);

  // Register a callback for receiving messages
  const onMessageReceived = useCallback((callback: (message: DirectusMessage, conversationId: string) => void) => {
    messageCallbacksRef.current.add(callback);
    
    return () => {
      messageCallbacksRef.current.delete(callback);
    };
  }, []);

  // Send message function
  const sendMessage = useCallback(
    async (conversationId: string, message: string, senderId: string) => {
      if (!message.trim()) {
        throw new Error("Message cannot be empty");
      }

      if (message.length > 1000) {
        throw new Error("Message too long (max 1000 characters)");
      }

      if (!globalAblyConnection.isConnected) {
        throw new Error("Not connected to real-time service");
      }

      try {
        const ablyMessage: AblyMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conversationId,
          senderId,
          message: message.trim(),
          timestamp: new Date().toISOString(),
        };

        await publishMessage(conversationId, ablyMessage);
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