
import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L, { LatLng } from 'leaflet'; // Import LatLng
import { db } from '@/lib/firebase';
// Importar todo lo necesario de firestore
import { collection, addDoc, GeoPoint, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react'; // Para el spinner

// --- Fix de iconos Leaflet (como en tu ejemplo) ---
// @ts-expect-error bug conocido de leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// --- Props (Tomadas de tu código "Lo que tengo") ---
interface Props {
  onCancelar: () => void;
  onGuardado: () => void;
}

// --- Click Handler (Adaptado de "Lo que tengo" y "Ejemplo") ---
// Renombrado para claridad
function MapClickHandler({ onSelect }: { onSelect: (latlng: LatLng) => void }) {
  const map = useMap();
  useMapEvents({
    click(e) {
      onSelect(e.latlng); // Pasar el objeto LatLng completo
      map.flyTo(e.latlng, map.getZoom()); // Centrar mapa en el clic
    },
  });
  return null;
}

// --- Componente Principal ---
export default function CreadorUbicacionModal({ onCancelar, onGuardado }: Props) {
  // Estados (de "Lo que tengo")
  const [nombre, setNombre] = useState('');
  // [MODIFICADO] Se quitó el estado de 'descripcion'
  const [coordenada, setCoordenada] = useState<LatLng | null>(null); // Usar tipo LatLng
  const [isSaving, setIsSaving] = useState(false); // Para feedback

  // Lógica de Guardar (de "Lo que tengo", con feedback de "Ejemplo")
  const handleGuardar = async () => {
    if (!coordenada || !nombre.trim()) {
      alert('El Nombre y la Ubicación (clic en mapa) son obligatorios.');
      return;
    }
    
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'Ubicaciones_POI'), {
        nombre: nombre.trim(),
        // [MODIFICADO] Se quitó el campo 'descripcion'
        patrocinado: false,
        coordenada: new GeoPoint(coordenada.lat, coordenada.lng), // Usar .lat y .lng
        fechaCreacion: serverTimestamp(), // Buena práctica
        // [MODIFICADO] Se quitó el campo 'alias'
      });
      alert('Ubicación guardada correctamente.');
      onGuardado();
    } catch (err) {
      console.error('Error al guardar ubicación:', err);
      alert('Error al guardar la ubicación.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // --- Estructura Modal (de "Ejemplo") ---
    // NOTA: Tu código ya tenía el fondo correcto (bg-black/60 backdrop-blur-sm)
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl h-5/6 flex flex-col">
        
        {/* Header (de "Ejemplo") */}
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Crear Nueva Ubicación (POI)
          </h2>
          <button
            onClick={onCancelar}
            disabled={isSaving}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* --- Inputs (de "Lo que tengo", con estilo de "Ejemplo") --- */}
        <div className="p-4 border-b dark:border-gray-700 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre del Lugar
            </label>
            <input
              type="text"
              placeholder="Nombre de la ubicación (ej: Plaza de Armas Juliaca)"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
              disabled={isSaving}
            />
          </div>
          {/* [MODIFICADO] Se quitó el div que contenía la 'descripcion' */}
        </div>

        {/* --- Mapa (de "Lo que tengo", con estilo de "Ejemplo") --- */}
        {/* NOTA: Tu código ya usaba el mapa de OpenStreetMap, igual que el ejemplo */}
        <div className="grow relative">
          <MapContainer
            center={[-15.4985, -70.1338]} // Centrar en Juliaca
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onSelect={(latlng) => setCoordenada(latlng)} />
            {coordenada && <Marker position={coordenada} />}
          </MapContainer>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 p-2 bg-white/70 dark:bg-black/70 rounded shadow-md text-xs dark:text-gray-200 z-1000">
              Haz clic en el mapa para colocar el marcador
            </div>
        </div>

        {/* --- Footer (de "Ejemplo" styling, botones de "Lo que tengo") --- */}
        <div className="flex justify-end items-center gap-3 p-4 border-t dark:border-gray-700">
          <button
            onClick={onCancelar}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={isSaving || !coordenada || !nombre.trim()}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {isSaving && <Loader2 size={18} className="animate-spin mr-2"/>}
            {isSaving ? 'Guardando...' : 'Guardar Ubicación'}
          </button>
        </div>
      </div>
    </div>
  );
}

