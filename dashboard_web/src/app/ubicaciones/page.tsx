'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import dynamic from 'next/dynamic';

// Carga dinámica del componente principal
const GestionUbicaciones = dynamic(() => import('@/components/GestionUbicaciones'), {
  ssr: false,
});

export default function UbicacionesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Verificando autenticación...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">
        Gestión de Ubicaciones POI
      </h1>
      <GestionUbicaciones />
    </DashboardLayout>
  );
}
