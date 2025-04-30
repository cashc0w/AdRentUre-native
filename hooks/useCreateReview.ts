import { useState } from "react";
import { createReview } from "../lib/directus";

interface UseCreateReviewOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useCreateReview(options: UseCreateReviewOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submitReview = async (data: {
    rental_request: string;
    reviewer: string;
    reviewed: string;
    rating: number;
    comment: string;
  }) => {
    try {
      setLoading(true);
      setError(null);
      await createReview(data);
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
    submitReview,
    loading,
    error,
  };
}
