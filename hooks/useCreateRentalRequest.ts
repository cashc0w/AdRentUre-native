import { useState, useEffect, useRef } from "react";
import { createRentalRequest, createConversation, sendMessage as sendDirectusMessage, DirectusBundle } from "../lib/directus";
import { useConversationMessages } from "./useConversationMessages";

interface UseRentalRequestOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useRentalRequest(options: UseRentalRequestOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [renterId, setRenterId] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [messageSent, setMessageSent] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  
  // Use refs to track if we've already processed the message
  const messageProcessedRef = useRef(false);
  const conversationIdRef = useRef<string | null>(null);

  // Always call the hook at the top level
  const {
    sendMessage,
    isLoading: messagesLoading,
    sending,
    error: messageError,
    isConnected: conversationConnected,
  } = useConversationMessages(conversationId || "", renterId || "");

  // Reset refs when conversation changes
  useEffect(() => {
    if (conversationIdRef.current !== conversationId) {
      messageProcessedRef.current = false;
      conversationIdRef.current = conversationId;
    }
  }, [conversationId]);

  useEffect(() => {
    // Only send message if all required info is present and message hasn't been processed yet
    if (
      conversationId &&
      renterId &&
      ownerId &&
      pendingMessage &&
      !messageProcessedRef.current &&
      !messageSent &&
      !loading &&
      !messagesLoading
    ) {
      messageProcessedRef.current = true; // Mark as processing immediately
      
      const sendPendingMessage = async () => {
        try {
          console.log("Attempting to send message:", pendingMessage);
          console.log("Connection status:", conversationConnected);
          
          // Add a small delay to ensure conversation is fully created
          await new Promise(resolve => setTimeout(resolve, 500));
          
          await sendMessage(pendingMessage);
          setMessageSent(true);
          console.log("Message sent successfully in rental request");
          options.onSuccess?.();
        } catch (err) {
          console.error("Failed to send message in rental request:", err);
          const error = err as Error;
          setError(error);
          messageProcessedRef.current = false; // Reset so we can try again
          options.onError?.(error);
        }
      };

      sendPendingMessage();
    }
  }, [
    conversationId,
    renterId,
    ownerId,
    pendingMessage,
    messageSent,
    loading,
    messagesLoading,
    sendMessage,
    conversationConnected,
    options.onSuccess,
    options.onError
  ]);

  const submitRequest = async (data: {
    bundle: DirectusBundle;
    renter: string;
    owner: string;
    message?: string;
  }) => {
    if (!data.bundle.start_date || !data.bundle.end_date) {
      throw new Error("Bundle must have a start and end date.");
    }

    try {
      setLoading(true);
      setError(null);
      setMessageSent(false);
      messageProcessedRef.current = false; // Reset the ref
      
      const rentalRequest = await createRentalRequest({
        bundle: data.bundle.id,
        renter: data.renter,
        owner: data.owner,
        start_date: data.bundle.start_date,
        end_date: data.bundle.end_date,
      });

      if (data.renter === data.owner) {
        throw new Error('Renter and owner cannot be the same user');
      }
      
      const conversationData = {
        user_1: data.renter,
        user_2: data.owner,
        rental_request: rentalRequest.id,
      };
      
      const conversation = await createConversation(conversationData);
      console.log("Conversation created:", conversation.id);

      const bundleTitle = data.bundle.gear_listings?.map(item => (item as any).gear_listings_id?.title).filter(Boolean).join(', ');

      // Set all the required state at once
      setConversationId(conversation.id);
      setRenterId(data.renter);
      setOwnerId(data.owner);
      setPendingMessage(
        data.message?.trim()
          ? data.message.trim()
          : `This is an automated message to inform you of a new rental request for your bundle: ${bundleTitle}. Please review the request and respond at your earliest convenience.`
      );
      
      setLoading(false);
    } catch (err) {
      const error = err as Error;
      setError(error);
      setLoading(false);
      messageProcessedRef.current = false; // Reset on error
      options.onError?.(error);
    }
  };

  return {
    submitRequest,
    loading: loading || sending,
    error: error || messageError,
  };
}