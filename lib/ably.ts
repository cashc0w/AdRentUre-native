import Ably from "ably";

let ably: Ably.Realtime | null = null;
let connectionPromise: Promise<void> | null = null;

export function getAblyInstance() {
  if (!ably) {
    if (!process.env.NEXT_PUBLIC_ABLY_API_KEY) {
      throw new Error("Ably API key is not configured");
    }

    console.log("Initializing Ably connection...");
    ably = new Ably.Realtime({
      key: process.env.NEXT_PUBLIC_ABLY_API_KEY,
      clientId: Math.random().toString(36).substring(2),
      echoMessages: false,
      disconnectedRetryTimeout: 5000,
      suspendedRetryTimeout: 15000,
      httpRequestTimeout: 15000,
      realtimeRequestTimeout: 10000,
      fallbackHosts: [
        "a.ably-realtime.com",
        "b.ably-realtime.com",
        "c.ably-realtime.com",
        "d.ably-realtime.com",
        "e.ably-realtime.com",
      ],
      autoConnect: true,
      recover: function (lastConnectionDetails, cb) {
        console.log("Attempting to recover connection:", lastConnectionDetails);
        cb(true); // true to recover, false to not recover
      },
      environment:
        process.env.NODE_ENV === "production" ? "production" : "development",
      useBinaryProtocol: true,
      queueMessages: true,
      idempotentRestPublishing: true,
    });

    ably.connection.on((stateChange: Ably.ConnectionStateChange) => {
      console.log("Ably connection state changed:", {
        previous: stateChange.previous,
        current: stateChange.current,
        reason: stateChange.reason,
        retryIn: stateChange.retryIn,
      });

      // Additional handling for production environment
      if (process.env.NODE_ENV === "production") {
        if (
          stateChange.current === "failed" ||
          stateChange.current === "suspended"
        ) {
          console.error("Connection issue in production:", stateChange.reason);
          // You might want to implement additional error reporting here
        }
      }
    });

    ably.connection.on("failed", (stateChange: Ably.ConnectionStateChange) => {
      console.error("Ably connection error:", stateChange.reason);
    });
  }
  return ably;
}

async function ensureConnected(timeout = 10000): Promise<void> {
  const ably = getAblyInstance();

  if (ably.connection.state === "connected") {
    console.log("Already connected to Ably");
    return;
  }

  console.log("Ensuring Ably connection...");
  connectionPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Connection timeout after ${timeout}ms`));
    }, timeout);

    const cleanup = () => {
      ably.connection.off(connectionStateChange);
      clearTimeout(timer);
    };

    const connectionStateChange = (stateChange: Ably.ConnectionStateChange) => {
      console.log(
        "Connection state change during ensure:",
        stateChange.current
      );

      if (stateChange.current === "connected") {
        cleanup();
        resolve();
      } else if (
        stateChange.current === "failed" ||
        stateChange.current === "suspended"
      ) {
        cleanup();
        reject(
          new Error(`Connection ${stateChange.current}: ${stateChange.reason}`)
        );
      }
    };

    ably.connection.once(connectionStateChange);

    if (
      ably.connection.state === "disconnected" ||
      ably.connection.state === "suspended"
    ) {
      console.log("Forcing reconnection...");
      ably.connection.connect();
    }
  });

  return connectionPromise;
}

export interface AblyMessage {
  id: string;
  conversationId: string;
  senderId: string;
  message: string;
  timestamp: string;
}

export function getChannelInstance(channelId: string) {
  try {
    const ably = getAblyInstance();
    const channelName = `chat:${channelId}`;
    const channel = ably.channels.get(channelName, {
      modes: ["subscribe", "publish"],
    });

    channel.on((stateChange: Ably.ChannelStateChange) => {
      console.log(
        `Channel ${channelName} state changed to ${stateChange.current}`,
        {
          previous: stateChange.previous,
          reason: stateChange.reason,
        }
      );
    });

    return channel;
  } catch (err) {
    console.error("Error getting channel instance:", err);
    throw err;
  }
}

export async function publishMessage(channelId: string, message: AblyMessage) {
  if (message.conversationId !== channelId) {
    throw new Error("Message conversation ID does not match channel ID");
  }

  try {
    await ensureConnected(15000);
    const channel = getChannelInstance(channelId);

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Publish timeout after 10s"));
      }, 10000);

      const publish = () => {
        try {
          channel.publish({
            name: "message",
            data: message,
          });
          clearTimeout(timer);
          console.log("Message published successfully to channel:", channelId);
          resolve();
        } catch (error) {
          clearTimeout(timer);
          console.error("Error publishing message:", error);
          reject(error);
        }
      };

      if (channel.state === "attached") {
        publish();
      } else {
        channel.once("attached", publish);
        channel.attach();
      }
    });
  } catch (err) {
    console.error("Error in publishMessage:", err);
    throw err;
  }
}

export function subscribeToMessages(
  channelId: string,
  callback: (message: AblyMessage) => void
): Promise<() => void> {
  try {
    const channel = getChannelInstance(channelId);
    console.log(`Subscribing to messages on channel ${channelId}`);

    return new Promise<() => void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Channel attach timeout"));
      }, 10000);

      const onAttached = () => {
        clearTimeout(timer);
        const messageHandler = (message: Ably.Message) => {
          const messageData = message.data as AblyMessage;
          if (messageData.conversationId !== channelId) {
            console.warn("Received message for wrong conversation, ignoring:", {
              expected: channelId,
              received: messageData.conversationId,
            });
            return;
          }

          console.log(`Received message on channel ${channelId}:`, message);
          callback(messageData);
        };

        channel.subscribe("message", messageHandler);

        resolve(() => {
          console.log(`Unsubscribing from channel ${channelId}`);
          channel.unsubscribe("message", messageHandler);
          channel.detach();
        });
      };

      if (channel.state === "attached") {
        onAttached();
      } else {
        channel.once("attached", onAttached);
        channel.attach();
      }
    });
  } catch (err) {
    console.error("Error in subscribeToMessages:", err);
    throw err;
  }
}
