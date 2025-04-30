import { useState, useEffect } from "react";
import { directus } from "../lib/directus";
import { readItems } from "@directus/sdk";

interface UseDirectusItemsOptions {
  collection: string;
  params?: {
    fields?: string[];
    filter?: Record<string, any>;
    sort?: string[];
    limit?: number;
    page?: number;
  };
}

export function useDirectusItems<T>(options: UseDirectusItemsOptions) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await directus.request(
          readItems(options.collection, {
            fields: options.params?.fields,
            filter: options.params?.filter,
            sort: options.params?.sort,
            limit: options.params?.limit,
            page: options.params?.page,
          })
        );
        setData(response as T[]);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [options.collection, options.params]);

  return { data, loading, error };
}
