import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, Dimensions, Pressable } from 'react-native';

const items = [
  {
    name: 'Mountain Bikes',
    image: require('@/assets/images/bike.jpg'),
    description: 'Premium bikes for trail adventures'
  },
  {
    name: 'Kayaks & Canoes',
    image: require('@/assets/images/kayak.jpg'),
    description: 'Explore lakes and rivers'
  },
  {
    name: 'Ski & Snow Gear',
    image: require('@/assets/images/ski.jpg'),
    description: 'Winter sports equipment'
  },
  {
    name: 'Surfboards',
    image: require('@/assets/images/surf.jpg'),
    description: 'Catch the perfect wave'
  },
  {
    name: 'Photography & Drones',
    image: require('@/assets/images/gopro.jpg'),
    description: 'Capture outdoor moments'
  },
  {
    name: 'Camping',
    image: require('@/assets/images/tent.jpg'),
    description: 'Complete camping setups'
  }
];

const CARD_WIDTH = 256; // w-64 in Tailwind
const CARD_HEIGHT = 192; // h-48 in Tailwind
const GAP = 32; // gap-8 in Tailwind

export default function InfiniteSlider() {
  const scrollX = useRef(new Animated.Value(0)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const [isPaused, setIsPaused] = React.useState(false);

  useEffect(() => {
    const startAnimation = () => {
      if (animation.current) {
        animation.current.stop();
      }

      animation.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scrollX, {
            toValue: -CARD_WIDTH * items.length - GAP * (items.length - 1),
            duration: 20000,
            useNativeDriver: true,
          }),
          Animated.timing(scrollX, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

      if (!isPaused) {
        animation.current.start();
      }
    };

    startAnimation();

    return () => {
      if (animation.current) {
        animation.current.stop();
      }
    };
  }, [isPaused]);

  const handlePressIn = () => setIsPaused(true);
  const handlePressOut = () => setIsPaused(false);

  return (
    <Pressable 
      className="overflow-hidden bg-white py-10"
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={{
          flexDirection: 'row',
          transform: [{ translateX: scrollX }],
        }}
      >
        {/* First set of items */}
        <View className="flex-row items-center">
          {items.map((item, index) => (
            <View
              key={`${item.name}-1`}
              className={`relative rounded-lg overflow-hidden ${index === items.length - 1 ? 'mr-8' : ''}`}
              style={{ width: CARD_WIDTH, height: CARD_HEIGHT, marginRight: GAP }}
            >
              <Image
                source={item.image}
                className="w-full h-full"
                resizeMode="cover"
              />
              <View className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <View className="absolute bottom-0 left-0 p-4">
                <Animated.Text className="text-lg font-semibold text-white">
                  {item.name}
                </Animated.Text>
                <Animated.Text className="text-sm text-gray-300">
                  {item.description}
                </Animated.Text>
              </View>
            </View>
          ))}
        </View>

        {/* Second set of items (duplicated for infinite effect) */}
        <View className="flex-row items-center">
          {items.map((item, index) => (
            <View
              key={`${item.name}-2`}
              className={`relative rounded-lg overflow-hidden ${index === items.length - 1 ? 'mr-8' : ''}`}
              style={{ width: CARD_WIDTH, height: CARD_HEIGHT, marginRight: GAP }}
            >
              <Image
                source={item.image}
                className="w-full h-full"
                resizeMode="cover"
              />
              <View className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <View className="absolute bottom-0 left-0 p-4">
                <Animated.Text className="text-lg font-semibold text-white">
                  {item.name}
                </Animated.Text>
                <Animated.Text className="text-sm text-gray-300">
                  {item.description}
                </Animated.Text>
              </View>
            </View>
          ))}
        </View>
      </Animated.View>
    </Pressable>
  );
} 