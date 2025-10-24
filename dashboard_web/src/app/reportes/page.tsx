'use client'; // Necesario para la protección y el componente ListaReportes

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ListaReportes from '@/components/ListaReportes'; // Importar nuestro componente

export default function ReportesPage() {
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

  // Si hay usuario, mostrar el layout y la lista de reportes
  return (
    <DashboardLayout>
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">
        Gestión de Incidentes Reportados
      </h1>
      <ListaReportes /> {/* Renderizar el componente de la lista */}
    </DashboardLayout>
  );
}

