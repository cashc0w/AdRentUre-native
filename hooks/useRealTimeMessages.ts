import { useEffect, useState, useCallback, useRef } from "react";
import type { DirectusMessage, DirectusConversation } from "../lib/directus";
import {
  subscribeToMessages,
  publishMessage,
  AblyMessage,
  getAblyInstance,
} from "../lib/ably";

export function useRealTimeMessages(conversationId: string) {
  const [messages, setMessages] = useState<DirectusMessage[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 3;
  const connectionCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sentMessagesRef = useRef<Set<string>>(new Set());
  const connectFnRef = useRef<(() => Promise<void>) | null>(null);

  // Convert Ably message to Directus format
  const convertAblyToDirectusMessage = useCallback(
    (ablyMessage: AblyMessage): DirectusMessage => ({
      id: ablyMessage.id,
      message: ablyMessage.message,
      date_created: ablyMessage.timestamp,
      sender: {
        id: ablyMessage.senderId,
        user: { id: ablyMessage.senderId },
      } as any,
      conversation: {
        id: ablyMessage.conversationId,
      } as any,
    }),
    []
  );

  const cleanup = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (connectionCheckInterval.current) {
      clearInterval(connectionCheckInterval.current);
      connectionCheckInterval.current = null;
    }
    sentMessagesRef.current.clear();
  }, []);

  const handleReconnect = useCallback(() => {
    setIsConnected(false);
    if (reconnectAttempts < maxReconnectAttempts) {
      console.log(
        `Attempting to reconnect (${reconnectAttempts + 1
        }/${maxReconnectAttempts})...`
      );
      setReconnectAttempts((prev) => prev + 1);

      cleanup();

      reconnectTimeoutRef.current = setTimeout(() => {
        if (connectFnRef.current) {
          connectFnRef.current();
        }
      }, Math.min(1000 * Math.pow(2, reconnectAttempts), 10000)); // Exponential backoff
    } else {
      setError(new Error("Failed to connect after maximum attempts"));
    }
  }, [reconnectAttempts, maxReconnectAttempts, cleanup,]);

  const connect = useCallback(async () => {
    if (!conversationId) return;

    try {
      cleanup();
      const ably = getAblyInstance();

      // Monitor connection state
      const handleConnectionStateChange = (stateChange: any) => {
        console.log("Ably connection state:", stateChange.current);
        setIsConnected(stateChange.current === "connected");

        if (
          stateChange.current === "failed" ||
          stateChange.current === "suspended"
        ) {
          handleReconnect();
        }
      };

      ably.connection.on(handleConnectionStateChange);

      // Start periodic connection check
      connectionCheckInterval.current = setInterval(() => {
        if (ably.connection.state !== "connected") {
          console.log("Connection check failed, attempting reconnect...");
          handleReconnect();
        }
      }, 30000); // Check every 30 seconds

      const unsubscribe = await subscribeToMessages(
        conversationId,
        (message: AblyMessage) => {
          console.log("New message received:", message);
          // Only process messages for this conversation
          if (message.conversationId !== conversationId) {
            console.log(
              "Ignoring message for different conversation:",
              message.conversationId
            );
            return;
          }

          setMessages((prev) => {
            // If we've already added this message locally (we sent it), don't add it again
            if (sentMessagesRef.current.has(message.id)) {
              sentMessagesRef.current.delete(message.id); // Clean up the reference
              return prev;
            }
            // Check if message already exists
            if (prev.some((m) => m.id === message.id)) {
              return prev;
            }
            return [...prev, convertAblyToDirectusMessage(message)];
          });
        }
      );

      unsubscribeRef.current = () => {
        ably.connection.off(handleConnectionStateChange);
        unsubscribe();
      };

      setIsConnected(true);
      setReconnectAttempts(0);
      setError(null);
    } catch (err) {
      console.error("Error subscribing to messages:", err);
      handleReconnect();
    }
  }, [conversationId, cleanup, handleReconnect, convertAblyToDirectusMessage]);

  // Initialize connection
  useEffect(() => {
    connect();
    return cleanup;
  }, [conversationId, connect, cleanup]);

  // Store the connect function in the ref after it's defined
  useEffect(() => {
    connectFnRef.current = connect;
  }, [connect]);

  // Reset messages when conversation changes
  useEffect(() => {
    setMessages([]);
  }, [conversationId]);

  const sendMessage = useCallback(
    async (message: string, senderId: string) => {
      if (!conversationId) {
        throw new Error("No conversation selected");
      }

      if (!message.trim()) {
        throw new Error("Message cannot be empty");
      }

      if (message.length > 1000) {
        throw new Error("Message too long (max 1000 characters)");
      }

      // Try to reconnect if not connected
      if (!isConnected) {
        try {
          await connect();
          // Wait a bit for the connection to stabilize
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (err) {
          throw new Error(
            "Failed to establish real-time connection. Please try again."
          );
        }
      }

      try {
        const ablyMessage: AblyMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conversationId,
          senderId,
          message: message.trim(),
          timestamp: new Date().toISOString(),
        };

        // Add message to local state immediately
        const directusMessage = convertAblyToDirectusMessage(ablyMessage);
        setMessages((prev) => [...prev, directusMessage]);

        // Keep track of sent message ID to avoid duplication when we receive it back
        sentMessagesRef.current.add(ablyMessage.id);

        // Send the message
        await publishMessage(conversationId, ablyMessage);
        return ablyMessage;
      } catch (err) {
        console.error("Error sending message:", err);
        // Force reconnection on next attempt
        setIsConnected(false);
        throw err instanceof Error ? err : new Error("Failed to send message");
      }
    },
    [conversationId, isConnected, connect, convertAblyToDirectusMessage]
  );

  return {
    messages,
    sendMessage,
    error,
    isConnected,
    reconnectAttempts,
    maxReconnectAttempts,
  };
}
