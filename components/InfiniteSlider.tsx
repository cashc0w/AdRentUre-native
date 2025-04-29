import { View, Text, ScrollView, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRef, useEffect } from 'react';

const items = [
  {
    name: 'Mountain Bikes',
    image: require('../assets/images/bike.jpg'),
    description: 'Premium bikes for trail adventures'
  },
  {
    name: 'Kayaks & Canoes',
    image: require('../assets/images/kayak.jpg'),
    description: 'Explore lakes and rivers'
  },
  {
    name: 'Ski & Snow Gear',
    image: require('../assets/images/ski.jpg'),
    description: 'Winter sports equipment'
  },
  {
    name: 'Surfboards',
    image: require('../assets/images/surf.jpg'),
    description: 'Catch the perfect wave'
  },
  {
    name: 'Photography & Drones',
    image: require('../assets/images/gopro.jpg'),
    description: 'Capture outdoor moments'
  },
  {
    name: 'Camping',
    image: require('../assets/images/tent.jpg'),
    description: 'Complete camping setups'
  }
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_WIDTH = 256; // 64 * 4 (w-64 in Tailwind)

export default function InfiniteSlider() {
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);

  useEffect(() => {
    const scroll = () => {
      scrollX.current += 1;
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ x: scrollX.current, animated: false });
      }
      if (scrollX.current >= ITEM_WIDTH * items.length) {
        scrollX.current = 0;
      }
    };

    const interval = setInterval(scroll, 20);
    return () => clearInterval(interval);
  }, []);

  return (
    <View className="flex-1 bg-white py-10">
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        className="flex-row"
      >
        {/* First set */}
        <View className="flex-row">
          {items.map((item, index) => (
            <View
              key={`${item.name}-1`}
              className="w-64 h-48 rounded-lg overflow-hidden mx-2"
            >
              <Image
                source={item.image}
                className="w-full h-full"
                contentFit="cover"
              />
              <View className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <View className="absolute bottom-0 left-0 p-4">
                <Text className="text-lg font-semibold text-white">{item.name}</Text>
                <Text className="text-sm text-gray-300">{item.description}</Text>
              </View>
            </View>
          ))}
        </View>
        {/* Second set */}
        <View className="flex-row">
          {items.map((item, index) => (
            <View
              key={`${item.name}-2`}
              className="w-64 h-48 rounded-lg overflow-hidden mx-2"
            >
              <Image
                source={item.image}
                className="w-full h-full"
                contentFit="cover"
              />
              <View className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <View className="absolute bottom-0 left-0 p-4">
                <Text className="text-lg font-semibold text-white">{item.name}</Text>
                <Text className="text-sm text-gray-300">{item.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
} 