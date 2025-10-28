'use client'; // Necesario para la protección y el componente principal

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import dynamic from 'next/dynamic';

// Carga dinámica del componente principal del simulador
const SimuladorVehiculos = dynamic(() => import('@/components/SimuladorVehiculos'), {
  ssr: false, // El simulador depende de 'window' (setInterval) y estado del cliente
  loading: () => <p>Cargando simulador...</p>
});

export default function SimuladorPage() {
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
        Simulador de Flota
      </h1>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Inicia simulaciones para los vehículos de tu flota. Los vehículos se moverán
        punto por punto a lo largo de sus rutas oficiales (`rutaIda`/`rutaVuelta`).
        Podrás verlos moverse en el &quot;Mapa en Vivo&quot; y en la app del pasajero.
      </p>
      <SimuladorVehiculos />
    </DashboardLayout>
  );
}
