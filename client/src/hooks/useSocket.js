import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let socketInstance = null;

export const useSocket = () => {
  const [socket, setSocket] = useState(socketInstance);
  const [connected, setConnected] = useState(socketInstance?.connected || false);

  useEffect(() => {
    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, {
        withCredentials: true,
        autoConnect: true
      });

      socketInstance.on('connect', () => setConnected(true));
      socketInstance.on('disconnect', () => setConnected(false));
      setSocket(socketInstance);
    }
    
    // In React 18 strict mode, this might unmount/remount. We don't want to destroy the socket on unmount
    // if we are sharing it application-wide. 
    return () => {
      // Don't disconnect here if we want a global socket
    };
  }, []);

  return { socket, connected };
};
