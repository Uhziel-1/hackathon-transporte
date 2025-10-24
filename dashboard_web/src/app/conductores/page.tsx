'use client'; // Necesario para protección y componentes de cliente

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext'; // Ajusta la ruta si es necesario
import DashboardLayout from '@/components/DashboardLayout';
import ListaConductores from '@/components/ListaConductores'; // Importar el componente

export default function ConductoresPage() {
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

  // Si hay usuario, mostrar el layout y la lista de conductores
  return (
    <DashboardLayout>
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">
        Gestión de Conductores
      </h1>
      {/* Añadir nota sobre creación manual para el MVP */}
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Nota: La creación de nuevos conductores y asignación inicial de vehículos se realiza
        manualmente en la consola de Firebase para este MVP.
      </p>
      <ListaConductores /> {/* Renderizar el componente de la lista */}
    </DashboardLayout>
  );
}
