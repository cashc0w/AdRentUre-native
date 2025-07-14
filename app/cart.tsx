import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Image, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useBundles } from '../hooks/usebundles';
import { useRouter, useFocusEffect } from 'expo-router';
import { createRentalRequest, getCurrentClient } from '../lib/directus';
import { useRentalRequest } from '../hooks/useCreateRentalRequest';
import { DirectusBundle } from '../lib/directus';

export default function CartPage() {
    const { bundles, loading, error, removeFromBundle, refetch } = useBundles();
    const router = useRouter();
    const [removingItemId, setRemovingItemId] = useState<string | null>(null);
    const [requestingBundleId, setRequestingBundleId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Record<string, string>>({});
    const { submitRequest, loading: rentalRequestLoading } = useRentalRequest({
        onSuccess: () => {
            Alert.alert('Success', 'Your request has been sent!');
            refetch(); // Refetch to remove the requested bundle from the cart view
        },
        onError: (err) => {
            Alert.alert('Error', err.message);
        }
    });

    // useFocusEffect will run the refetch function every time the screen comes into focus.
    useFocusEffect(
      useCallback(() => {
        refetch();
      }, [])
    );

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        // Add a 'T00:00:00' to ensure the date is parsed in the local timezone
        const date = new Date(dateString.split('T')[0] + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const getImageUrl = (gear: any) => {
        const imageId = gear?.gear_images?.[0]?.directus_files_id?.id;
        return imageId ? `https://creative-blini-b15912.netlify.app/assets/${imageId}?width=150&height=150&fit=cover` : 'https://via.placeholder.com/150';
    };

    const handleRemove = async (bundleId: string, gearId: string) => {
        setRemovingItemId(gearId);
        try {
            await removeFromBundle(bundleId, gearId);
        } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to remove item');
        } finally {
            setRemovingItemId(null);
        }
    };

    const handleRequestBundle = async (bundle: DirectusBundle) => {
        setRequestingBundleId(bundle.id);
        try {
            const currentClient = await getCurrentClient();
            if (!currentClient) throw new Error('Could not find current client.');

            await submitRequest({
                bundle: bundle,
                renter: currentClient.id,
                owner: bundle.owner.id,
                message: messages[bundle.id] || '',
            });
        } catch (err) {
            // Error is handled by the hook's onError callback
        } finally {
            setRequestingBundleId(null);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="#22c55e" />
            </View>
        );
    }

    if (error) {
        return (
            <View className="flex-1 justify-center items-center p-4 bg-white">
                <Text className="text-red-500 text-center">Error loading your cart: {error}</Text>
            </View>
        );
    }

    if (!bundles || bundles.length === 0) {
        return (
            <View className="flex-1 justify-center items-center p-4 bg-gray-50">
                <Text className="text-xl font-semibold text-gray-700 mb-2">Your Cart is Empty</Text>
                <Text className="text-gray-500 text-center mb-6">Looks like you haven't added any gear yet. Start exploring!</Text>
                <TouchableOpacity
                    onPress={() => router.push('/gear/browse')}
                    className="bg-green-600 px-6 py-3 rounded-lg"
                >
                    <Text className="text-white font-bold">Browse Gear</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView className="flex-1 bg-gray-50">
            <View className="p-4 pt-12 bg-white border-b border-gray-200">
                <Text className="text-3xl font-bold text-gray-900">Your Cart</Text>
            </View>

            <View className="p-4">
                {bundles.map(bundle => (
                    <View key={bundle.id} className="mb-6 bg-white rounded-lg shadow-md p-4">
                        <Text className="text-lg font-semibold text-gray-800 mb-1">
                            Items from: {bundle.owner?.first_name || '...'} {bundle.owner?.last_name || '...'}
                        </Text>
                        
                        {bundle.start_date && bundle.end_date && (
                            <View className="flex-row items-center bg-gray-100 p-2 rounded-md mb-3">
                                <Text className="text-gray-600 font-medium">📅 Dates: </Text>
                                <Text className="text-gray-800 font-semibold ml-1">{formatDate(bundle.start_date)}</Text>
                                <Text className="text-gray-600 font-medium mx-1"> to </Text>
                                <Text className="text-gray-800 font-semibold">{formatDate(bundle.end_date)}</Text>
                            </View>
                        )}

                        {bundle.gear_listings?.map(item => {
                            const gear = (item as any).gear_listings_id;
                            if (!gear) return null;
                            const isRemoving = removingItemId === gear.id;
                            return (
                                <View key={gear.id} className="flex-row items-center mb-4 border-b border-gray-100 pb-4">
                                    <TouchableOpacity 
                                      onPress={() => router.push(`/gear/${gear.id}`)}
                                      className="flex-row items-center flex-1"
                                    >
                                        <Image
                                            source={{ uri: getImageUrl(gear) }}
                                            className="w-20 h-20 rounded-md bg-gray-200"
                                        />
                                        <View className="flex-1 ml-4">
                                            <Text className="font-semibold text-gray-700" numberOfLines={2}>{gear.title}</Text>
                                            <Text className="text-green-600 font-bold mt-1">${gear.price}/day</Text>
                                        </View>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={() => handleRemove(bundle.id, gear.id)}
                                        disabled={isRemoving}
                                        className="p-2 ml-2"
                                    >
                                        {isRemoving ? <ActivityIndicator size="small" /> : <Text className="text-red-500 text-2xl">🗑️</Text>}
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                        <View className="mt-4">
                            <Text className="text-sm font-medium text-gray-700 mb-1">Message (Optional)</Text>
                            <TextInput
                                value={messages[bundle.id] || ''}
                                onChangeText={(text) => setMessages(prev => ({ ...prev, [bundle.id]: text }))}
                                placeholder="Add a message to the owner..."
                                multiline
                                numberOfLines={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                                textAlignVertical="top"
                            />
                        </View>
                        <TouchableOpacity
                            onPress={() => handleRequestBundle(bundle)}
                            disabled={rentalRequestLoading && requestingBundleId === bundle.id}
                            className={`w-full py-3 rounded-lg mt-2 ${rentalRequestLoading && requestingBundleId === bundle.id ? 'bg-gray-400' : 'bg-blue-500'}`}
                        >
                            <Text className="text-white text-center font-semibold">
                                {rentalRequestLoading && requestingBundleId === bundle.id ? 'Requesting...' : 'Request Bundle'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
} 