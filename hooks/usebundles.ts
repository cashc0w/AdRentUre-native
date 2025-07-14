import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getCurrentClient,
  getBundles,
  createBundle,
  addGearToBundle,
  getGearListing,
  removeGearFromBundle as apiRemoveGearFromBundle,
  getRentalRequests,
  directus,
  checkAvailability,
  createBundleWithListings as apiCreateBundleWithListings
} from '../lib/directus';
import { readItem } from '@directus/sdk';
import { DirectusBundle } from '../lib/directus';

export const useBundles = () => {
  const { user } = useAuth();
  const [bundles, setBundles] = useState<DirectusBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBundles = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const currentClient = await getCurrentClient();
      if (!currentClient) {
        throw new Error('Not authenticated');
      }

      // 1. Fetch all bundles and all rental requests in parallel
      const [allBundles, allRequests] = await Promise.all([
        getBundles(currentClient.id),
        getRentalRequests(currentClient.id, 'renter')
      ]);

      // 2. Create a Set of bundle IDs that have already been requested
      const requestedBundleIds = new Set(allRequests.map(req => req.bundle.id));

      // 3. Filter out the bundles that have been requested
      const availableBundles = allBundles.filter(bundle => !requestedBundleIds.has(bundle.id));
      
      setBundles(availableBundles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bundles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBundles();
  }, [user]);

  const addToBundle = async (gearId: string, dates?: { startDate: Date | null, endDate: Date | null }) => {
    try {
      setError(null);
      const currentClient = await getCurrentClient();
      if (!currentClient) {
        throw new Error('Not authenticated');
      }

      const gear = await getGearListing(gearId);
      if (currentClient.id === gear.owner.id) {
        throw new Error('Cannot add own gear to bundle');
      }

      // Refresh bundles to ensure up-to-date
      const userBundles = await getBundles(currentClient.id);
      console.log("DEBUG [useBundles - addToBundle]: Bundles before adding:", JSON.stringify(userBundles, null, 2));
      console.log("DEBUG [useBundles - addToBundle]: Attempting to add gearId:", gearId);

      // Find existing bundle for this owner
      let targetBundle = userBundles.find(b => b.owner?.id === gear.owner.id);

      if (targetBundle?.gear_listings?.some(item => String((item as any).gear_listings_id?.id) === gearId)) {
        throw new Error('Gear already in bundle');
      }

      if (!targetBundle) {
        // If creating a new bundle, check dates and availability first.
        if (!dates?.startDate || !dates?.endDate) {
          throw new Error("Dates are required to create a new bundle.");
        }

        const isAvailable = await checkAvailability(gearId, dates.startDate.toISOString(), dates.endDate.toISOString());
        if (!isAvailable) {
          throw new Error("This item is not available for the selected dates.");
        }
        
        // Create new bundle
        targetBundle = await createBundle({
          renter: currentClient.id,
          owner: gear.owner.id,
          start_date: dates?.startDate?.toISOString(),
          end_date: dates?.endDate?.toISOString(),
        });
      }

      // Add gear to bundle (function handles append and owner check implicitly)
      const updatedBundle = await addGearToBundle(targetBundle.id, gearId);

      // Update local state intelligently instead of re-fetching everything
      setBundles(prevBundles => {
        const existingBundleIndex = prevBundles.findIndex(b => b.id === updatedBundle.id);

        if (existingBundleIndex !== -1) {
          // If bundle already exists, replace it with the updated one
          const newBundles = [...prevBundles];
          newBundles[existingBundleIndex] = updatedBundle;
          return newBundles;
        } else {
          // If it's a new bundle, add it to the list
          return [...prevBundles, updatedBundle];
        }
      });

      return updatedBundle;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to bundle');
      throw err;
    }
  };

  const removeFromBundle = async (bundleId: string, gearId: string) => {
    try {
      const { bundleDeleted } = await apiRemoveGearFromBundle(bundleId, gearId);

      if (bundleDeleted) {
        setBundles(prev => prev.filter(b => b.id !== bundleId));
      } else {
        // Fetch just the one updated bundle with all nested fields
        const updatedBundle = await directus.request(readItem('bundles', bundleId, {
          fields: [
            '*',
            'owner.*',
            'gear_listings.gear_listings_id.*',
            'gear_listings.gear_listings_id.gear_images.directus_files_id.*'
          ]
        }));
        setBundles(prev => prev.map(b => b.id === bundleId ? updatedBundle as DirectusBundle : b));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item from bundle');
      throw err;
    }
  };

  const createBundleWithItems = async (data: { ownerId: string; gearIds: string[]; startDate: Date; endDate: Date; }) => {
    const currentClient = await getCurrentClient();
    if (!currentClient) throw new Error("Not authenticated");

    await apiCreateBundleWithListings({
      renter: currentClient.id,
      owner: data.ownerId,
      startDate: data.startDate.toISOString(),
      endDate: data.endDate.toISOString(),
      gearIds: data.gearIds
    });

    // After creating, refetch bundles to update the main list
    fetchBundles();
  };

  return { bundles, loading, error, addToBundle, removeFromBundle, createBundleWithItems, refetch: fetchBundles };
};
