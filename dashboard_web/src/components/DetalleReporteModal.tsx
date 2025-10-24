'use client';

import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Reutilizar la interfaz del reporte
interface ReporteConVehiculo {
  id: string;
  placaVehiculo?: string;
  tipo: string;
  mensaje?: string;
  timestamp: Date | null;
  atendido: boolean;
  vehiculoId: string;
  conductorAuthUid?: string; // Podríamos buscar el nombre si quisiéramos
  comentariosAtencion?: string;
}

interface DetalleReporteModalProps {
  reporte: ReporteConVehiculo;
  onClose: () => void;
}

export default function DetalleReporteModal({ reporte, onClose }: DetalleReporteModalProps) {
  const [comentarios, setComentarios] = useState(reporte.comentariosAtencion ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMarcarAtendido = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const reporteRef = doc(db, 'ReportesConductor', reporte.id);
      await updateDoc(reporteRef, {
        atendido: true,
        comentariosAtencion: comentarios.trim(),
      });
      setIsSaving(false);
      onClose(); // Cerrar el modal al guardar
    } catch (err) {
      console.error("Error al actualizar reporte:", err);
      setError('No se pudo actualizar el reporte. Inténtalo de nuevo.');
      setIsSaving(false);
    }
  };

  return (
    // Fondo oscuro semi-transparente
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      {/* Contenedor del Modal */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Cabecera */}
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Detalle del Reporte
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Cerrar"
          >
            &times; {/* Icono de 'X' */}
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-6 space-y-4">
          <p><strong>Vehículo:</strong> {reporte.placaVehiculo}</p>
          <p><strong>Tipo:</strong> {reporte.tipo.replace('_', ' ').toUpperCase()}</p>
          <p><strong>Fecha:</strong> {reporte.timestamp ? format(reporte.timestamp, 'Pp', { locale: es }) : 'N/A'}</p>
          {reporte.mensaje && <p><strong>Mensaje Conductor:</strong> {reporte.mensaje}</p>}

          <hr className="dark:border-gray-700"/>

          {/* Sección de Atención */}
          <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200">
            {reporte.atendido ? 'Comentarios de Atención:' : 'Agregar Comentarios y Atender:'}
          </h3>
          <textarea
            rows={3}
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            disabled={reporte.atendido || isSaving} // Deshabilitar si ya está atendido o guardando
            placeholder={reporte.atendido ? '(Reporte ya atendido)' : 'Describe las acciones tomadas...'}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-70"
          />
           {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
           )}
        </div>

        {/* Pie del Modal */}
        <div className="flex justify-end p-4 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            type="button"
            disabled={isSaving}
            className="mr-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
          >
            {reporte.atendido ? 'Cerrar' : 'Cancelar'}
          </button>
          {!reporte.atendido && ( // Solo mostrar si no está atendido
            <button
              onClick={handleMarcarAtendido}
              type="button"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 dark:bg-green-700 dark:hover:bg-green-800"
            >
              {isSaving ? 'Guardando...' : 'Marcar como Atendido'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
