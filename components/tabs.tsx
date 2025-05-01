import { Tabs } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useClient } from "../hooks/useClient";

function TabNavigation() {
    const { user } = useAuth();

    const { client } = useClient(user?.id || "");
    
    return (
      <Tabs>
        <Tabs.Screen name="home" options={{ title: 'Home' }} />
        <Tabs.Screen name="about" options={{ title: 'About' }} />
        <Tabs.Screen name="browse" options={{ title: 'Browse' }} />
        <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
        <Tabs.Screen 
          name="[id]/profile" 
          options={{ 
            title: 'Profile',
            href: user ? `${client?.id}/profile` : null
          }} 
        />
      </Tabs>
    );
  }

  export default TabNavigation;