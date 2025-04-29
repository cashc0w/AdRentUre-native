import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import MountainImage from '../components/MountainImage';
import InfiniteSlider from '../components/InfiniteSlider';
import { Svg, Path } from 'react-native-svg';

export default function Home() {
  const router = useRouter();

  return (
    <ScrollView className="bg-white">
      {/* Hero section */}
      <View className="relative bg-gray-900 min-h-[600px]">
        <MountainImage />
        <View className="relative px-4 py-24 sm:py-32 sm:px-6 lg:px-8">
          <Text className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Share Your Outdoor Gear
          </Text>
          <Text className="mt-6 text-xl text-gray-300 max-w-3xl">
            Rent high-quality outdoor equipment from local adventurers. From camping gear to climbing equipment, find what you need for your next adventure.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/gear')}
            className="mt-10 bg-green-600 px-6 py-3 rounded-md"
          >
            <Text className="text-white text-base font-medium">Browse Gear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* How it works section */}
      <View className="bg-gray-50">
        <View className="px-4 py-16 sm:py-24 sm:px-6 lg:px-8">
          <Text className="text-3xl font-extrabold text-gray-900 text-center">
            How It Works
          </Text>
          <View className="mt-12">
            {[
              {
                name: 'Find Gear',
                description: 'Browse through our collection of outdoor equipment from local adventurers.',
                icon: (
                  <Svg width={24} height={24} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <Path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </Svg>
                ),
              },
              {
                name: 'Request to Rent',
                description: 'Send a rental request to the owner with your desired dates.',
                icon: (
                  <Svg width={24} height={24} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <Path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </Svg>
                ),
              },
              {
                name: 'Meet & Rent',
                description: 'Arrange a meetup with the owner to pick up the gear and start your adventure.',
                icon: (
                  <Svg width={24} height={24} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <Path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                  </Svg>
                ),
              },
            ].map((step) => (
              <View
                key={step.name}
                className="bg-white p-6 rounded-lg shadow-sm mb-4"
              >
                <View className="absolute top-0 right-0 p-4 text-green-600">
                  {step.icon}
                </View>
                <Text className="text-lg font-medium text-gray-900">{step.name}</Text>
                <Text className="mt-2 text-base text-gray-500">{step.description}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Infinite Slider section */}
      <View className="border-t border-gray-200 pt-4">
        <View className="px-4 py-8 sm:px-6 lg:px-8">
          <Text className="text-2xl font-bold text-gray-900 text-center mb-8">
            Discover More Activities
          </Text>
          <InfiniteSlider />
        </View>
      </View>
    </ScrollView>
  );
} 