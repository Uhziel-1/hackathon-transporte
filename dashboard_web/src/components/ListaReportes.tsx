'use client';

import React, { useState, useEffect } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { collection, onSnapshot, query, orderBy, doc, getDoc, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDistanceToNow } from 'date-fns'; // Para formatear fechas
import { es } from 'date-fns/locale'; // Para formato en español
import DetalleReporteModal from './DetalleReporteModal'; // Importar el Modal
import { AlertCircle, CheckCircle } from 'lucide-react'; // Iconos

// Definir estructura de un reporte combinado con datos del vehículo
interface ReporteConVehiculo {
  id: string; // ID del documento ReporteConductor
  placaVehiculo?: string; // Placa (opcional si no se encuentra)
  tipo: string;
  mensaje?: string;
  timestamp: Date | null;
  atendido: boolean;
  // Añadimos campos necesarios para el modal
  vehiculoId: string;
  conductorAuthUid?: string;
  comentariosAtencion?: string;
}

export default function ListaReportes() {
  const [reportes, setReportes] = useState<ReporteConVehiculo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReporte, setSelectedReporte] = useState<ReporteConVehiculo | null>(null);

  useEffect(() => {
    // Consulta ordenada por fecha descendente
    const q = query(collection(db, 'ReportesConductor'), orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      setIsLoading(true); // Indicar carga al recibir nuevos datos
      setError(null);
      const reportesPromises = querySnapshot.docs.map(async (reporteDoc): Promise<ReporteConVehiculo | null> => {
        const data = reporteDoc.data();
        const vehiculoId = data.vehiculoId;
        let placaVehiculo = 'Desconocido';

        // Intentar obtener la placa del vehículo
        if (vehiculoId) {
          try {
            const vehiculoRef = doc(db, 'Vehiculos', vehiculoId);
            const vehiculoSnap = await getDoc(vehiculoRef);
            if (vehiculoSnap.exists()) {
              placaVehiculo = vehiculoSnap.data()?.placa ?? 'Sin placa';
            } else {
               placaVehiculo = `ID Vehículo no encontrado: ${vehiculoId.substring(0,5)}...`;
            }
          } catch (vehiculoError) {
             console.error("Error buscando vehículo:", vehiculoError);
             placaVehiculo = 'Error al buscar vehículo';
          }
        }

        // Convertir Timestamp de Firestore a Date de JS (si existe)
        const timestamp = data.timestamp?.toDate() ?? null;

        return {
          id: reporteDoc.id,
          placaVehiculo: placaVehiculo,
          tipo: data.tipo ?? 'Tipo no especificado',
          mensaje: data.mensaje,
          timestamp: timestamp,
          atendido: data.atendido ?? false,
          // Pasar datos extra al modal
          vehiculoId: vehiculoId ?? '',
          conductorAuthUid: data.conductorAuthUid,
          comentariosAtencion: data.comentariosAtencion,
        };
      });

      // Esperar a que todas las búsquedas de vehículos terminen
      const reportesData = (await Promise.all(reportesPromises)).filter(r => r !== null) as ReporteConVehiculo[];
      setReportes(reportesData);
      setIsLoading(false);

    }, (err) => {
      console.error("Error escuchando reportes:", err);
      setError("Error al cargar los reportes.");
      setIsLoading(false);
    });

    return () => unsubscribe(); // Limpieza del listener
  }, []);

  const handleOpenModal = (reporte: ReporteConVehiculo) => {
    setSelectedReporte(reporte);
  };

  const handleCloseModal = () => {
    setSelectedReporte(null);
  };

  if (isLoading && reportes.length === 0) { // Mostrar loading solo la primera vez
    return <div className="text-center p-4">Cargando reportes...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-500">{error}</div>;
  }

  if (reportes.length === 0) {
     return <div className="text-center p-4">No hay reportes recientes.</div>;
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Fecha</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Vehículo</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Tipo</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Mensaje</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Estado</th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
          {reportes.map((reporte) => (
            <tr key={reporte.id} className={`${reporte.atendido ? 'opacity-60' : ''} hover:bg-gray-50 dark:hover:bg-gray-800`}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {reporte.timestamp
                  ? formatDistanceToNow(reporte.timestamp, { addSuffix: true, locale: es })
                  : 'Fecha desconocida'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{reporte.placaVehiculo}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{reporte.tipo.replace('_', ' ').toUpperCase()}</td>
              <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={reporte.mensaje ?? ''}>{reporte.mensaje ?? '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {reporte.atendido ? (
                  <span className="flex items-center text-green-600 dark:text-green-400">
                     <CheckCircle className="w-4 h-4 mr-1" /> Atendido
                  </span>
                ) : (
                  <span className="flex items-center text-yellow-600 dark:text-yellow-400">
                      <AlertCircle className="w-4 h-4 mr-1" /> Pendiente
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  onClick={() => handleOpenModal(reporte)}
                  className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                  // Ya NO hay 'disabled' aquí
                >
                  {reporte.atendido ? 'Ver Detalles' : 'Atender'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Renderizar el Modal si hay un reporte seleccionado */}
      {selectedReporte && (
        <DetalleReporteModal
          reporte={selectedReporte}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
