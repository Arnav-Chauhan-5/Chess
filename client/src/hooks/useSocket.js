import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

const SOCKET_URL = API_URL;

// Module-level singleton — one socket for the whole app lifetime.
let socketInstance = null;
let currentToken = null;

export const useSocket = () => {
  const { token } = useAuth();
  
  // We need to trigger a re-render if the socket is created later,
  // or if connection state changes.
  const [_, setTick] = useState(0);
  const forceUpdate = () => setTick(t => t + 1);

  useEffect(() => {
    if (!token) return;

    if (socketInstance && currentToken !== token) {
      socketInstance.disconnect();
      socketInstance = null;
      currentToken = null;
    }

    if (!socketInstance) {
      currentToken = token;
      socketInstance = io(SOCKET_URL, {
        withCredentials: true,
        autoConnect: true,
        auth: { token },
      });
      
      socketInstance.on('connect', forceUpdate);
      socketInstance.on('disconnect', forceUpdate);
      forceUpdate();
    } else {
      // It was already created, but we need to ensure this component
      // listens to connect/disconnect to re-render if needed.
      socketInstance.on('connect', forceUpdate);
      socketInstance.on('disconnect', forceUpdate);
      forceUpdate();
    }

    return () => {
      if (socketInstance) {
        socketInstance.off('connect', forceUpdate);
        socketInstance.off('disconnect', forceUpdate);
      }
    };
  }, [token]);

  return { socket: socketInstance, connected: socketInstance?.connected || false };
};
