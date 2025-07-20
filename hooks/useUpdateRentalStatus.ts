import { useEffect, useState } from "react";
import { updateRentalRequestStatus, getConversationByRentalRequest } from "../lib/directus";
import { useAuth } from "../contexts/AuthContext";
import { useClientWithUserID } from "./useClientWithUserID";
import { useConversationMessages } from "./useConversationMessages";
import { set } from "date-fns";

interface UseUpdateRentalStatusOptions {
  onSuccess?: (rentalId: string) => void;
  onError?: (error: Error) => void;
}

export function useUpdateRentalStatus(options: UseUpdateRentalStatusOptions = {}) {
  const { user } = useAuth();
  const userId = user?.id || '';
  const { client, loading: clientLoading } = useClientWithUserID(userId);
  const currentClientId = client?.id || '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [messageSent, setMessageSent] = useState(false);

  const {
    messages,
    sendMessage,
    isLoading,
    sending,
    error: messageError,
    isConnected: conversationConnected,
  } = useConversationMessages(conversationId || '', currentClientId);

   useEffect(() => {
      // Only send message if all required info is present and message hasn't been sent yet
      if (
        conversationId &&
        currentClientId &&
        pendingMessage &&
        !messageSent
      ) {
        (async () => {
          try {
            setLoading(true);
            await sendMessage(pendingMessage);
            setMessageSent(true);
          } catch (err) {
            const error = err as Error;
            setError(error);
            options.onError?.(error);
          } finally {
            setLoading(false);
          }
        })();
      }
    }, [conversationId, pendingMessage]);

  const updateStatus = async (
    requestId: string,
    status: "approved" | "rejected" | "completed" | "ongoing",
    token?: string
  ) => {

    const correspondingConversation = await getConversationByRentalRequest(requestId);
    setConversationId(correspondingConversation?.id || null);
    try {
      setLoading(true);
      setError(null);
      await updateRentalRequestStatus(requestId, status, token);
      setLoading(sending);
      
      setPendingMessage(`This rental's status has changed to ${status}.`);
      options.onSuccess?.(requestId);
    } catch (err) {
      const error = err as Error;
      setError(error);
      options.onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  return {
    updateStatus,
    loading,
    error,
  };
}
