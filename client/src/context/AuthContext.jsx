import { createContext, useState, useEffect, useContext } from 'react';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      // Check if token exists in URL (e.g., after OAuth redirect)
      const params = new URLSearchParams(window.location.search);
      const tokenFromUrl = params.get('token');
      
      if (tokenFromUrl) {
        setToken(tokenFromUrl);
        try {
          const payload = JSON.parse(atob(tokenFromUrl.split('.')[1]));
          setUser({ id: payload.id, username: payload.username });
        } catch (e) {
          console.error("Invalid token format");
        }
        
        window.history.replaceState({}, document.title, window.location.pathname);
        setLoading(false);
      } else {
        try {
          const res = await fetch('http://localhost:3000/auth/me', {
            credentials: 'include'
          });
          if (res.ok) {
            const data = await res.json();
            setToken(data.accessToken);
            setUser(data.user);
          }
        } catch (e) {
          console.error("Failed to restore session", e);
        } finally {
          setLoading(false);
        }
      }
    };

    restoreSession();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      
      setToken(data.accessToken);
      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const register = async (username, email, password) => {
    try {
      const res = await fetch('http://localhost:3000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      
      setToken(data.accessToken);
      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await fetch('http://localhost:3000/auth/logout', { 
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {
      console.error(e);
    }
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
