'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L, { LatLngExpression } from 'leaflet';
import { GeoPoint, addDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';

// 🧩 Fix de iconos Leaflet
// @ts-expect-error bug conocido de leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// 📍 Clicks en el mapa
const ClickHandler = ({ onAddPoint }: { onAddPoint: (p: LatLngExpression) => void }) => {
  useMapEvents({
    click(e) {
      onAddPoint([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
};

interface Props {
  onClose: () => void;
}

export default function CreadorRutaModal({ onClose }: Props) {
  const { user } = useAuth();
  const [puntos, setPuntos] = useState<LatLngExpression[]>([]);
  const [direccion, setDireccion] = useState<'ida' | 'vuelta'>('ida');
  const [lineas, setLineas] = useState<{ id: string; nombre: string }[]>([]);
  const [lineaSeleccionada, setLineaSeleccionada] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cargandoLineas, setCargandoLineas] = useState(true);

  // 🔹 Obtener líneas del admin
  useEffect(() => {
    const fetchLineas = async () => {
      if (!user) return;
      try {
        setCargandoLineas(true);

        const empresasSnap = await getDocs(
          query(collection(db, 'Empresas'), where('adminAuthUid', '==', user.uid))
        );

        if (empresasSnap.empty) {
          console.warn('No se encontró empresa para el admin actual');
          return;
        }

        const empresaId = empresasSnap.docs[0].id;

        const lineasSnap = await getDocs(
          query(collection(db, 'Lineas'), where('empresaId', '==', empresaId))
        );

        const data = lineasSnap.docs.map((doc) => ({
          id: doc.id,
          nombre: doc.data().nombre || '(Sin nombre)',
        }));

        setLineas(data);
      } catch (err) {
        console.error('Error al obtener líneas:', err);
      } finally {
        setCargandoLineas(false);
      }
    };

    fetchLineas();
  }, [user]);

  const handleAddPoint = (point: LatLngExpression) => {
    setPuntos((prev) => [...prev, point]);
  };

  const handleEliminarUltimoPunto = () => {
    setPuntos((prev) => prev.slice(0, -1));
  };

  const handleLimpiarPuntos = () => {
    setPuntos([]);
  };

  const handleGuardarRuta = async () => {
    if (!lineaSeleccionada) {
      alert('Selecciona una línea antes de guardar.');
      return;
    }

    if (puntos.length < 2) {
      alert('Debe haber al menos 2 puntos en la ruta.');
      return;
    }

    setGuardando(true);
    try {
      const puntosGeo = (puntos as [number, number][]).map(([lat, lng]) => new GeoPoint(lat, lng));

      await addDoc(collection(db, 'RutasPropuestas'), {
        lineaId: lineaSeleccionada,
        propuestaIdaVuelta: direccion,
        puntosGrabados: puntosGeo,
        estadoPropuesta: 'pendiente',
        propuestoPorAuthUid: user?.uid ?? 'desconocido',
        fechaPropuesta: serverTimestamp(),
      });

      alert('Ruta propuesta guardada correctamente.');
      onClose();
    } catch (err) {
      console.error('Error al guardar ruta:', err);
      alert('Error al guardar ruta.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl h-5/6 flex flex-col">
        {/* 🟦 Header */}
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Crear Nueva Ruta Propuesta
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* 🟧 Selectores */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 gap-4">
          {/* Selector de línea */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Línea
            </label>
            {cargandoLineas ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Cargando líneas...</p>
            ) : (
              <select
                value={lineaSeleccionada}
                onChange={(e) => setLineaSeleccionada(e.target.value)}
                className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Selecciona una línea...</option>
                {lineas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selector de dirección */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Dirección
            </label>
            <select
              value={direccion}
              onChange={(e) => setDireccion(e.target.value as 'ida' | 'vuelta')}
              className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
            >
              <option value="ida">Ida</option>
              <option value="vuelta">Vuelta</option>
            </select>
          </div>
        </div>

        {/* 🗺️ Mapa */}
        <div className="grow relative">
          <MapContainer
            center={[-15.4985, -70.1338]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onAddPoint={handleAddPoint} />
            {puntos.map((p, i) => (
              <Marker key={i} position={p} />
            ))}
            {puntos.length > 1 && <Polyline positions={puntos} color="blue" weight={5} />}
          </MapContainer>
        </div>

        {/* 🟩 Footer con tres botones */}
        <div className="flex justify-end items-center gap-3 p-4 border-t dark:border-gray-700">
          <button
            onClick={handleEliminarUltimoPunto}
            disabled={puntos.length === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Eliminar Último Punto
          </button>

          <button
            onClick={handleLimpiarPuntos}
            disabled={puntos.length === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Limpiar Puntos
          </button>

          <button
            onClick={handleGuardarRuta}
            disabled={guardando}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar Ruta'}
          </button>
        </div>
      </div>
    </div>
  );
}
