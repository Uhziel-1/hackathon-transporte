'use client'; // Necesario para la protección y el componente principal

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import dynamic from 'next/dynamic';

// Carga dinámica del componente principal
const GestionVehiculos = dynamic(() => import('@/components/GestionVehiculos'), {
  ssr: false, // Depende de listeners de Firestore y estado del cliente
  loading: () => <p>Cargando gestión de vehículos...</p>
});

export default function VehiculosPage() {
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
      <GestionVehiculos /> {/* Renderizar el componente principal */}
    </DashboardLayout>
  );
}
