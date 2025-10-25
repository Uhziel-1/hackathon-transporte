'use client'; // Necesario para protección y componentes de cliente

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import dynamic from 'next/dynamic';
const GestionRutas = dynamic(() => import('@/components/GestionRutas'), { ssr: false });

export default function RutasPage() {
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

  if (!user) {
    return null;
  }

  // Si hay usuario, mostrar el layout y el componente de gestión
  return (
    <DashboardLayout>
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">
        Gestión de Rutas
      </h1>
      <GestionRutas /> {/* Renderizar el componente principal */}
    </DashboardLayout>
  );
}
