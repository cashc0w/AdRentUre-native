import { useState, useEffect } from "react";
import { getConversationMessages, getUserConversations } from "../lib/directus";
import type { DirectusMessage } from "../lib/directus";

export function useConversationMessages(selectedConversationID: string, refresh: boolean) {
    const [messages, setMessages] = useState<DirectusMessage[]>([])
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        async function fetchConversationMessages() {
            try {
                setLoading(true);
                const convMessages = await getConversationMessages(selectedConversationID)
                setMessages(convMessages)
            } catch (err) {
                setError(err as Error);
            } finally {
                setLoading(false);
            }
        }

        if (selectedConversationID !== '') {
            fetchConversationMessages();
        }else console.log('No conversation selected yet.')
    }, [selectedConversationID, refresh]);

    return {
        messages,
        loading,
        error,
    };
}
