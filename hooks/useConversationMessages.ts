import { useEffect, useState, useCallback, useRef } from "react";
import type { DirectusMessage } from "../lib/directus";
import { getConversation, getConversationMessages, sendMessage as sendDirectusMessage } from "../lib/directus";
import { useGlobalMessages } from "../hooks/useGlobalMessages";

async function getOtherParticipant(conversationId: string, currentClientId: string): Promise<string> {
  const conversation = await getConversation(conversationId);
  return conversation.user_1.id === currentClientId
      ? conversation.user_2.id
      : conversation.user_1.id;
}

export function useConversationMessages(conversationId: string, currentClientId: string) {
  const [messages, setMessages] = useState<DirectusMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sending, setSending] = useState(false);
  const [otherParticipantId, setOtherParticipantId] = useState<string | null>(null);
  
  const { sendMessage: sendGlobalMessage, onMessageReceived, isConnected } = useGlobalMessages(currentClientId);
  const sentMessagesRef = useRef<Set<string>>(new Set());
  const currentConversationIdRef = useRef<string>('');

  // Load other participant when conversation changes
  useEffect(() => {
    if (!conversationId || !currentClientId) {
      setOtherParticipantId(null);
      return;
    }

    async function loadOtherParticipant() {
      try {
        const participantId = await getOtherParticipant(conversationId, currentClientId);
        setOtherParticipantId(participantId);
      } catch (err) {
        console.error("Error loading other participant:", err);
        setError(err instanceof Error ? err : new Error("Failed to load conversation participant"));
      }
    }

    loadOtherParticipant();
  }, [conversationId, currentClientId]);

  // Combined effect to handle conversation changes and message loading
  useEffect(() => {
    // Reset state when conversation changes
    if (currentConversationIdRef.current !== conversationId) {
      setMessages([]);
      setError(null);
      setIsLoading(true);
      sentMessagesRef.current.clear();
      currentConversationIdRef.current = conversationId;
    }

    // Load messages for the current conversation
    if (!conversationId) {
      setIsLoading(false);
      return;
    }

    async function loadMessages() {
      try {
        setIsLoading(true);
        setError(null);
        const initialMessages = await getConversationMessages(conversationId);
        console.log("Loaded initial messages for conversation:", conversationId, initialMessages);
        
        // Only set messages if this is still the current conversation
        if (currentConversationIdRef.current === conversationId) {
          setMessages(initialMessages);
        }
      } catch (err) {
        console.error("Error loading initial messages:", err);
        if (currentConversationIdRef.current === conversationId) {
          setError(err instanceof Error ? err : new Error("Failed to load messages"));
        }
      } finally {
        if (currentConversationIdRef.current === conversationId) {
          setIsLoading(false);
        }
      }
    }

    loadMessages();
  }, [conversationId]);

  // Listen for new messages
  useEffect(() => {
    if (!conversationId) return;

    const unsubscribe = onMessageReceived((message: DirectusMessage, messageConversationId: string) => {
      // Only process messages for this conversation
      if (messageConversationId !== conversationId) return;
      // Also check if this is still the current conversation
      if (currentConversationIdRef.current !== conversationId) return;

      console.log("Received message for conversation:", messageConversationId, message);

      setMessages(prev => {
        // If we sent this message, we might have already added it optimistically
        if (sentMessagesRef.current.has(message.id)) {
          sentMessagesRef.current.delete(message.id);
          return prev; // Don't add duplicate
        }

        // Check if message already exists
        if (prev.some(m => m.id === message.id)) {
          return prev;
        }

        // Add the new message
        return [...prev, message].sort((a, b) => 
          new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
        );
      });
    });

    return unsubscribe;
  }, [conversationId, onMessageReceived]);

  // Send message function
  const sendMessage = useCallback(async (messageText: string) => {
    if (!conversationId || !currentClientId) {
      throw new Error("Missing conversation or user ID");
    }

    if (!otherParticipantId) {
      throw new Error("Other participant not found");
    }

    if (!messageText.trim()) {
      throw new Error("Message cannot be empty");
    }

    setSending(true);
    setError(null);
    console.log("all consiitons met, sending message:", messageText, "to conversation:", conversationId);
    try {
      // Send via global real-time connection to the other participant
      const ablyMessage = await sendGlobalMessage(
        conversationId, 
        messageText, 
        currentClientId, 
        otherParticipantId
      );
      
      // Only add optimistic message if this is still the current conversation
      if (currentConversationIdRef.current === conversationId) {
        // Add to local state optimistically
        const optimisticMessage: DirectusMessage = {
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
        };

        // Track that we sent this message to avoid duplication
        sentMessagesRef.current.add(ablyMessage.id);
        
        setMessages(prev => [...prev, optimisticMessage].sort((a, b) => 
          new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
        ));
      }

      // Also persist to Directus
      await sendDirectusMessage({
        conversation: conversationId,
        sender: currentClientId,
        message: messageText.trim(),
      });

      console.log("Message sent successfully");
    } catch (err) {
      console.error("Failed to send message:", err);
      setError(err instanceof Error ? err : new Error("Failed to send message"));
      throw err;
    } finally {
      setSending(false);
    }
  }, [conversationId, currentClientId, otherParticipantId, sendGlobalMessage]);

  return {
    messages,
    sendMessage,
    isLoading,
    sending,
    error,
    isConnected,
  };
}