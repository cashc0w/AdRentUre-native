import React from 'react';
import { ScrollView, Pressable, View } from 'react-native';
import { Link } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol, IconSymbolName } from '@/components/ui/IconSymbol';
import InfiniteSlider from '@/components/InfiniteSlider';

interface Step {
  name: string;
  description: string;
  icon: IconSymbolName;
}

export default function HomeScreen() {
  const steps: Step[] = [
    {
      name: 'Find Gear',
      description: 'Browse through our collection of outdoor equipment from local adventurers.',
      icon: 'chevron.left.forwardslash.chevron.right',
    },
    {
      name: 'Request to Rent',
      description: 'Send a rental request to the owner with your desired dates.',
      icon: 'paperplane.fill',
    },
    {
      name: 'Meet & Rent',
      description: 'Arrange a meetup with the owner to pick up the gear and start your adventure.',
      icon: 'house.fill',
    },
  ];

  return (
    <ScrollView className="flex-1">
      {/* Hero section */}
      <ThemedView className="min-h-[600px] bg-gray-900 px-5">
        <ThemedView className="max-w-3xl mx-auto pt-24 pb-8">
          <ThemedText className="text-4xl font-extrabold text-white mb-4">
            Share Your Outdoor Gear
          </ThemedText>
          <ThemedText className="text-xl text-gray-300 mb-6">
            Rent high-quality outdoor equipment from local adventurers. From camping gear to climbing equipment, find what you need for your next adventure.
          </ThemedText>
          <Link href="/(tabs)/explore" asChild>
            <Pressable className="bg-green-600 px-6 py-3 rounded-md self-start">
              <ThemedText className="text-white text-base font-medium">
                Browse Gear
              </ThemedText>
            </Pressable>
          </Link>
        </ThemedView>
      </ThemedView>

      {/* How it works section */}
      <ThemedView className="bg-gray-50 px-5 py-16">
        <ThemedText className="text-3xl font-extrabold text-gray-900 text-center mb-8">
          How It Works
        </ThemedText>
        <ThemedView className="space-y-4">
          {steps.map((step) => (
            <ThemedView key={step.name} className="bg-white p-6 rounded-lg shadow-sm">
              <View className="absolute top-4 right-4">
                <IconSymbol name={step.icon} size={24} color="#22c55e" />
              </View>
              <ThemedText className="text-lg font-medium text-gray-900 mb-2">
                {step.name}
              </ThemedText>
              <ThemedText className="text-base text-gray-500">
                {step.description}
              </ThemedText>
            </ThemedView>
          ))}
        </ThemedView>
      </ThemedView>

      {/* Activities section */}
      <ThemedView className="px-5 py-8 border-t border-gray-200 mb-20">
        <ThemedText className="text-2xl font-bold text-gray-900 text-center mb-8">
          Discover More Activities
        </ThemedText>
        <InfiniteSlider />
      </ThemedView>
    </ScrollView>
  );
}
