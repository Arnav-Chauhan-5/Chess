import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Lobby from './pages/Lobby';
import Watch from './pages/Watch';
import Leaderboard from './pages/Leaderboard';
import History from './pages/History';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import GameRoom from './pages/GameRoom';
import { AuthProvider } from './context/AuthContext';
import AppShell from './components/layout/AppShell';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Full-width pages — rendered outside app-container */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<div className="app-container"><Login /></div>} />
          <Route path="/register" element={<div className="app-container"><Register /></div>} />
          
          {/* Authenticated pages — inside AppShell */}
          <Route element={<AppShell />}>
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/watch" element={<Watch />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/history" element={<History />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/game/:gameId" element={<GameRoom />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

