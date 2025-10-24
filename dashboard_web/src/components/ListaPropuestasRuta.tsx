'use client';

import React, { useState, useEffect } from 'react';
// Imports completos de Firestore
import { collection, onSnapshot, query, where, doc, getDoc, updateDoc, Timestamp, GeoPoint, orderBy, getDocs, limit, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import VisualizadorRutaModal from './VisualizadorRutaModal'; // Importar Modal
import { Eye, Check, X, Loader2, History, AlertCircle } from 'lucide-react'; // Iconos (añadir History, AlertCircle)

// Interfaz para la propuesta combinada
interface PropuestaRuta {
  id: string; // ID del documento RutasPropuestas
  lineaId: string;
  nombreLinea?: string; // Nombre de la línea (opcional)
  propuestaIdaVuelta: 'ida' | 'vuelta' | string;
  fechaPropuesta: Date | null;
  puntosGrabados: GeoPoint[];
  propuestoPorNombre?: string; // Nombre del conductor (opcional)
  propuestoPorAuthUid: string;
  estadoPropuesta: 'pendiente' | 'aprobada' | 'rechazada' | string; // Añadir estado
  // Añadir estado para manejar carga individual
  isProcessing?: boolean;
}

// Interfaz para pasar al modal
interface RutaParaVisualizar {
    puntos: GeoPoint[];
    nombre?: string; // Nombre de la línea
    direccion?: string; // Ida o Vuelta
}

// Componente para el indicador de estado
const EstadoPropuestaBadge: React.FC<{ estado: string }> = ({ estado }) => {
    let colorClasses = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    let icon = <History size={14} className="mr-1"/>;
    let text = estado;

    switch (estado) {
        case 'pendiente':
            colorClasses = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            icon = <AlertCircle size={14} className="mr-1"/>;
            text = 'Pendiente';
            break;
        case 'aprobada':
             colorClasses = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
             icon = <Check size={14} className="mr-1"/>;
             text = 'Aprobada';
            break;
        case 'rechazada':
             colorClasses = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
             icon = <X size={14} className="mr-1"/>;
             text = 'Rechazada';
            break;
    }

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses}`}>
           {icon} {text}
        </span>
    );
}


export default function ListaPropuestasRuta() {
  const [propuestas, setPropuestas] = useState<PropuestaRuta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rutaSeleccionada, setRutaSeleccionada] = useState<RutaParaVisualizar | null>(null);

  useEffect(() => {
    // --- CAMBIO: Quitar el filtro 'where' para mostrar todas ---
    const q = query(
        collection(db, 'RutasPropuestas'),
        // where('estadoPropuesta', '==', 'pendiente'), // <-- ELIMINADO
        orderBy('fechaPropuesta', 'desc') // Ordenar por fecha sigue siendo útil
    );

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      // No establecer isLoading(true) aquí para evitar parpadeos al actualizar
      setError(null);

      const propuestasPromises = querySnapshot.docs.map(async (propuestaDoc): Promise<PropuestaRuta | null> => {
        const data = propuestaDoc.data();
        let nombreLinea = 'Desconocida';
        let propuestoPorNombre = 'Desconocido';

        // Buscar nombre de la línea
        if (data.lineaId) {
          try {
            const lineaSnap = await getDoc(doc(db, 'Lineas', data.lineaId));
            if (lineaSnap.exists()) nombreLinea = lineaSnap.data()?.nombre ?? 'Sin Nombre';
          } catch (e) { console.error("Error buscando línea:", e); }
        }

        // Buscar nombre del conductor
        if (data.propuestoPorAuthUid) {
           try {
              const qConductor = query(collection(db, 'Conductores'), where('authUid', '==', data.propuestoPorAuthUid), limit(1));
              const conductorSnap = await getDocs(qConductor);
              if (!conductorSnap.empty) propuestoPorNombre = conductorSnap.docs[0].data()?.nombre ?? 'Sin Nombre';
           } catch (e) { console.error("Error buscando conductor:", e); }
        }

        const fecha = data.fechaPropuesta instanceof Timestamp ? data.fechaPropuesta.toDate() : null;

        return {
          id: propuestaDoc.id,
          lineaId: data.lineaId ?? '',
          nombreLinea: nombreLinea,
          propuestaIdaVuelta: data.propuestaIdaVuelta ?? '',
          fechaPropuesta: fecha,
          puntosGrabados: data.puntosGrabados ?? [],
          propuestoPorNombre: propuestoPorNombre,
          propuestoPorAuthUid: data.propuestoPorAuthUid ?? '',
          estadoPropuesta: data.estadoPropuesta ?? 'desconocido', // Leer estado
          isProcessing: false, // Estado inicial
        };
      });

      const propuestasData = (await Promise.all(propuestasPromises)).filter(p => p !== null) as PropuestaRuta[];
      setPropuestas(propuestasData);
      setIsLoading(false); // Carga inicial completa

    }, (err) => {
      console.error("Error escuchando propuestas:", err);
      setError("Error al cargar el historial de propuestas."); // Mensaje ajustado
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleVisualizar = (propuesta: PropuestaRuta) => {
    setRutaSeleccionada({
        puntos: propuesta.puntosGrabados,
        nombre: propuesta.nombreLinea,
        direccion: propuesta.propuestaIdaVuelta.toUpperCase(),
    });
  };

  const handleCloseModal = () => {
    setRutaSeleccionada(null);
  };

  // --- FUNCIÓN ACTUALIZADA PARA APROBAR/RECHAZAR ---
  const handleActualizarEstado = async (propuesta: PropuestaRuta, nuevoEstado: 'aprobada' | 'rechazada') => {
      // Indicar visualmente que se está procesando
      setPropuestas(prev => prev.map(p => p.id === propuesta.id ? { ...p, isProcessing: true } : p));

      const propuestaRef = doc(db, 'RutasPropuestas', propuesta.id);

      try {
          if (nuevoEstado === 'aprobada') {
              // Si se aprueba, SIEMPRE actualizar AMBAS colecciones
              const lineaRef = doc(db, 'Lineas', propuesta.lineaId);
              const campoRuta = propuesta.propuestaIdaVuelta === 'ida' ? 'rutaIda' : 'rutaVuelta';

              // Validar que los puntos existan antes de intentar escribir
              if (!propuesta.puntosGrabados || propuesta.puntosGrabados.length === 0) {
                  throw new Error("No hay puntos grabados en esta propuesta para aprobar.");
              }

              const batch = writeBatch(db);
              // 1. Sobrescribir la Línea con los nuevos puntos
              batch.update(lineaRef, { [campoRuta]: propuesta.puntosGrabados });
              // 2. Actualizar el estado de la Propuesta
              batch.update(propuestaRef, { estadoPropuesta: 'aprobada' });

              await batch.commit();
              console.log(`Propuesta ${propuesta.id} aprobada y ruta ${campoRuta} actualizada en Línea ${propuesta.lineaId}`);
              // El listener actualizará la UI mostrando el nuevo estado "Aprobada"

          } else {
              // Si se rechaza, solo actualizar el estado de la propuesta
              await updateDoc(propuestaRef, { estadoPropuesta: 'rechazada' });
              console.log(`Propuesta ${propuesta.id} marcada como rechazada`);
              // El listener actualizará la UI mostrando "Rechazada"
          }
      } catch (e) {
          console.error(`Error al marcar como ${nuevoEstado}:`, e);
          alert(`Error al actualizar estado: ${e}`);
          // Revertir el estado visual en caso de error
          setPropuestas(prev => prev.map(p => p.id === propuesta.id ? { ...p, isProcessing: false } : p));
      } finally {
           // Quitar el spinner SIEMPRE, incluso si hubo error (excepto si el componente ya se desmontó)
           // Usar setTimeout para asegurar que ocurra después del re-render del error
           setTimeout(() => {
                setPropuestas(prev => prev.map(p => p.id === propuesta.id ? { ...p, isProcessing: false } : p));
           }, 100);
      }
  };

  // --- Renderizado (Añadir columna de Estado) ---
  if (isLoading && propuestas.length === 0) {
    return <div className="text-center p-4">Cargando historial de propuestas...</div>;
  }
  if (error) {
    return <div className="text-center p-4 text-red-500">{error}</div>;
  }
  if (propuestas.length === 0) {
     return <div className="text-center p-4">No hay propuestas de ruta registradas.</div>;
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Fecha</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Línea</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Dirección</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Estado</th> {/* <-- NUEVA COLUMNA */}
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Propuesto por</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Puntos</th>
            <th scope="col" className="relative px-6 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
          {propuestas.map((propuesta) => (
            <tr key={propuesta.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${propuesta.estadoPropuesta !== 'pendiente' ? 'opacity-70' : ''}`}> {/* Atenuar no pendientes */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                 {propuesta.fechaPropuesta ? formatDistanceToNow(propuesta.fechaPropuesta, { addSuffix: true, locale: es }) : 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{propuesta.nombreLinea}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{propuesta.propuestaIdaVuelta.toUpperCase()}</td>
               <td className="px-6 py-4 whitespace-nowrap text-sm"><EstadoPropuestaBadge estado={propuesta.estadoPropuesta} /></td> {/* <-- MOSTRAR ESTADO */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{propuesta.propuestoPorNombre}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{propuesta.puntosGrabados.length}</td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                {/* Mostrar spinner si se está procesando */}
                {propuesta.isProcessing ? (
                     <Loader2 size={18} className="animate-spin inline-block text-gray-500" />
                ) : (
                    <>
                        <button onClick={() => handleVisualizar(propuesta)} title="Visualizar Ruta" className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50" disabled={propuesta.isProcessing || propuesta.puntosGrabados.length === 0}> {/* Deshabilitar si no hay puntos */}
                            <Eye size={18} />
                        </button>
                         {/* Permitir (Re)Aprobar siempre que haya puntos */}
                        <button onClick={() => handleActualizarEstado(propuesta, 'aprobada')} title="Aprobar y Activar Ruta" className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50" disabled={propuesta.isProcessing || propuesta.puntosGrabados.length === 0}>
                            <Check size={18} />
                        </button>
                         {/* Permitir Rechazar si no está ya rechazada */}
                         {propuesta.estadoPropuesta !== 'rechazada' && (
                             <button onClick={() => handleActualizarEstado(propuesta, 'rechazada')} title="Rechazar" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50" disabled={propuesta.isProcessing}>
                                <X size={18} />
                            </button>
                         )}
                    </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Renderizar el Modal (sin cambios) */}
      {rutaSeleccionada && (
        <VisualizadorRutaModal
          ruta={rutaSeleccionada}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

