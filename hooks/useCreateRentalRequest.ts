import { useState, useEffect } from "react";
import { createRentalRequest, createConversation, sendMessage as sendDirectusMessage, DirectusBundle } from "../lib/directus";
import { useConversationMessages } from "./useConversationMessages";
import { set } from "date-fns";

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

  // Always call the hook at the top level
  const {
    sendMessage,
    isLoading: messagesLoading,
    sending,
    error: messageError,
    isConnected: conversationConnected,
  } = useConversationMessages(conversationId || "", renterId || "");

  useEffect(() => {
    // Only send message if all required info is present and message hasn't been sent yet
    if (
      conversationId &&
      renterId &&
      pendingMessage &&
      !messageSent
    ) {
      (async () => {
        try {
          setLoading(true);
          await sendMessage(pendingMessage);
          setMessageSent(true);
          options.onSuccess?.();
        } catch (err) {
          const error = err as Error;
          setError(error);
          options.onError?.(error);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [conversationId, renterId, pendingMessage]);

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

      const bundleTitle = data.bundle.gear_listings?.map(item => (item as any).gear_listings_id?.title).filter(Boolean).join(', ');

      // Prepare message to send after conversation is created
      setConversationId(conversation.id);
      setRenterId(data.renter);
      setPendingMessage(
        data.message?.trim()
          ? data.message.trim()
          : `This is an automated message to inform you of a new rental request for your bundle: ${bundleTitle}. Please review the request and respond at your earliest convenience.`
      );
    } catch (err) {
      const error = err as Error;
      setError(error);
      setLoading(false);
      options.onError?.(error);
    }
  };

  return {
    submitRequest,
    loading: loading || messagesLoading,
    error: error || messageError,
  };
}
