import { useState } from "react";
import { createRentalRequest, createConversation, sendMessage, DirectusBundle } from "../lib/directus";

interface UseRentalRequestOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useRentalRequest(options: UseRentalRequestOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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
      }
      const conversation = await createConversation(conversationData);

      const bundleTitle = data.bundle.gear_listings?.map(item => (item as any).gear_listings_id?.title).filter(Boolean).join(', ');

      const messageCreated = await sendMessage({
        conversation: conversation.id,
        sender: data.renter,
        message: data.message?.trim() ?
          data.message.trim() :
          `This is an automated message to inform you of a new rental request for your bundle: ${bundleTitle}. Please review the request and respond at your earliest convenience.`,
      });

      options.onSuccess?.();
    } catch (err) {
      const error = err as Error;
      setError(error);
      options.onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  return {
    submitRequest,
    loading,
    error,
  };
}
