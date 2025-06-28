import { Redirect } from 'expo-router';

export default function Index() {
  // This component will automatically redirect any traffic
  // from the root ("/") to the "/about" route.
  return <Redirect href="/about" />;
}
