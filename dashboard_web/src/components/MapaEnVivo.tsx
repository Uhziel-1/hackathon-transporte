'use client';

import React, { useState, useEffect } from 'react';
// Importar componentes necesarios de react-leaflet
// Se eliminó useMap de esta línea
import { MapContainer, TileLayer, Marker, Popup, LayersControl, LayerGroup, Polyline, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L, { LatLngExpression } from 'leaflet';
// Importar funciones de Firestore y tipos
import { collection, onSnapshot, QuerySnapshot, DocumentData, GeoPoint, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/app/context/AuthContext'; // Ajustar ruta si es necesario

// --- Arreglo Íconos Leaflet ---
// @ts-expect-error Leaflet y React tienen un bug conocido con la URL del ícono
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
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
    iconAnchor: [12, 12],
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
// Función para ajustar color de ruta de vuelta
function adjustColor(color: string, amount: number): string {
    const validHex = /^#[0-9A-F]{6}$/i.test(color) ? color : '#FF0000';
    try {
        return '#' + validHex.replace(/^#/, '').replace(/../g, hex => ('0'+Math.min(255, Math.max(0, parseInt(hex, 16) + amount)).toString(16)).substr(-2));
    } catch (e) {
        console.error("Error adjusting color:", color, e);
        return '#CCCCCC'; // Gris como fallback
    }
}
// --- Fin Iconos ---

export default function MapaEnVivo() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [lineas, setLineas] = useState<LineaData[]>([]);
  // Usar un solo estado de carga general para simplificar
  const [isLoading, setIsLoading] = useState(true);
  // Estados separados para datos específicos (opcional, pero puede ayudar a refinar UI)
  // const [isLoadingVehiculos, setIsLoadingVehiculos] = useState(true);
  // const [isLoadingLineas, setIsLoadingLineas] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminEmpresaId, setAdminEmpresaId] = useState<string | null>(null);

  const initialCenter: LatLngExpression = [-15.4985, -70.1338];
  const initialZoom = 13;

  // --- Efecto 1: Obtener empresaId del admin ---
   useEffect(() => {
     // Solo ejecutar si la autenticación ha terminado
     if (!isLoadingAuth) {
        // Si hay usuario, intentar buscar su empresa
        if (user) {
          async function fetchEmpresaId() {
            // CORRECCIÓN: Verificar user de nuevo DENTRO del async
            if (!user) {
              setError('Usuario no disponible al buscar empresa.');
              setIsLoading(false); // Detener carga general
              return;
            }
            try {
               const q = query(collection(db, 'Empresas'), where('adminAuthUid', '==', user.uid), limit(1));
               const querySnapshot = await getDocs(q);
               if (!querySnapshot.empty) {
                  setAdminEmpresaId(querySnapshot.docs[0].id);
                  setError(null); // Limpiar error si se encuentra
               } else {
                   console.warn('No se encontró empresa para este administrador:', user.uid);
                   setError('No se encontró empresa asignada a tu cuenta.');
                   setIsLoading(false); // Detener carga si no hay empresa
               }
            } catch(e) {
               console.error("Error buscando empresa del admin:", e);
               setError('Error al obtener datos de la empresa.');
               setIsLoading(false); // Detener carga si hay error
            }
          }
          fetchEmpresaId();
        } else {
          // Si no hay usuario, establecer error y detener carga
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setError('Usuario no autenticado.');
          setIsLoading(false);
        }
     }
     // Si isLoadingAuth es true, esperamos
   }, [user, isLoadingAuth]);

  // --- Efecto 2: Listener para Vehículos ---
  useEffect(() => {
    // Solo iniciar si tenemos empresaId y auth NO está cargando
    if (!adminEmpresaId || isLoadingAuth) {
        // Si auth ya terminó y aún no hay empresaId (probablemente por error), detener carga
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if(!isLoadingAuth) setIsLoading(false);
        return;
    }

    // Indicar carga ANTES de iniciar el listener
    setIsLoading(true);
    const unsubscribeVehiculos = onSnapshot(
        collection(db, 'Vehiculos'), // TODO: Filtrar por empresa
        (querySnapshot: QuerySnapshot<DocumentData>) => {
            const vehiculosData: Vehiculo[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const ubicacion = data.ubicacionActual as GeoPoint | undefined;
                // Asumiendo que filtramos después o no filtramos por ahora
                if (data.placa && data.estado && ubicacion) {
                    vehiculosData.push({
                        id: doc.id,
                        placa: data.placa,
                        estado: data.estado,
                        posicion: [ubicacion.latitude, ubicacion.longitude],
                        lineaId: data.lineaId,
                    });
                }
            });
            setVehiculos(vehiculosData);
            // Considerar setIsLoading(false) aquí si solo cargamos vehículos
        },
        (err) => {
            console.error("Error escuchando vehículos:", err);
            setError(prev => prev || "Error al cargar datos de vehículos.");
            setIsLoading(false); // Detener carga en caso de error
        }
    );

    // Limpieza
    return () => unsubscribeVehiculos();
  }, [adminEmpresaId, isLoadingAuth]); // Depende de adminEmpresaId y estado de Auth

  // --- Efecto 3: Listener para Líneas ---
  useEffect(() => {
     // Solo iniciar si tenemos empresaId y auth NO está cargando
     if (!adminEmpresaId || isLoadingAuth) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if(!isLoadingAuth) setIsLoading(false);
        return;
    }

    // Indicar carga ANTES de iniciar el listener
    setIsLoading(true);
    const qLineas = query(collection(db, 'Lineas'), where('empresaId', '==', adminEmpresaId));

    const unsubscribeLineas = onSnapshot(qLineas, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const lineasData: LineaData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const rutaIdaLatLng: LatLngExpression[] = (data.rutaIda as GeoPoint[] ?? [])
                                                    .map(gp => [gp.latitude, gp.longitude]);
        const rutaVueltaLatLng: LatLngExpression[] = (data.rutaVuelta as GeoPoint[] ?? [])
                                                    .map(gp => [gp.latitude, gp.longitude]);
        lineasData.push({
          id: doc.id,
          nombre: data.nombre ?? 'Sin Nombre',
          color: data.color ?? '#FF0000',
          rutaIda: rutaIdaLatLng,
          rutaVuelta: rutaVueltaLatLng,
        });
      });
      setLineas(lineasData);
      setIsLoading(false); // Carga completa (asumiendo que vehículos también)
      setError(null); // Limpiar error si carga bien
    }, (err) => {
      console.error("Error escuchando líneas:", err);
      setError(prev => prev || "Error al cargar las rutas oficiales.");
      setIsLoading(false); // Detener carga en caso de error
    });

    return () => unsubscribeLineas();
  }, [adminEmpresaId, isLoadingAuth]); // Depende de adminEmpresaId y estado de Auth

  // --- Renderizado Condicional ---
  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><p>Cargando mapa y datos...</p></div>;
  }

  if (error) {
     return <div className="flex justify-center items-center h-full"><p className="text-red-500">{error}</p></div>;
  }

  // Si no hay vehículos ni líneas después de cargar y sin errores
  if (vehiculos.length === 0 && lineas.length === 0) {
     return <div className="flex justify-center items-center h-full"><p>No hay datos de vehículos o rutas para mostrar para esta empresa.</p></div>;
  }

  return (
    <MapContainer center={initialCenter} zoom={initialZoom} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* --- Control de Capas --- */}
      <LayersControl position="topright">
        {/* Capa Base */}
        <LayersControl.BaseLayer checked name="Mapa Base">
             {/* Usamos un TileLayer simple aquí, el principal ya está fuera */}
             <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        </LayersControl.BaseLayer>

        {/* Capa de Vehículos */}
        <LayersControl.Overlay checked name="Vehículos">
          <LayerGroup>
            {vehiculos.map((vehiculo) => (
              <Marker
                key={vehiculo.id}
                position={vehiculo.posicion}
                icon={getIconForEstado(vehiculo.estado)}
              >
                <Popup>
                  <b>Placa:</b> {vehiculo.placa} <br />
                  <b>Estado:</b> {vehiculo.estado.replace(/_/g, ' ')}
                </Popup>
              </Marker>
            ))}
          </LayerGroup>
        </LayersControl.Overlay>

        {/* Capa de Rutas IDA */}
        <LayersControl.Overlay name="Rutas (IDA)">
          <LayerGroup>
            {lineas.map((linea) => (
               linea.rutaIda.length > 0 && (
                <Polyline
                  key={`${linea.id}-ida`}
                  positions={linea.rutaIda}
                  color={linea.color}
                  weight={4}
                  opacity={0.7}
                >
                  <Tooltip sticky>{linea.nombre} (IDA)</Tooltip>
                </Polyline>
              )
            ))}
          </LayerGroup>
        </LayersControl.Overlay>

        {/* Capa de Rutas VUELTA */}
         <LayersControl.Overlay name="Rutas (VUELTA)">
          <LayerGroup>
            {lineas.map((linea) => (
              linea.rutaVuelta.length > 0 && (
                <Polyline
                  key={`${linea.id}-vuelta`}
                  positions={linea.rutaVuelta}
                  color={adjustColor(linea.color, 60)}
                  weight={3}
                  opacity={0.6}
                  dashArray="5, 8"
                >
                   <Tooltip sticky>{linea.nombre} (VUELTA)</Tooltip>
                </Polyline>
              )
            ))}
          </LayerGroup>
        </LayersControl.Overlay>

      </LayersControl>
      {/* --- Fin Control de Capas --- */}

    </MapContainer>
  );
}

