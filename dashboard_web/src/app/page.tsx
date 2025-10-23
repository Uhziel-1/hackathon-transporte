'use client';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

export default function Home() {
  // Usamos useMemo para asegurar que el componente solo se importe una vez
  const Mapa = useMemo(() => dynamic(
    () => import('@/components/MapaDinamico'), // Ruta a tu componente
    { 
      loading: () => <p>Cargando mapa...</p>, // Muestra esto mientras carga
      ssr: false // ¡La clave! No renderizar en el servidor
    }
  ), []); // El array vacío asegura que esto solo se ejecute una vez

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold mb-4">Dashboard de Transporte</h1>

      {/* Damos al contenedor del mapa un tamaño fijo */}
      <div style={{ height: '500px', width: '80%' }}>
        <Mapa />
      </div>
    </main>
  );
}