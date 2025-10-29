'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/app/context/AuthContext'; // Hook para obtener usuario
import { LogOut, Map, AlertTriangle, Route, Users, BarChart, PlayCircle, Network, Truck, Download, MapPin } from 'lucide-react'; // Iconos

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user } = useAuth(); // Obtener el usuario del contexto
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // El onAuthStateChanged redirigirá automáticamente, o podemos forzarlo:
      router.push('/login');
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  // Si aún no sabemos si hay usuario (estado inicial), no mostrar nada o un loader
  // Nota: La protección real la haremos en la página que use este layout

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white dark:bg-gray-800 shadow-md">
        <div className="flex flex-col h-full">
          {/* Logo o Título */}
          <div className="h-16 flex items-center justify-center border-b dark:border-gray-700">
            <span className="text-xl font-semibold text-gray-800 dark:text-white">
              🚌 Dashboard
            </span>
          </div>

          {/* Navegación */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            <NavItem icon={Map} href="/">Mapa en Vivo</NavItem>
            <NavItem icon={AlertTriangle} href="/reportes">Reportes</NavItem>
            <NavItem icon={Network} href="/lineas">Gestión de Líneas</NavItem>
            <NavItem icon={Route} href="/rutas">Gestión de Rutas</NavItem>
            <NavItem icon={Users} href="/conductores">Conductores</NavItem>
            <NavItem icon={Truck} href="/vehiculos">Gestión de Vehículos</NavItem>
            <NavItem icon={Map} href="/ubicaciones">Ubicaciones POI</NavItem>
            <NavItem icon={BarChart} href="/alertas">Alertas IA</NavItem>
            
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
              <NavItem icon={Download} href="/armador-rutas">
                Armador de Rutas KML
              </NavItem>
              <NavItem icon={PlayCircle} href="/simulador">
                Simulador de Flota
              </NavItem>
              <NavItem icon={MapPin} href="https://mapalisto.vercel.app/">
                Mapa de de Rutas
              </NavItem>
            </div>
          </nav>

          {/* Footer del Sidebar (Logout) */}
          <div className="px-4 py-4 border-t dark:border-gray-700">
             {user && (
                 <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate" title={user.email ?? ''}>
                    Logueado como: {user.email}
                 </p>
             )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 rounded-md hover:bg-red-200 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
};

// Componente auxiliar para los items de navegación
interface NavItemProps {
    icon: React.ElementType;
    href: string;
    children: ReactNode;
}
const NavItem: React.FC<NavItemProps> = ({ icon: Icon, href, children }) => {
    // Aquí podríamos añadir lógica para resaltar el item activo basado en la ruta
    return (
        <Link
          href={href}
          className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <Icon className="w-5 h-5 mr-3" />
          {children}
        </Link>
    );
}


export default DashboardLayout;
    
