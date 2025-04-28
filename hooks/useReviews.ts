import { useState, useEffect } from "react";
import { getReviews, DirectusReview } from "@/lib/directus";

interface UseReviewsOptions {
  clientId?: string;
}

export function useReviews(options: UseReviewsOptions = {}) {
  const [reviews, setReviews] = useState<DirectusReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchReviews() {
      if (!options.clientId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await getReviews(options.clientId);
        console.log("Reviews response in useReviews: ", response);
        setReviews(response.response || []);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchReviews();
  }, [options.clientId]);

  return {
    reviews,
    loading,
    error,
  };
}
