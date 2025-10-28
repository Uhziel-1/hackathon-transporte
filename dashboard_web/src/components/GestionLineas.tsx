'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import { Plus, Edit } from 'lucide-react';
import LineaModal from './LineaModal'; // Importar el modal de creación/edición

// Interfaz para los datos de la Línea
export interface LineaData {
  id: string;
  nombre: string;
  color: string;
  empresaId: string;
  terminal1Id?: string | null;
  terminal2Id?: string | null;
  // No necesitamos las rutas (GeoPoints) para la lista
}

// Interfaz para los POIs (solo para el mapa de terminales)
interface PoiMap {
  [id: string]: string; // Map de ID de POI -> Nombre de POI
}

export default function GestionLineas() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [adminEmpresaId, setAdminEmpresaId] = useState<string | null>(null);
  const [lineas, setLineas] = useState<LineaData[]>([]);
  const [poiMap, setPoiMap] = useState<PoiMap>({}); // Mapa para nombres de terminales
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para el modal
  const [showModal, setShowModal] = useState(false);
  const [lineaParaEditar, setLineaParaEditar] = useState<LineaData | null>(null);

  // --- 1. Obtener Empresa ID del Admin ---
  useEffect(() => {
    if (!isLoadingAuth && user) {
      async function fetchEmpresaId() {
        if (!user) { setError('Usuario no autenticado.'); setIsLoading(false); return; }
        // setIsLoading(true); // El loading principal ya está en true
        try {
           const q = query(collection(db, 'Empresas'), where('adminAuthUid', '==', user.uid), limit(1));
           const querySnapshot = await getDocs(q);
           if (!querySnapshot.empty) {
              setAdminEmpresaId(querySnapshot.docs[0].id);
           } else { setError('No se encontró empresa para este administrador.'); setIsLoading(false); }
        } catch { setError('Error al obtener datos de la empresa.'); setIsLoading(false); }
      }
      fetchEmpresaId();
    } else if (!isLoadingAuth && !user) {
         // eslint-disable-next-line react-hooks/set-state-in-effect
         setError('Usuario no autenticado.'); setIsLoading(false);
    }
  }, [user, isLoadingAuth]);

  // --- 2. Cargar POIs (para nombres de terminales) y Escuchar Líneas ---
  useEffect(() => {
    if (!adminEmpresaId) return; // Salir si no hay empresa

    // 2a. Cargar todos los POIs una vez para mapear IDs a Nombres
    const fetchPois = async () => {
        try {
            const poiSnapshot = await getDocs(collection(db, 'Ubicaciones_POI'));
            const map: PoiMap = {};
            poiSnapshot.forEach(doc => {
                map[doc.id] = doc.data().nombre ?? '(POI sin nombre)';
            });
            setPoiMap(map);
        } catch (err) {
             console.error("Error cargando POIs:", err);
             setError("Error al cargar nombres de terminales.");
        }
    };

    fetchPois(); // Llamar

    // 2b. Escuchar cambios en las Líneas de esta empresa
    const qLineas = query(collection(db, 'Lineas'), where('empresaId', '==', adminEmpresaId));

    const unsubscribe = onSnapshot(qLineas, (snapshot) => {
      const lineasData: LineaData[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        lineasData.push({
          id: doc.id,
          nombre: data.nombre ?? 'Sin Nombre',
          color: data.color ?? '#808080', // Gris por defecto
          empresaId: data.empresaId,
          terminal1Id: data.terminal1Id ?? null,
          terminal2Id: data.terminal2Id ?? null,
        });
      });
      setLineas(lineasData.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setIsLoading(false); // Carga completa
    }, (err) => {
      console.error("Error escuchando Líneas:", err);
      setError("Error al cargar la lista de líneas.");
      setIsLoading(false);
    });

    return () => unsubscribe(); // Limpieza del listener
  }, [adminEmpresaId]); // Depende solo de adminEmpresaId

  // --- Handlers para Modales ---
  const handleCrearLinea = () => {
    setLineaParaEditar(null); // Asegurarse de que esté nulo para modo "crear"
    setShowModal(true);
  };

  const handleEditarLinea = (linea: LineaData) => {
    setLineaParaEditar(linea); // Pasar los datos de la línea a editar
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setLineaParaEditar(null); // Limpiar
  };

  // --- Renderizado ---
  if (isLoading && !error) { // Mostrar si está cargando (y no hay error previo)
    return <div className="text-center p-4">Cargando líneas...</div>;
  }
  if (error) {
    return <div className="text-center p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Cabecera con título y botón de crear */}
      <div className="flex justify-between items-center border-b pb-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Gestión de Líneas
        </h1>
        <button
          onClick={handleCrearLinea}
          disabled={!adminEmpresaId} // Deshabilitar si no se encontró la empresa
          title={!adminEmpresaId ? "Error: No se pudo identificar la empresa" : "Crear Nueva Línea"}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <Plus size={18} className="mr-2"/>
          Crear Línea
        </button>
      </div>

      {/* Tabla de Líneas */}
      {lineas.length === 0 ? (
          <div className="text-center p-4 bg-white dark:bg-gray-800 rounded shadow">No hay líneas registradas para esta empresa.</div>
      ) : (
        <div className="overflow-x-auto shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Nombre</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Color</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Terminal 1</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Terminal 2</th>
                <th scope="col" className="relative px-6 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
              {lineas.map((linea) => (
                <tr key={linea.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{linea.nombre}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="p-2 rounded-full" style={{ backgroundColor: linea.color }}></span>
                    <span className="ml-2 font-mono text-xs">{linea.color}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {/* Usar el poiMap para traducir ID a Nombre */}
                    {linea.terminal1Id ? (poiMap[linea.terminal1Id] ?? 'ID No Encontrado') : <span className="italic">N/A</span>}
                  </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {linea.terminal2Id ? (poiMap[linea.terminal2Id] ?? 'ID No Encontrado') : <span className="italic">N/A</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => handleEditarLinea(linea)} title="Editar Línea" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
                        <Edit size={18} />
                    </button>
                    {/* Podríamos añadir un botón de eliminar aquí */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Renderizar el Modal si está visible */}
      {showModal && (
        <LineaModal
          lineaToEdit={lineaParaEditar}
          adminEmpresaId={adminEmpresaId!} // Sabemos que no estará deshabilitado si adminEmpresaId es null
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
