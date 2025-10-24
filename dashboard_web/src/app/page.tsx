'use client';

import { useEffect, useMemo } from 'react'; // Asegúrate que useMemo esté importado
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/app/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';

// --- Carga dinámica del Mapa ---
// !! QUITAR useMemo DE AQUÍ !!
// const MapaEnVivo = useMemo(() => dynamic( ... ), []); // <-- ERROR ESTABA AQUÍ

export default function DashboardHomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // --- MOVER useMemo AQUÍ DENTRO ---
  // Usamos useMemo para evitar re-importar en cada render DENTRO del componente
  const MapaEnVivo = useMemo(() => dynamic(
    () => import('@/components/MapaEnVivo'), // Ruta a nuestro componente de mapa
    {
      loading: () => <div className="flex justify-center items-center h-full"><p>Cargando mapa...</p></div>, // Indicador de carga
      ssr: false // ¡Muy importante! Leaflet no funciona en el servidor
    }
  ), []); // El array vacío asegura que se memoize correctamente
  // --- FIN useMemo ---

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

  // Si hay usuario, mostrar el dashboard con el mapa
  return (
    <DashboardLayout>
      {/* Contenedor principal flexible que ocupa el espacio */}
      <div className="flex flex-col h-full">
         <h1 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
            Monitoreo en Tiempo Real
         </h1>
         {/* Contenedor del mapa que usa el espacio restante */}
         <div className="grow rounded-lg overflow-hidden shadow">
            {/* Ahora sí podemos usar MapaEnVivo aquí */}
            <MapaEnVivo />
         </div>
      </div>
    </DashboardLayout>
  );
}

