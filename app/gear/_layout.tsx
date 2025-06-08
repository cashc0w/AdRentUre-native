import { Stack } from 'expo-router';

export default function GearLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="browse" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]" />
    </Stack>
  )};