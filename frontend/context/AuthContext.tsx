import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, UserContextType } from '../types.js';

const AuthContext = createContext<UserContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>('passenger');
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('Alex Morgan');

  useEffect(() => {
    // Generate or retrieve persistent browser session ID for atomic Redis locks
    let storedSession = localStorage.getItem('redroute_user_session');
    if (!storedSession) {
      storedSession = `usr_${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('redroute_user_session', storedSession);
    }
    setUserId(storedSession);
  }, []);

  const handleSetRole = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'passenger') setUserName('Alex Morgan (Passenger)');
    if (newRole === 'operator') setUserName('VRL Fleet Dispatcher');
    if (newRole === 'auditor') setUserName('Senior Financial Auditor');
    if (newRole === 'admin') setUserName('Root Infrastructure Admin');
  };

  return (
    <AuthContext.Provider
      value={{
        role,
        setRole: handleSetRole,
        userId,
        userName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
