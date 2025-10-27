'use client';

import React, { useState, useEffect } from 'react';
// [MODIFICADO] Imports de Firebase (usando tu ruta de proyecto)
import { 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '@/lib/firebase'; // <--- Usando la importación de tu proyecto
import { Eye, Star, Trash2, Loader2 } from 'lucide-react';

// [AÑADIDO] Imports de los modales (asumimos que están en estas rutas)
// Asegúrate de que las rutas a tus modales sean correctas
import CreadorUbicacionModal from './CreadorUbicacionModal';
import VisualizadorUbicacionModal from './VisualizadorUbicacionModal';

// (Asumimos que useAuth está disponible en tu contexto)
// import { useAuth } from '@/app/context/AuthContext'; 

// [AÑADIDO] Interfaz
export interface UbicacionData {
  id: string;
  nombre: string;
  coordenada: { latitude: number; longitude: number };
  patrocinado: boolean;
}

// [MODIFICADO] Este componente ahora maneja toda la lógica, como ListaPropuestasRuta
export default function ListaUbicaciones() {
  // [AÑADIDO] Toda la lógica de estado
  const [ubicaciones, setUbicaciones] = useState<UbicacionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modo, setModo] = useState<'lista' | 'crear' | 'visualizar'>('lista');
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState<UbicacionData | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null); // Para spinners individuales

  // [AÑADIDO] useEffect para cargar datos
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'Ubicaciones_POI'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const poisData: UbicacionData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        poisData.push({
          id: doc.id,
          nombre: data.nombre,
          coordenada: data.coordenada, 
          patrocinado: data.patrocinado ?? false,
        });
      });
      // Ordenar por nombre
      setUbicaciones(poisData.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setIsLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error escuchando Ubicaciones_POI:", err);
      setError("Error al cargar las ubicaciones.");
      setIsLoading(false);
    });

    return () => unsubscribe(); // Limpiar el listener al desmontar
  }, []);

  // [AÑADIDO] Handlers para las acciones
  const handleVisualizar = (ubi: UbicacionData) => {
    setUbicacionSeleccionada(ubi);
    setModo('visualizar');
  };

  const togglePatrocinado = async (id: string, current: boolean) => {
    setProcesando(id);
    try {
      await updateDoc(doc(db, 'Ubicaciones_POI', id), { patrocinado: !current });
    } catch (err) {
      console.error('Error actualizando patrocinado:', err);
    } finally {
      setProcesando(null); // Quitar spinner
    }
  };

  const handleEliminarUbicacion = async (poiId: string) => {
    // Aquí puedes añadir tu modal de confirmación
    // if (!confirm('¿Seguro?')) return; 
    
    setProcesando(poiId);
    try {
      await deleteDoc(doc(db, 'Ubicaciones_POI', poiId));
      console.log("POI eliminado con éxito.");
      setModo('lista'); // Cierra el modal si estaba abierto
    } catch (error) {
      console.error("Error al eliminar POI:", error);
    } finally {
      setProcesando(null); 
    }
  };

  // --- Renderizado ---
  
  if (isLoading) { 
    return <div className="text-center p-4">Cargando ubicaciones...</div>;
  }
  if (error) {
    return <div className="text-center p-4 text-red-500">{error}</div>;
  }

  // --- Renderizado principal (Lista + Modales) ---
  return (
    <div className="space-y-4">
      
      {/* Botón de "Nueva Ubicación" (como en ListaPropuestasRuta) */}
      <div className="flex justify-end mb-4">
        {/* Solo mostrar el botón de crear si estamos en modo 'lista' */}
        {modo === 'lista' && (
          <button
            onClick={() => setModo('crear')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow"
          >
            ➕ Nueva Ubicación
          </button>
        )}
      </div>

      {/* La tabla solo se muestra si estamos en modo 'lista' */}
      {modo === 'lista' && (
        <>
          {ubicaciones.length === 0 ? (
            <div className="text-center p-4 text-gray-500">No hay ubicaciones registradas.</div>
          ) : (
            <div className="overflow-x-auto shadow-md rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Coordenadas</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Patrocinado</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
                  {ubicaciones.map((ubi) => (
                    <tr key={ubi.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{ubi.nombre || 'Sin nombre'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {ubi.coordenada ? `${ubi.coordenada.latitude.toFixed(5)}, ${ubi.coordenada.longitude.toFixed(5)}` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {ubi.patrocinado ? (
                          <span className="inline-flex items-center text-green-600 font-semibold"><Star size={16} className="mr-1 fill-green-500" /> Sí</span>
                        ) : (
                          <span className="inline-flex items-center text-gray-400 font-medium"><Star size={16} className="mr-1" /> No</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        {procesando === ubi.id ? (
                          <Loader2 size={18} className="animate-spin inline-block text-gray-500" />
                        ) : (
                          <>
                            <button onClick={() => togglePatrocinado(ubi.id, ubi.patrocinado)} title="Cambiar patrocinado" className={`${ubi.patrocinado ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-500 hover:text-gray-700'}`}>
                              <Star size={18} />
                            </button>
                            <button onClick={() => handleVisualizar(ubi)} title="Ver ubicación en mapa" className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                              <Eye size={18} />
                            </button>
                            <button onClick={() => handleEliminarUbicacion(ubi.id)} title="Eliminar ubicación" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* [AÑADIDO] Los modales ahora son renderizados por este componente */}
      {modo === 'crear' && (
        <CreadorUbicacionModal
          onCancelar={() => setModo('lista')}
          onGuardado={() => setModo('lista')}
        />
      )}

      {/* [MODIFICADO] Asegúrate de que VisualizadorUbicacionModal acepte estas props */}
      {modo === 'visualizar' && ubicacionSeleccionada && (
        <VisualizadorUbicacionModal
          ubicacion={ubicacionSeleccionada}
          onClose={() => setModo('lista')} 
          onEliminar={handleEliminarUbicacion} // <-- Pasamos la función de eliminar
        />
      )}
    </div>
  );
}
