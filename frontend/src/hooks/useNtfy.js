import { useState, useEffect, useCallback } from 'react';

export const useNtfy = (topics = []) => {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  const clearMessages = useCallback(() => setMessages([]), []);

  useEffect(() => {
    if (!topics.length) return;

    const sources = [];

    topics.forEach(topic => {
      const source = new EventSource(`https://ntfy.sh/${topic}/sse`);

      source.onopen = () => setIsConnected(true);

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'message') {
            setMessages(prev => [data, ...prev]);
          }
        } catch (err) {
          // skip non-JSON events
        }
      };

      source.onerror = () => setIsConnected(false);

      sources.push(source);
    });

    return () => {
      sources.forEach(s => s.close());
      setIsConnected(false);
    };
  }, [topics.join(',')]);

  return { messages, isConnected, clearMessages };
};
