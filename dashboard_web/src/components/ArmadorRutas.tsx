'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L, { LatLngExpression, LatLngBoundsExpression } from 'leaflet';
import { db } from '@/lib/firebase';
import { collection, query, where, doc, getDocs, limit, updateDoc, GeoPoint } from 'firebase/firestore';
import { useAuth } from '@/app/context/AuthContext';
import { Plus, X, ArrowUp, ArrowDown, Save, Loader2, Search, Trash2 } from 'lucide-react';

// --- Arreglo Íconos Leaflet ---
// @ts-expect-error bug conocido de leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});
// --- Fin Arreglo ---

// --- Interfaces y Tipos ---
type GeoJsonPosition = [number, number, ...(number[])];

interface GeoJsonFeature {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: { [key: string]: any };
  geometry: {
    type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    coordinates: any;
  };
  tempId: number;
}

interface LineaDataSimple {
  id: string;
  nombre: string;
}
// --- Fin Interfaces ---

// --- Helper: convertir fragmento GeoJSON a coordenadas [lat, lng] ---
function invertirCoordenadas(coords: [number, number][]): [number, number][] {
  return [...coords].reverse();
}

function fragmentToLatLngs(fragment: GeoJsonFeature): [number, number][] {
  const geom = fragment.geometry;
  if (!geom || !geom.coordinates) return [];

  // LineString -> [ [lng,lat], [lng,lat], ... ]
  if (geom.type === 'LineString') {
    return (geom.coordinates as GeoJsonPosition[])
      .filter(c => Array.isArray(c) && c.length >= 2 && typeof c[0] === 'number' && typeof c[1] === 'number')
      .map(c => [c[1], c[0]]);
  }

  // MultiLineString -> concat de las líneas internas
  if (geom.type === 'MultiLineString') {
    return (geom.coordinates as GeoJsonPosition[][])
      .flat()
      .filter(c => Array.isArray(c) && c.length >= 2 && typeof c[0] === 'number' && typeof c[1] === 'number')
      .map(c => [c[1], c[0]]);
  }

  return [];
}

// --- Componente Auxiliar de Mapa ---
const PreviewMap: React.FC<{ polyline: LatLngExpression[] }> = ({ polyline }) => {
  let bounds: LatLngBoundsExpression | undefined = undefined;
  if (polyline.length > 0) {
    bounds = L.latLngBounds(polyline);
  }

  const AdjustBounds: React.FC = () => {
    const map = useMap();
    useEffect(() => {
      if (bounds) {
        setTimeout(() => map.fitBounds(bounds!, { padding: [20, 20] }), 100);
      } else {
        setTimeout(() => map.setView([-15.4985, -70.1338], 13), 100);
      }
    }, [map]);
    return null;
  };

  const MapMarkers: React.FC = () => {
    const map = useMap();

    useEffect(() => {
      // Limpiar markers previos
      map.eachLayer(layer => {
        // Solo remover los markers personalizados, no el tilelayer ni la polyline
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (layer instanceof L.Marker && (layer.options.icon as any)?._isCustom) {
          map.removeLayer(layer);
        }
      });

      if (polyline.length > 1) {
        const inicio = polyline[0] as [number, number];
        const fin = polyline[polyline.length - 1] as [number, number];

        // Íconos personalizados
        const iconInicio = L.divIcon({
          className: 'custom-icon-inicio',
          html: `<div style="color:green; font-weight:bold; font-size:14px;">🟢 1</div>`,
          iconSize: [25, 25],
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (iconInicio as any)._isCustom = true;

        const iconFin = L.divIcon({
          className: 'custom-icon-fin',
          html: `<div style="color:red; font-weight:bold; font-size:14px;">🔴 ${polyline.length}</div>`,
          iconSize: [25, 25],
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (iconFin as any)._isCustom = true;

        const markerInicio = L.marker(inicio, { icon: iconInicio });
        const markerFin = L.marker(fin, { icon: iconFin });

        markerInicio.bindTooltip('Inicio (1)', { permanent: true, direction: 'top' });
        markerFin.bindTooltip(`Final (${polyline.length})`, { permanent: true, direction: 'top' });

        markerInicio.addTo(map);
        markerFin.addTo(map);
      }
    }, [map]);

    return null;
  };

  return (
    <MapContainer
      key={JSON.stringify(polyline)} // Fuerza re-render si cambia
      center={[-15.4985, -70.1338]}
      zoom={13}
      style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
      scrollWheelZoom={true}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {polyline.length > 0 && <Polyline positions={polyline} color="blue" weight={5} />}
      <AdjustBounds />
      <MapMarkers />
    </MapContainer>
  );
};

export default function ArmadorRutas() {
  const { user } = useAuth();
  const [, setAdminEmpresaId] = useState<string | null>(null);

  const [allFragments, setAllFragments] = useState<GeoJsonFeature[]>([]);
  const [stagedFragments, setStagedFragments] = useState<(GeoJsonFeature & { invertido?: boolean })[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [lineas, setLineas] = useState<LineaDataSimple[]>([]);
  const [selectedLineaId, setSelectedLineaId] = useState('');
  const [selectedDireccion, setSelectedDireccion] = useState<'ida' | 'vuelta'>('ida');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- 1. Cargar Empresa ID y Líneas ---
  useEffect(() => {
    if (user) {
      const fetchAdminData = async () => {
        setIsLoading(true);
        try {
          const qEmpresa = query(collection(db, 'Empresas'), where('adminAuthUid', '==', user.uid), limit(1));
          const empresaSnap = await getDocs(qEmpresa);
          if (empresaSnap.empty) throw new Error('No se encontró empresa para este administrador.');

          const empresaId = empresaSnap.docs[0].id;
          setAdminEmpresaId(empresaId);

          const qLineas = query(collection(db, 'Lineas'), where('empresaId', '==', empresaId));
          const lineasSnap = await getDocs(qLineas);
          const lineasData = lineasSnap.docs.map(doc => ({
            id: doc.id,
            nombre: doc.data().nombre ?? 'Sin Nombre',
          }));
          setLineas(lineasData.sort((a, b) => a.nombre.localeCompare(b.nombre)));
          console.log(`Cargadas ${lineasData.length} líneas.`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          console.error('Error cargando datos de admin:', err);
          setError(err.message);
        }
      };
      fetchAdminData();
    }
  }, [user]);

  // --- 2. Cargar GeoJSON ---
  useEffect(() => {
    const fetchGeoJson = async () => {
      console.log('Intentando cargar /rutas_juliaca.geojson...');
      try {
        const response = await fetch('/rutas_juliaca.geojson');
        if (!response.ok) throw new Error(`HTTP ${response.status} - Asegúrate que el archivo esté en /public`);

        const data = await response.json();

        const lineFragments = data.features
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((f: any) => {
            const geomType = f.geometry?.type;
            const name = f.properties?.name;
            const nameStr = typeof name === 'string' ? name.toLowerCase() : '';

            return (
              (geomType === 'LineString' || geomType === 'MultiLineString') &&
              nameStr &&
              !nameStr.includes('zona rigida') &&
              !nameStr.includes('poligono')
            );
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((f: any, index: number) => ({ ...f, tempId: index }));

        console.log(`GeoJSON cargado. Filtrados ${lineFragments.length} fragmentos.`);
        setAllFragments(lineFragments);
        setError(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.error('Error cargando GeoJSON:', err);
        setError("Error al cargar 'rutas_juliaca.geojson': " + err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGeoJson();
  }, []);

  // --- 3. Lógica del Armador ---
  const displayedFragments = useMemo(() => {
    if (searchTerm.trim() === '') return allFragments;
    return allFragments.filter(f => f.properties?.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [allFragments, searchTerm]);

  const previewPolyline = useMemo(() => {
    const polyline: LatLngExpression[] = [];
    stagedFragments.forEach(fragment => {
      let coords = fragmentToLatLngs(fragment);
      if (fragment.invertido) coords = invertirCoordenadas(coords);
      polyline.push(...coords);
    });
    return polyline;
  }, [stagedFragments]);


  // --- Handlers ---
  const handleAddFragment = (fragment: GeoJsonFeature) => setStagedFragments(prev => [...prev, fragment]);
  const handleRemoveFragment = (tempId: number) =>
    setStagedFragments(prev => prev.filter(f => f.tempId !== tempId));
  const handleClearStaged = () => setStagedFragments([]);
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= stagedFragments.length) return;
    const newList = [...stagedFragments];
    const item = newList.splice(index, 1)[0];
    newList.splice(newIndex, 0, item);
    setStagedFragments(newList);
  };

  const handleSaveToFirestore = async () => {
    if (!selectedLineaId) return alert('Selecciona una línea.');
    if (stagedFragments.length === 0) return alert('No hay fragmentos para guardar.');

    setIsSaving(true);
    try {
      const pointsToSave: GeoPoint[] = previewPolyline
        .map(p => (Array.isArray(p) && p.length === 2 ? new GeoPoint(p[0], p[1]) : null))
        .filter((p): p is GeoPoint => p !== null);

      const fieldToUpdate = selectedDireccion === 'ida' ? 'rutaIda' : 'rutaVuelta';
      const lineaRef = doc(db, 'Lineas', selectedLineaId);
      await updateDoc(lineaRef, { [fieldToUpdate]: pointsToSave });

      alert(`¡Éxito! Ruta ${selectedDireccion.toUpperCase()} guardada.`);
      setStagedFragments([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('Error al guardar en Firestore:', err);
      alert('Error al guardar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Renderizado ---
  if (isLoading) return <div className="text-center p-4">Cargando datos y GeoJSON...</div>;
  if (error) return <div className="text-center p-4 text-red-500">{error}</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
      {/* Panel 1 */}
      <div className="lg:col-span-1 flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-3 dark:text-white">Fragmentos KML Encontrados</h3>
        <div className="relative mb-2">
          <input
            type="text"
            placeholder="Buscar por nombre (ej: LINEA 10...)"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full input-form pl-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {displayedFragments.length > 0 ? (
            displayedFragments.map(fragment => (
              <div key={fragment.tempId} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                <span className="text-xs dark:text-gray-300 truncate" title={fragment.properties.name}>
                  {fragment.properties.name}
                  <span className="text-gray-400 ml-2">({fragment.geometry.coordinates.length} pts)</span>
                </span>
                <button onClick={() => handleAddFragment(fragment)} className="button-icon-primary-sm" title="Añadir al Armador">
                  <Plus size={16} />
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No se encontraron fragmentos.</p>
          )}
        </div>
      </div>

      {/* Panel 2 */}
      <div className="lg:col-span-1 flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold dark:text-white">Armador de Ruta ({stagedFragments.length})</h3>
          <button onClick={handleClearStaged} disabled={stagedFragments.length === 0} className="button-icon-danger-sm" title="Limpiar todo">
            <Trash2 size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {stagedFragments.length > 0 ? (
            stagedFragments.map((fragment, index) => (
              <div key={fragment.tempId} className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/50 rounded">
                <span className="text-xs dark:text-gray-300 truncate font-medium">
                  {index + 1}. {fragment.properties.name}
                  {fragment.invertido && <span className="ml-1 text-red-400">(Invertido)</span>}
                </span>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setStagedFragments(prev =>
                        prev.map(f =>
                          f.tempId === fragment.tempId ? { ...f, invertido: !f.invertido } : f
                        )
                      );
                    }}
                    className={`button-icon-secondary-sm ${fragment.invertido ? 'bg-red-500 text-white' : ''}`}
                    title="Invertir sentido del tramo"
                  >
                    ↕
                  </button>
                  <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="button-icon-secondary-sm"><ArrowUp size={16} /></button>
                  <button onClick={() => handleMove(index, 'down')} disabled={index === stagedFragments.length - 1} className="button-icon-secondary-sm"><ArrowDown size={16} /></button>
                  <button onClick={() => handleRemoveFragment(fragment.tempId)} className="button-icon-danger-sm"><X size={16} /></button>
                </div>
              </div>

            ))
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center p-4">
                Haz clic en `+` en el panel de &quot;Fragmentos&quot; para añadir partes de ruta aquí.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Panel 3 */}
      <div className="lg:col-span-1 flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
        <h3 className="text-lg font-semibold dark:text-white">Previsualizar y Guardar</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="linea_destino" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Línea de Destino</label>
            <select
              id="linea_destino"
              value={selectedLineaId}
              onChange={e => setSelectedLineaId(e.target.value)}
              className="mt-1 block w-full input-form dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Selecciona una línea...</option>
              {lineas.map(linea => (
                <option key={linea.id} value={linea.id}>{linea.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="direccion_destino" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dirección a Guardar</label>
            <select
              id="direccion_destino"
              value={selectedDireccion}
              onChange={e => setSelectedDireccion(e.target.value as 'ida' | 'vuelta')}
              className="mt-1 block w-full input-form dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="ida">Ida (rutaIda)</option>
              <option value="vuelta">Vuelta (rutaVuelta)</option>
            </select>
          </div>
        </div>
        <div className="flex-1 min-h-[200px]">
          <PreviewMap polyline={previewPolyline} />
        </div>
        <button
          onClick={handleSaveToFirestore}
          disabled={isSaving || !selectedLineaId || stagedFragments.length === 0}
          className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={18} className="animate-spin mr-2" /> : <Save size={16} className="mr-1" />}
          {isSaving ? 'Guardando...' : `Guardar en ${lineas.find(l => l.id === selectedLineaId)?.nombre ?? ''} (${selectedDireccion})`}
        </button>
      </div>
    </div>
  );
}
