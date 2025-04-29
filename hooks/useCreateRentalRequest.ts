import { useState } from "react";
import { createRentalRequest, createConversation, sendMessage } from "../lib/directus";

interface UseRentalRequestOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useRentalRequest(options: UseRentalRequestOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submitRequest = async (data: {
    gear_listing: string;
    renter: string;
    owner: string;
    start_date: string;
    end_date: string;
    message?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);
      await createRentalRequest({
        gear_listing: data.gear_listing,
        renter: data.renter,
        owner: data.owner,
        start_date: data.start_date,
        end_date: data.end_date,
      });
      // Create or get conversation
      if(data.renter === data.owner) {
        throw new Error('Renter and owner cannot be the same user');}
      const conversationData = {
        user_1: data.renter,
        user_2: data.owner,
        gear_listing: data.gear_listing,
      }
      const conversation = await createConversation(conversationData);
      console.log('Conversation created:', conversation);
  
      // If initial message is provided, send it
      if (data.message?.trim()) {
        const messageCreated = await sendMessage({
          conversation: conversation.id,
          sender: data.renter,
          message: data.message?.trim()
        });
        console.log('Message sent:', messageCreated);
      }
      
  
      // alert('Rental request submitted successfully!');
      // router.push('/rentals/requests');
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
