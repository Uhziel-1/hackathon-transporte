'use client';

import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  limit,
  GeoPoint,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import { Play, Square, MapPin, Loader2 } from 'lucide-react';

// Turf (imports por submódulo para evitar problemas de typing)
import { lineString } from '@turf/helpers';
import length from '@turf/length';
import along from '@turf/along';
import type { Feature as GeoJsonFeature, LineString as GeoJsonLineString, Position as GeoJsonPosition } from 'geojson';

// Tipos de unidades que usamos (definido localmente)
type TurfUnits =
  | 'degrees'
  | 'radians'
  | 'miles'
  | 'kilometers'
  | 'kilometres'
  | 'meters'
  | 'metres'
  | 'inches'
  | 'yards'
  | 'nauticalmiles';

// -------------------- Interfaces --------------------
interface VehiculoSim {
  id: string;
  placa: string;
  lineaId: string;
  lineaNombre: string;
  estado: string;
}
interface LineaSim {
  id: string;
  nombre: string;
  terminal1Id: string | null;
  terminal2Id: string | null;
  rutaIda: GeoPoint[];
  rutaVuelta: GeoPoint[];
}
// ----------------------------------------------------

// Registro global de timers (persistente entre renders)
const activeSimulationTimers = new Map<string, NodeJS.Timeout | number>();

export default function SimuladorVehiculos() {
  const { user, isLoading: isLoadingAuth } = useAuth();

  // Estados principales
  const [adminEmpresaId, setAdminEmpresaId] = useState<string | null>(null);
  const [lineas, setLineas] = useState<Map<string, LineaSim>>(new Map());
  const [vehiculos, setVehiculos] = useState<VehiculoSim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Controles globales
  const [intervaloMs, setIntervaloMs] = useState<number>(2000); // tick
  const [metrosPorTick, setMetrosPorTick] = useState<number>(50);
  const [dispatchDelayMs, setDispatchDelayMs] = useState<number>(10000); // 10s entre lanzamientos
  const [terminalWaitMs, setTerminalWaitMs] = useState<number>(30000); // espera en terminal
  const [autoReturn, setAutoReturn] = useState<boolean>(true);
  const [filtroLineaId, setFiltroLineaId] = useState<string>('all'); // 'all' o id de linea

  // Estado para forzar rerender UI cuando timers cambian
  const [, setSimState] = useState(0);
  const forceUpdate = () => setSimState(s => s + 1);

  // ------------------ 1) Obtener empresa del admin ------------------
  useEffect(() => {
    if (!isLoadingAuth && user) {
      const fetchEmpresaId = async () => {
        setIsLoading(true);
        try {
          const q = query(collection(db, 'Empresas'), where('adminAuthUid', '==', user.uid), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) setAdminEmpresaId(snap.docs[0].id);
          else {
            setError('No se encontró empresa para este administrador.');
            setIsLoading(false);
          }
        } catch (e) {
          console.error('Error fetching empresa:', e);
          setError('Error al obtener empresa.');
          setIsLoading(false);
        }
      };
      fetchEmpresaId();
    } else if (!isLoadingAuth && !user) {
      setError('Usuario no autenticado.');
      setIsLoading(false);
    }
  }, [user, isLoadingAuth]);

  // ------------------ 2) Cargar líneas y escuchar vehículos ------------------
  useEffect(() => {
    if (!adminEmpresaId) return;
    let unsubscribeVehiculos = () => {};

    const fetchLineasAndSubscribe = async () => {
      setIsLoading(true);
      try {
        const qLineas = query(collection(db, 'Lineas'), where('empresaId', '==', adminEmpresaId));
        const lineasSnap = await getDocs(qLineas);
        const map = new Map<string, LineaSim>();
        const lineaIds: string[] = [];

        lineasSnap.forEach(d => {
          const data = d.data();
          map.set(d.id, {
            id: d.id,
            nombre: data.nombre ?? 'Sin Nombre',
            terminal1Id: data.terminal1Id ?? null,
            terminal2Id: data.terminal2Id ?? null,
            rutaIda: data.rutaIda ?? [],
            rutaVuelta: data.rutaVuelta ?? [],
          });
          lineaIds.push(d.id);
        });

        setLineas(map);

        if (lineaIds.length === 0) {
          setVehiculos([]);
          setIsLoading(false);
          return;
        }

        // Si hay más de 30 IDs necesitaríamos particionar. Aquí asumimos <=30.
        const qVehiculos = query(collection(db, 'Vehiculos'), where('lineaId', 'in', lineaIds));
        unsubscribeVehiculos = onSnapshot(qVehiculos, snapshot => {
          const arr: VehiculoSim[] = [];
          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            arr.push({
              id: docSnap.id,
              placa: data.placa ?? 'Sin Placa',
              lineaId: data.lineaId ?? '',
              lineaNombre: map.get(data.lineaId)?.nombre ?? 'Línea Desc.',
              estado: data.estado ?? 'fuera_de_servicio',
            });
          });
          setVehiculos(arr.sort((a, b) => a.placa.localeCompare(b.placa)));
          setIsLoading(false);
          forceUpdate();
        }, err => {
          console.error('Error vehiculos snapshot:', err);
          setError('Error al cargar vehículos.');
          setIsLoading(false);
        });

      } catch (err) {
        console.error('Error fetchLineasAndSubscribe', err);
        setError('Error al cargar datos.');
        setIsLoading(false);
      }
    };

    fetchLineasAndSubscribe();

    return () => {
      try { unsubscribeVehiculos(); } catch { /* noop */ }
    };
  }, [adminEmpresaId]);

  // ------------------ 3) Limpieza de timers on unload ------------------
  useEffect(() => {
    const onUnload = () => {
      activeSimulationTimers.forEach(t => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        try { clearInterval(t as any); } catch {}
      });
      activeSimulationTimers.clear();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  // ------------------ Helpers ------------------
  const getLinea = (id: string) => lineas.get(id);

  // ------------------ Stop single simulation ------------------
  const handleStopSimulation = async (vehiculoId: string, estadoFinal: string = 'fuera_de_servicio') => {
    const timer = activeSimulationTimers.get(vehiculoId);
    if (timer) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try { clearInterval(timer as any); } catch {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try { clearTimeout(timer as any); } catch {}
      activeSimulationTimers.delete(vehiculoId);
      forceUpdate();
    }
    try {
      await updateDoc(doc(db, 'Vehiculos', vehiculoId), {
        estado: estadoFinal,
        lastUpdateTimestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error updating stop state:', err);
    }
  };

  // ------------------ Start single simulation ------------------
  // Nota: autoReturn y terminalWaitMs se gestionan en el flow masivo o pasando la bandera
  const handleStartSimulation = async (vehiculo: VehiculoSim, direccion: 'ida' | 'vuelta', optAutoReturn?: boolean, optTerminalWaitMs?: number) => {
    console.log(`Iniciando simulación para ${vehiculo.placa} (${direccion})`);
    // Detener previos timers si existen
    await handleStopSimulation(vehiculo.id, vehiculo.estado);

    const lineaInfo = getLinea(vehiculo.lineaId);
    if (!lineaInfo) { alert('No se encontraron datos de la línea'); return; }

    const rutaGP = direccion === 'ida' ? lineaInfo.rutaIda : lineaInfo.rutaVuelta;
    if (!rutaGP || rutaGP.length < 2) {
      alert(`Ruta ${direccion} no grabada para ${lineaInfo.nombre}`);
      return;
    }

    // Convertir GeoPoints a coords [lng, lat]
    const rutaCoords: GeoJsonPosition[] = rutaGP.map(gp => [gp.longitude, gp.latitude]);
    let rutaLine: GeoJsonFeature<GeoJsonLineString>;
    try { rutaLine = lineString(rutaCoords); } catch { alert('Error creando lineString'); return; }

    // Trabajamos en kilómetros con turf
    const unidades: TurfUnits = 'kilometers';
    const longitudTotalKm = length(rutaLine, { units: unidades });
    let distanciaRecorridaKm = 0;
    const kmPorTick = metrosPorTick / 1000;
    const msInterval = intervaloMs;
    const estadoRuta = direccion === 'ida' ? 'en_ruta_ida' : 'en_ruta_vuelta';

    // timerId debe existir en closure
    // eslint-disable-next-line prefer-const
    let timerId: NodeJS.Timeout | number;

    const simulationTick = async () => {
      // Si el timer fue eliminado externamente, salir
      if (!activeSimulationTimers.has(vehiculo.id)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        try { clearInterval(timerId as any); } catch {}
        return;
      }

      distanciaRecorridaKm += kmPorTick;

      let puntoGeo: GeoPoint;
      let llego = false;

      if (distanciaRecorridaKm >= longitudTotalKm) {
        distanciaRecorridaKm = longitudTotalKm;
        llego = true;
        const ultimo = rutaCoords[rutaCoords.length - 1];
        puntoGeo = new GeoPoint(ultimo[1], ultimo[0]);
      } else {
        const optionsAny = { units: 'kilometers' } as unknown as Parameters<typeof along>[2];
        const feature = along(rutaLine, distanciaRecorridaKm, optionsAny);
        const [lng, lat] = feature.geometry.coordinates;
        puntoGeo = new GeoPoint(lat, lng);
      }

      // Actualizamos Firestore con ubicacion y estado
      try {
        await updateDoc(doc(db, 'Vehiculos', vehiculo.id), {
          ubicacionActual: puntoGeo,
          estado: estadoRuta,
          lastUpdateTimestamp: serverTimestamp()
        });
      } catch (err) {
        console.error('Error updating location:', err);
        // si fallo, detener simulacion
        await handleStopSimulation(vehiculo.id, 'fuera_de_servicio');
        return;
      }

      // Log visual en consola (puedes comentar)
      // console.log(`${vehiculo.placa} @ ${distanciaRecorridaKm * 1000} m`);

      if (llego) {
        // Llegó al final: detener interval y actualizar estado a terminal
        const estadoFinalDB = direccion === 'ida' ? 'en_terminal_2' : 'en_terminal_1';
        try {
          await updateDoc(doc(db, 'Vehiculos', vehiculo.id), { estado: estadoFinalDB });
        } catch (e) { console.error('Error set terminal state:', e); }

        // limpiar interval actual
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        try { clearInterval(timerId as any); } catch {}
        activeSimulationTimers.delete(vehiculo.id);
        forceUpdate();

        // auto-retorno si está activado (preferimos la opción pasada, si existe)
        const willAutoReturn = typeof optAutoReturn === 'boolean' ? optAutoReturn : autoReturn;
        const waitMs = typeof optTerminalWaitMs === 'number' ? optTerminalWaitMs : terminalWaitMs;

        if (willAutoReturn) {
          const siguiente: 'ida' | 'vuelta' = direccion === 'ida' ? 'vuelta' : 'ida';
          const waitTimer = setTimeout(() => {
            // double-check: la ruta de retorno existe
            const rutaRetorno = siguiente === 'ida' ? lineaInfo.rutaIda : lineaInfo.rutaVuelta;
            if (!rutaRetorno || rutaRetorno.length < 2) {
              // no puede retornar
              console.warn(`No hay ruta de retorno para ${vehiculo.placa} (${siguiente})`);
              return;
            }
            handleStartSimulation(vehiculo, siguiente, willAutoReturn, waitMs);
          }, waitMs);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          activeSimulationTimers.set(vehiculo.id, waitTimer as any);
          forceUpdate();
        } else {
          // solo forzar refresh de UI
          forceUpdate();
        }
      }
    }; // end simulationTick

    // iniciar interval y registrar en map
    timerId = setInterval(simulationTick, msInterval);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activeSimulationTimers.set(vehiculo.id, timerId as any);
    forceUpdate();

    // ejecutar tick inicial inmediatamente
    simulationTick();
  };

  // ------------------ Ubicar vehiculo en terminal (usa Ubicaciones_POI) ------------------
  const handleUbicarEnTerminal = async (vehiculo: VehiculoSim, terminal: 1 | 2) => {
    console.log(`Ubicando ${vehiculo.placa} en T${terminal}`);
    await handleStopSimulation(vehiculo.id);

    const lineaInfo = getLinea(vehiculo.lineaId);
    if (!lineaInfo) return alert('Línea no encontrada');

    const terminalId = terminal === 1 ? lineaInfo.terminal1Id : lineaInfo.terminal2Id;
    if (!terminalId) return alert('Terminal no definida');

    try {
      const poiDoc = await getDoc(doc(db, 'Ubicaciones_POI', terminalId));
      if (!poiDoc.exists()) return alert('POI terminal no encontrado');
      const coord = poiDoc.data()?.coordenada as GeoPoint | undefined;
      if (!coord) return alert('POI sin coordenadas');

      const nuevoEstado = terminal === 1 ? 'en_terminal_1' : 'en_terminal_2';
      await updateDoc(doc(db, 'Vehiculos', vehiculo.id), {
        ubicacionActual: coord,
        estado: nuevoEstado,
        lastUpdateTimestamp: serverTimestamp()
      });
    } catch (err) {
      console.error('Error ubicando en terminal', err);
      alert('Error ubicando vehículo');
    }
  };

  // ------------------ Lanzamiento masivo por lotes (escalonado) ------------------
  const handleMassSimulate = (soloFiltrados: boolean) => {
    // construir lista segun filtro
    const list = (soloFiltrados && filtroLineaId !== 'all')
      ? vehiculos.filter(v => v.lineaId === filtroLineaId)
      : vehiculos.slice();

    let idx = 0;
    const lanzarSiguiente = () => {
      // buscar el próximo vehículo elegible
      while (idx < list.length && (activeSimulationTimers.has(list[idx].id) || list[idx].estado.startsWith('en_ruta_'))) {
        idx++;
      }
      if (idx >= list.length) {
        console.log('Lanzamiento masivo completado');
        return;
      }
      const v = list[idx];
      // decidir dirección inicial segun estado
      const startDir = (v.estado === 'en_terminal_2') ? 'vuelta' : 'ida';
      // iniciar
      handleStartSimulation(v, startDir, autoReturn, terminalWaitMs);
      idx++;
      // programar siguiente
      setTimeout(lanzarSiguiente, dispatchDelayMs);
    };

    lanzarSiguiente();
    alert(`Lanzando simulaciones (cada ${dispatchDelayMs / 1000}s).`);
  };

  // detener todas
  const handleMassStop = () => {
    console.log('Deteniendo todas las simulaciones...');
    const ids = Array.from(activeSimulationTimers.keys());
    ids.forEach(id => handleStopSimulation(id, 'fuera_de_servicio'));
    alert(`Se enviaron ${ids.length} órdenes de detención.`);
  };

  // ------------------ Renderizado ------------------
  if (isLoadingAuth) return <div className="text-center p-4">Verificando usuario...</div>;
  if (error) return <div className="text-center p-4 text-red-500">{error}</div>;
  if (isLoading) return <div className="text-center p-4">Cargando datos...</div>;

  const inputClasses = "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm";

  return (
    <div className="space-y-6">
      {/* Controles globales */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg shadow-sm">
        <h3 className="font-semibold text-lg mb-3 dark:text-white">Controles Globales de Simulación</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Filtrar por Línea</label>
            <select className={inputClasses} value={filtroLineaId} onChange={(e) => setFiltroLineaId(e.target.value)}>
              <option value="all">Todas las Líneas</option>
              {Array.from(lineas.values()).sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(l => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Lanzar cada (ms)</label>
            <input type="number" className={inputClasses} value={dispatchDelayMs} onChange={(e) => setDispatchDelayMs(Math.max(500, parseInt(e.target.value) || 500))} />
            <p className="text-xs text-gray-500 mt-1">Retraso entre lanzamientos.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Retorno automático</label>
            <div className="mt-2 flex items-center gap-2">
              <input id="autoReturn" type="checkbox" checked={autoReturn} onChange={(e)=>setAutoReturn(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="autoReturn" className="text-sm dark:text-gray-300">Activado</label>
            </div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-3">Espera en terminal (ms)</label>
            <input type="number" className={inputClasses} value={terminalWaitMs} onChange={(e)=>setTerminalWaitMs(Math.max(0, parseInt(e.target.value)||0))} />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={() => handleMassSimulate(true)} disabled={vehiculos.length === 0 || filtroLineaId === 'all'} className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">
            <Play size={16} className="inline-block mr-2"/> Simular Línea Filtrada
          </button>
          <button onClick={() => handleMassSimulate(false)} disabled={vehiculos.length === 0} className="px-3 py-2 bg-green-700 text-white rounded-md hover:bg-green-800 disabled:opacity-50">
            <Play size={16} className="inline-block mr-2"/> Simular TODOS
          </button>
          <button onClick={handleMassStop} disabled={activeSimulationTimers.size === 0} className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
            <Square size={16} className="inline-block mr-2"/> Detener TODO
          </button>
        </div>
      </div>

      {/* Controles de velocidad globales */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Intervalo tick (ms)</label>
            <input type="number" className={inputClasses} value={intervaloMs} onChange={(e)=>setIntervaloMs(Math.max(500, parseInt(e.target.value)||500))} />
            <p className="text-xs text-gray-500 mt-1">Tiempo entre actualizaciones de posición.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Distancia / tick (metros)</label>
            <input type="number" className={inputClasses} value={metrosPorTick} onChange={(e)=>setMetrosPorTick(Math.max(1, parseInt(e.target.value)||1))} />
            <p className="text-xs text-gray-500 mt-1">Velocidad efectiva (m por tick).</p>
          </div>
        </div>
      </div>

      {/* Tabla de vehículos */}
      <div className="overflow-x-auto shadow-md rounded-lg bg-white dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehículo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {vehiculos.filter(v => filtroLineaId === 'all' || v.lineaId === filtroLineaId).map(v => {
              const linea = getLinea(v.lineaId);
              const isSim = activeSimulationTimers.has(v.id);
              const puedeIda = !!linea && linea.rutaIda && linea.rutaIda.length >= 2;
              const puedeVuelta = !!linea && linea.rutaVuelta && linea.rutaVuelta.length >= 2;
              const puedeT1 = !!linea && !!linea.terminal1Id;
              const puedeT2 = !!linea && !!linea.terminal2Id;

              return (
                <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{v.placa}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{linea?.nombre ?? 'Línea no encontrada'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      isSim ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                      (v.estado.startsWith('en_terminal') ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300')
                    }`}>
                      {v.estado.replace(/_/g, ' ')} {isSim && <Loader2 size={12} className="animate-spin ml-1 inline-block" />}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {isSim ? (
                      <button onClick={() => handleStopSimulation(v.id, 'fuera_de_servicio')} className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white rounded-md text-xs">
                        <Square size={14} className="mr-1" /> Detener
                      </button>
                    ) : (
                      <>
                        <button onClick={() => handleUbicarEnTerminal(v, 1)} disabled={!puedeT1} className="inline-flex items-center px-3 py-1.5 border rounded-md text-xs">
                          <MapPin size={14} className="mr-1" /> T1
                        </button>
                        <button onClick={() => handleUbicarEnTerminal(v, 2)} disabled={!puedeT2} className="inline-flex items-center px-3 py-1.5 border rounded-md text-xs">
                          <MapPin size={14} className="mr-1" /> T2
                        </button>

                        {(v.estado === 'en_terminal_1' || v.estado === 'fuera_de_servicio') && (
                          <button onClick={() => handleStartSimulation(v, 'ida', autoReturn, terminalWaitMs)} disabled={!puedeIda} className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-md text-xs">
                            <Play size={14} className="mr-1" /> IDA
                          </button>
                        )}
                        {(v.estado === 'en_terminal_2' || v.estado === 'fuera_de_servicio') && (
                          <button onClick={() => handleStartSimulation(v, 'vuelta', autoReturn, terminalWaitMs)} disabled={!puedeVuelta} className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs">
                            <Play size={14} className="mr-1" /> VUELTA
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
