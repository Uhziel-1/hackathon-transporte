'use client'; // Necesario para la protección y el componente principal

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import dynamic from 'next/dynamic';

// Carga dinámica del componente principal
const GestionLineas = dynamic(() => import('@/components/GestionLineas'), {
  ssr: false, // Depende de listeners de Firestore y estado del cliente
  loading: () => <p>Cargando gestión de líneas...</p>
});

export default function LineasPage() {
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
      <GestionLineas /> {/* Renderizar el componente principal */}
    </DashboardLayout>
  );
}
