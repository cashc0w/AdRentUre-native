import { Tabs } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useClientWithUserID } from "../hooks/useClientWithUserID";

function TabNavigation() {
    const { user } = useAuth();

    const { client } = useClientWithUserID(user?.id || "");
    
    return (
      <Tabs >
        <Tabs.Screen name="about" options={{ title: 'About', href: !user ? `/about` : null }} />
        <Tabs.Screen name="gear/browse" options={{ title: 'Browse' }} />
        <Tabs.Screen name="messages" options={{ title: 'Messages',  href: user ? `/messages` : null }} />
        <Tabs.Screen name="profile/[id]" options={{ title: 'Profile', href: user ? `/profile/${client?.id}` : null }} />
        <Tabs.Screen name="auth" options={{ title: 'Login', href: !user ? `/auth` : null }} />
        <Tabs.Screen name="gear/new" options={{ title: 'New', href: null }} />
        <Tabs.Screen name="gear/[id]" options={{ title: 'Gear', href: null }} />
      </Tabs>
    );
  }

  export default TabNavigation;