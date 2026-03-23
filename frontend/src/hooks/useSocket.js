import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = '';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState(null);
  const [statusChanges, setStatusChanges] = useState([]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      setConnected(false);
    });

    socket.on('stats:update', (data) => {
      setStats(data);
    });

    socket.on('devices:statusChange', (changes) => {
      setStatusChanges(changes);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const clearStatusChanges = useCallback(() => {
    setStatusChanges([]);
  }, []);

  return {
    socket: socketRef.current,
    connected,
    stats,
    statusChanges,
    clearStatusChanges,
  };
}
