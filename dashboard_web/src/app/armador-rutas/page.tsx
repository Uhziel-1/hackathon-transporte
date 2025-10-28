'use client'; // Necesario para la protección y el componente principal

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import dynamic from 'next/dynamic';

// Carga dinámica del componente principal
const ArmadorRutas = dynamic(() => import('@/components/ArmadorRutas'), {
  ssr: false, // Depende de fetch() en cliente y Leaflet
  loading: () => <p>Cargando armador de rutas...</p>
});

export default function ArmadorRutasPage() {
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
        Armador de Rutas KML
      </h1>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Instrucciones: Coloca tu archivo GeoJSON (convertido desde KML) en la carpeta `/public/rutas_juliaca.geojson` de tu proyecto. Luego, usa esta herramienta para construir y guardar tus rutas.
      </p>
      <ArmadorRutas />
    </DashboardLayout>
  );
}
