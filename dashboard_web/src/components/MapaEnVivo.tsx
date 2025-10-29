/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  LayersControl,
  LayerGroup,
  Polyline,
  Tooltip
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L, { LatLngExpression } from 'leaflet';
import {
  collection,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  GeoPoint,
  query,
  where,
  getDocs,
  limit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';

// --- Arreglo Íconos Leaflet ---
// @ts-expect-error Leaflet y React tienen un bug conocido con la URL del ícono
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png'
});
// --- Fin Arreglo Íconos ---

// --- Interfaces ---
interface Vehiculo {
  id: string;
  placa: string;
  estado: string;
  posicion: LatLngExpression;
  lineaId?: string;
}

interface LineaData {
  id: string;
  nombre: string;
  color: string;
  rutaIda: LatLngExpression[];
  rutaVuelta: LatLngExpression[];
}
// --- Fin Interfaces ---

// --- Iconos Personalizados ---
const createColoredIcon = (color: string) => {
  return L.divIcon({
    html: `<span style="background-color: ${color}; width: 1.5rem; height: 1.5rem; display: block; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></span>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const iconEnRutaIda = createColoredIcon('green');
const iconEnRutaVuelta = createColoredIcon('blue');
const iconEnTerminal = createColoredIcon('orange');
const iconFueraServicio = createColoredIcon('grey');
const iconDefault = createColoredIcon('red');

const getIconForEstado = (estado: string) => {
  if (estado === 'en_ruta_ida') return iconEnRutaIda;
  if (estado === 'en_ruta_vuelta') return iconEnRutaVuelta;
  if (estado === 'en_terminal_1' || estado === 'en_terminal_2') return iconEnTerminal;
  if (estado === 'fuera_de_servicio') return iconFueraServicio;
  return iconDefault;
};

// Ajustar color (para rutas de vuelta)
function adjustColor(color: string, amount: number): string {
  const validHex = /^#[0-9A-F]{6}$/i.test(color) ? color : '#FF0000';
  try {
    return (
      '#' +
      validHex
        .replace(/^#/, '')
        .replace(/../g, (hex) =>
          ('0' + Math.min(255, Math.max(0, parseInt(hex, 16) + amount)).toString(16)).substr(-2)
        )
    );
  } catch (e) {
    console.error('Error adjusting color:', color, e);
    return '#CCCCCC';
  }
}
// --- Fin Iconos ---

export default function MapaEnVivo() {
  const { user, isLoading: isLoadingAuth } = useAuth();

  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [lineas, setLineas] = useState<LineaData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminEmpresaId, setAdminEmpresaId] = useState<string | null>(null);
  const [selectedLinea, setSelectedLinea] = useState<string | null>(null);

  const initialCenter: LatLngExpression = [-15.4985, -70.1338];
  const initialZoom = 13;

  // --- 1. Obtener empresaId del admin ---
  useEffect(() => {
    if (!isLoadingAuth) {
      if (user) {
        async function fetchEmpresaId() {
          if (!user) {
            setError('Usuario no disponible al buscar empresa.');
            setIsLoading(false);
            return;
          }
          try {
            const q = query(collection(db, 'Empresas'), where('adminAuthUid', '==', user.uid), limit(1));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              setAdminEmpresaId(querySnapshot.docs[0].id);
              setError(null);
            } else {
              console.warn('No se encontró empresa para este administrador:', user.uid);
              setError('No se encontró empresa asignada a tu cuenta.');
              setIsLoading(false);
            }
          } catch (e) {
            console.error('Error buscando empresa del admin:', e);
            setError('Error al obtener datos de la empresa.');
            setIsLoading(false);
          }
        }
        fetchEmpresaId();
      } else {
        setError('Usuario no autenticado.');
        setIsLoading(false);
      }
    }
  }, [user, isLoadingAuth]);

  // --- 2. Listener de Líneas ---
  useEffect(() => {
    if (!adminEmpresaId || isLoadingAuth) {
      if (!isLoadingAuth) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const qLineas = query(collection(db, 'Lineas'), where('empresaId', '==', adminEmpresaId));

    const unsubscribe = onSnapshot(
      qLineas,
      (querySnapshot: QuerySnapshot<DocumentData>) => {
        const lineasData: LineaData[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const rutaIdaLatLng: LatLngExpression[] =
            (data.rutaIda as GeoPoint[] ?? []).map((gp) => [gp.latitude, gp.longitude]);
          const rutaVueltaLatLng: LatLngExpression[] =
            (data.rutaVuelta as GeoPoint[] ?? []).map((gp) => [gp.latitude, gp.longitude]);
          lineasData.push({
            id: doc.id,
            nombre: data.nombre ?? 'Sin Nombre',
            color: data.color ?? '#FF0000',
            rutaIda: rutaIdaLatLng,
            rutaVuelta: rutaVueltaLatLng
          });
        });
        setLineas(lineasData);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error escuchando líneas:', err);
        setError((prev) => prev || 'Error al cargar las rutas oficiales.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [adminEmpresaId, isLoadingAuth]);

  // --- 3. Listener de Vehículos (filtrado por empresa) ---
  useEffect(() => {
    if (!adminEmpresaId || isLoadingAuth) {
      if (!isLoadingAuth) setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const qLineas = query(collection(db, 'Lineas'), where('empresaId', '==', adminEmpresaId));
    getDocs(qLineas)
      .then((lineasSnapshot) => {
        const lineaIds = lineasSnapshot.docs.map((doc) => doc.id);

        if (lineaIds.length === 0) {
          console.warn('No hay líneas para esta empresa.');
          setVehiculos([]);
          setIsLoading(false);
          return;
        }

        const qVehiculos = query(
          collection(db, 'Vehiculos'),
          where('lineaId', 'in', lineaIds.slice(0, 10)) // Firestore limita "in" a máx. 10
        );

        const unsubscribe = onSnapshot(
          qVehiculos,
          (querySnapshot: QuerySnapshot<DocumentData>) => {
            const vehiculosData: Vehiculo[] = [];
            querySnapshot.forEach((doc) => {
              const data = doc.data();
              const ubicacion = data.ubicacionActual as GeoPoint | undefined;
              if (data.placa && data.estado && ubicacion) {
                vehiculosData.push({
                  id: doc.id,
                  placa: data.placa,
                  estado: data.estado,
                  posicion: [ubicacion.latitude, ubicacion.longitude],
                  lineaId: data.lineaId
                });
              }
            });
            setVehiculos(vehiculosData);
            setIsLoading(false);
          },
          (err) => {
            console.error('Error escuchando vehículos:', err);
            setError((prev) => prev || 'Error al cargar vehículos.');
            setIsLoading(false);
          }
        );

        return () => unsubscribe();
      })
      .catch((err) => {
        console.error('Error obteniendo líneas de la empresa para filtrar vehículos:', err);
        setError('Error al preparar filtro de vehículos.');
        setIsLoading(false);
      });
  }, [adminEmpresaId, isLoadingAuth]);

  // --- Renderizado Condicional ---
  if (isLoading)
    return (
      <div className="flex justify-center items-center h-full">
        <p>Cargando mapa y datos...</p>
      </div>
    );

  if (error)
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-red-500">{error}</p>
      </div>
    );

  if (vehiculos.length === 0 && lineas.length === 0)
    return (
      <div className="flex justify-center items-center h-full">
        <p>No hay datos de vehículos o rutas para mostrar.</p>
      </div>
    );

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* --- Filtro visual por línea --- */}
      <div
  style={{
    position: 'absolute',
    top: 10, // alineado con los botones
    left: 60, // movido a la derecha de los +/-
    zIndex: 1500,
    background: 'rgba(255, 255, 255, 0.95)',
    padding: '10px 14px',
    borderRadius: '10px',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.25)',
    fontFamily: 'Inter, sans-serif',
    color: '#333',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }}
>
  <label
    style={{
      fontWeight: 700,
      whiteSpace: 'nowrap'
    }}
  >
    Filtrar por línea:
  </label>
  <select
    value={selectedLinea ?? ''}
    onChange={(e) => setSelectedLinea(e.target.value || null)}
    style={{
      padding: '6px 8px',
      borderRadius: '6px',
      border: '1px solid #ccc',
      background: 'white',
      color: '#333',
      cursor: 'pointer',
      outline: 'none'
    }}
  >
    <option value="">Todas</option>
    {lineas.map((linea) => (
      <option key={linea.id} value={linea.nombre}>
        {linea.nombre}
      </option>
    ))}
  </select>
</div>


      {/* --- MAPA PRINCIPAL --- */}
      <MapContainer center={initialCenter} zoom={initialZoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <LayersControl position="topright">
          {/* Vehículos */}
          <LayersControl.Overlay checked name="Vehículos">
            <LayerGroup>
              {vehiculos
                .filter((v) => {
                  if (!selectedLinea) return true;
                  const linea = lineas.find((l) => l.id === v.lineaId);
                  return linea?.nombre === selectedLinea;
                })
                .map((v) => (
                  <Marker key={v.id} position={v.posicion} icon={getIconForEstado(v.estado)}>
                    <Popup>
                      <b>Placa:</b> {v.placa}
                      <br />
                      <b>Estado:</b> {v.estado.replace(/_/g, ' ')}
                    </Popup>
                  </Marker>
                ))}
            </LayerGroup>
          </LayersControl.Overlay>

          {/* Rutas IDA */}
          <LayersControl.Overlay checked name="Rutas (IDA)">
            <LayerGroup>
              {lineas
                .filter((l) => !selectedLinea || l.nombre === selectedLinea)
                .map(
                  (l) =>
                    l.rutaIda.length > 0 && (
                      <Polyline
                        key={`${l.id}-ida`}
                        positions={l.rutaIda}
                        color={l.color}
                        weight={6}
                        opacity={0.85}
                      >
                        <Tooltip sticky>{l.nombre} (IDA)</Tooltip>
                      </Polyline>
                    )
                )}
            </LayerGroup>
          </LayersControl.Overlay>

          {/* Rutas VUELTA */}
          <LayersControl.Overlay checked name="Rutas (VUELTA)">
            <LayerGroup>
              {lineas
                .filter((l) => !selectedLinea || l.nombre === selectedLinea)
                .map(
                  (l) =>
                    l.rutaVuelta.length > 0 && (
                      <Polyline
                        key={`${l.id}-vuelta`}
                        positions={l.rutaVuelta}
                        color={adjustColor(l.color, 80)}
                        weight={4}
                        opacity={0.75}
                        dashArray="5, 8"
                      >
                        <Tooltip sticky>{l.nombre} (VUELTA)</Tooltip>
                      </Polyline>
                    )
                )}
            </LayerGroup>
          </LayersControl.Overlay>
        </LayersControl>
      </MapContainer>
    </div>
  );
}
