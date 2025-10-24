'use client'; // Necesario para hooks como useState, useRouter

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // Hook de Next.js para navegar
import { signInWithEmailAndPassword, AuthError } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Importar auth desde nuestra config

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Evitar recarga de página
    setError(null);
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (err: unknown) { // <-- CAMBIO: unknown en lugar de any
      console.error("Error de login:", err);
      // Type guard para verificar si es un error de Firebase Auth
      if (typeof err === 'object' && err !== null && 'code' in err) {
         const authError = err as AuthError; // Casteo seguro después de verificar 'code'
         if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/user-not-found' || authError.code === 'auth/wrong-password') {
            setError('Correo electrónico o contraseña incorrectos.');
         } else {
            setError(`Ocurrió un error (${authError.code}). Inténtalo de nuevo.`);
         }
      } else if (err instanceof Error) { // Fallback para errores genéricos
           setError(`Ocurrió un error: ${err.message}`);
      } else {
           setError('Ocurrió un error desconocido al iniciar sesión.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
          Iniciar Sesión - Dashboard Dueño
        </h1>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Correo Electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
          )}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              {isLoading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
    
