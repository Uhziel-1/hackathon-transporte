'use client';

import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L, { LatLngExpression } from 'leaflet';
import { Loader2, Trash2 } from 'lucide-react'; // Para iconos

// Arreglo Íconos Leaflet
// @ts-expect-error Leaflet y React tienen un bug conocido con la URL del ícono
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Interfaz de Props (del código que me diste)
interface VisualizadorUbicacionModalProps {
  ubicacion: {
    id: string; // Necesario para eliminar
    nombre: string;
    coordenada: { latitude: number; longitude: number };
    patrocinado: boolean;
    descripcion?: string;
  };
  onClose: () => void;
  onEliminar: (poiId: string, poiName: string) => Promise<void>; // Hacerla async para feedback
}

// Componente Refactorizado
const VisualizadorUbicacionModal: React.FC<VisualizadorUbicacionModalProps> = ({
  ubicacion,
  onClose,
  onEliminar,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  // Convertimos las coordenadas al formato [lat, lng] de Leaflet
  const coords: LatLngExpression = [
    ubicacion.coordenada.latitude,
    ubicacion.coordenada.longitude,
  ];

  // Lógica para el botón eliminar
  const handleDelete = async () => {
    // Confirmación
    if (window.confirm(`¿Estás seguro de que quieres eliminar "${ubicacion.nombre}"?`)) {
      setIsDeleting(true);
      try {
        await onEliminar(ubicacion.id, ubicacion.nombre); // Llamar a la función prop
        onClose(); // Cerrar solo si la eliminación fue exitosa
      } catch (error) {
        console.error("Error al eliminar desde el modal:", error);
        alert("Hubo un error al eliminar.");
        setIsDeleting(false); // Detener la carga si falla
      }
    }
  };

  return (
    // Estilo base del modal (fondo oscuro, centrado) - Tomado del Ejemplo
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      {/* Contenedor del modal (estilo del Ejemplo) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl h-3/4 flex flex-col">
        
        {/* Cabecera (estilo del Ejemplo) */}
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Detalle de Ubicación: {ubicacion.nombre}
          </h2>
          <button 
            onClick={onClose} 
            disabled={isDeleting}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            &times;
          </button>
        </div>

        {/* Cuerpo (Tomado del código a corregir, pero envuelto en 'grow relative') */}
        <div className="grow relative p-6 flex flex-col overflow-y-auto">
          {/* Descripción (del código a corregir) */}
          {ubicacion.descripcion && (
            <p className="text-gray-600 dark:text-gray-300 mb-4">{ubicacion.descripcion}</p>
          )}
          
          {/* Mapa (del código a corregir, con 'flex-1' para que ocupe espacio) */}
          <div className="flex-1 rounded-lg overflow-hidden min-h-[300px]">
            <MapContainer center={coords} zoom={14} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {/* Mostrar un Marcador, no una Polilínea */}
              <Marker position={coords} />
            </MapContainer>
          </div>
        </div>

        {/* Pie (estilo del Ejemplo, pero con lógica de Eliminar) */}
        <div className="flex justify-between items-center p-4 border-t dark:border-gray-700 shrink-0">
          
          {/* Botón Eliminar (Izquierda) */}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-700 bg-red-100 border border-transparent rounded-md shadow-sm hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-red-900 dark:text-red-300 dark:border-red-700 dark:hover:bg-red-800 disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 size={18} className="animate-spin mr-2" />
            ) : (
              <Trash2 size={16} className="mr-1" />
            )}
            {isDeleting ? 'Eliminando...' : 'Eliminar'}
          </button>

          {/* Botón Cerrar (Derecha - Estilo del Ejemplo) */}
          <button
            onClick={onClose}
            type="button"
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};

export default VisualizadorUbicacionModal;

