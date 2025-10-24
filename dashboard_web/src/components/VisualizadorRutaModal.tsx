'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L, { LatLngExpression, LatLngBoundsExpression } from 'leaflet'; // Import Map type
import { GeoPoint } from 'firebase/firestore';

// Arreglo Íconos Leaflet (si no lo hiciste globalmente)
// @ts-expect-error Leaflet y React tienen un bug conocido con la URL del ícono
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ /* ... Mismos arreglos que antes ... */
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});


// Interfaz para recibir la ruta
interface RutaParaVisualizar {
    puntos: GeoPoint[];
    nombre?: string;
    direccion?: string;
}

interface VisualizadorRutaModalProps {
  ruta: RutaParaVisualizar;
  onClose: () => void;
}

// Componente auxiliar para ajustar los límites del mapa
const AjustarLimitesMapa: React.FC<{ bounds: LatLngBoundsExpression | undefined }> = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      // Usar fitBounds para ajustar el mapa a la polilínea
      // Timeout pequeño para asegurar que el mapa se haya renderizado completamente
      setTimeout(() => {
         if (map) { // Verificar si map está disponible
             map.fitBounds(bounds, { padding: [30, 30] }); // Añadir un poco de padding
         }
      }, 100);
    }
  }, [map, bounds]);
  return null;
};


export default function VisualizadorRutaModal({ ruta, onClose }: VisualizadorRutaModalProps) {
    // Convertir GeoPoints a LatLng para Leaflet
    const polylinePoints: LatLngExpression[] = ruta.puntos.map(gp => [gp.latitude, gp.longitude]);

    // Calcular los límites (bounds) de la polilínea para centrar el mapa
    let bounds: LatLngBoundsExpression | undefined = undefined;
    if (polylinePoints.length > 0) {
        bounds = L.latLngBounds(polylinePoints);
    }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl h-3/4 flex flex-col"> {/* Aumentar tamaño */}
        {/* Cabecera */}
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Visualizador de Ruta Propuesta
            {ruta.nombre && ` - ${ruta.nombre}`} {ruta.direccion && `(${ruta.direccion})`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            &times;
          </button>
        </div>

        {/* Cuerpo (Mapa) */}
        <div className="grow relative">
          {/* Añadir key basada en puntos para forzar re-render si cambian */}
          <MapContainer
             key={ruta.puntos.length} // Ayuda a que fitBounds funcione mejor al reabrir
             scrollWheelZoom={true}
             style={{ height: '100%', width: '100%' }}
             // CORRECCIÓN: Usar whenReady en lugar de whenCreated
             whenReady={() => console.log("Mapa listo")}
             // Centrar/zoom inicial es menos importante si usamos fitBounds
             center={polylinePoints.length > 0 ? polylinePoints[0] : [-15.4985, -70.1338]}
             zoom={15}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {polylinePoints.length > 0 && ( // Solo renderizar si hay puntos
                <Polyline positions={polylinePoints} color="blue" weight={5} />
            )}
            {/* Componente para ajustar límites */}
            <AjustarLimitesMapa bounds={bounds} />
          </MapContainer>
        </div>

        {/* Pie (Solo botón Cerrar) */}
         <div className="flex justify-end p-4 border-t dark:border-gray-700 shrink-0">
          <button
            onClick={onClose} type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

