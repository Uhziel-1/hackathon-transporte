'use client'; // Necesario porque usa hooks (useState, useEffect, useContext)
    
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Importar auth

// Definir la forma del contexto
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  // Podríamos añadir aquí empresaId si lo obtenemos al loguear
}

// Crear el contexto con un valor inicial
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true, // Empezar cargando hasta que sepamos el estado
});

// Crear el componente Proveedor
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Escuchar cambios en el estado de autenticación
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
      console.log("Auth State Changed:", currentUser ? currentUser.uid : 'No user');
    });

    // Limpiar el listener cuando el componente se desmonte
    return () => unsubscribe();
  }, []); // El array vacío asegura que solo se ejecute una vez al montar

  const value = { user, isLoading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook personalizado para usar el contexto fácilmente
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
    
