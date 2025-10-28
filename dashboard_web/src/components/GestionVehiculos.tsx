'use client';

import React, { useState, useEffect } from 'react';
// Imports actualizados de firestore
import { collection, query, where, onSnapshot, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import { Plus, Edit } from 'lucide-react'; // Añadir Eye
import VehiculoModal from './VehiculoModal'; // El modal de CREAR/EDITAR

// Interfaces de datos
export interface VehiculoData {
  id: string;
  placa: string;
  lineaId: string;
  conductorId?: string | null;
  // empresaId ya no es requerido aquí, pero lo leemos si existe
  empresaId?: string; 
  estado: string;
}
export interface LineaDataSimple {
  id: string;
  nombre: string;
}
export interface ConductorDataSimple {
  id: string;
  nombre: string;
}

export default function GestionVehiculos() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [adminEmpresaId, setAdminEmpresaId] = useState<string | null>(null);
  
  // Listas completas de dependencias
  const [lineas, setLineas] = useState<LineaDataSimple[]>([]);
  const [conductores, setConductores] = useState<ConductorDataSimple[]>([]);
  // Lista principal de datos
  const [vehiculos, setVehiculos] = useState<VehiculoData[]>([]);
  
  // Estados de UI
  const [isLoading, setIsLoading] = useState(true); // Loading general
  const [isLoadingDeps, setIsLoadingDeps] = useState(true); // Loading para Líneas/Conductores
  const [error, setError] = useState<string | null>(null);
  const [filtroLineaId, setFiltroLineaId] = useState<string>('');

  // Estados para el modal
  const [showModal, setShowModal] = useState(false);
  const [vehiculoParaEditar, setVehiculoParaEditar] = useState<VehiculoData | null>(null);

  // --- 1. Obtener Empresa ID del Admin ---
  useEffect(() => {
    // Solo se ejecuta cuando el estado de autenticación cambia
    if (!isLoadingAuth && user) {
      async function fetchEmpresaId() {
        if (!user) { setError('Usuario no autenticado.'); setIsLoading(false); return; }
        console.log("[Paso 1] Verificando usuario...");
        setIsLoading(true); // Activar loading general
        try {
           const q = query(collection(db, 'Empresas'), where('adminAuthUid', '==', user.uid), limit(1));
           const querySnapshot = await getDocs(q);
           if (!querySnapshot.empty) {
              const empresaId = querySnapshot.docs[0].id;
              console.log("[Paso 1] Éxito. adminEmpresaId encontrado:", empresaId);
              setAdminEmpresaId(empresaId);
           } else { 
              console.error("Error: No se encontró empresa para este admin UID:", user.uid);
              setError('No se encontró empresa para este administrador.'); 
              setIsLoading(false); 
           }
        } catch(e) { 
            console.error("Error en Paso 1 (fetchEmpresaId):", e);
            setError('Error al obtener datos de la empresa.'); 
            setIsLoading(false); 
        }
      }
      fetchEmpresaId();
    } else if (!isLoadingAuth && !user) {
         setError('Usuario no autenticado.'); 
         setIsLoading(false);
    }
  }, [user, isLoadingAuth]); // Depende solo del estado de Auth

  // --- 2. Cargar Líneas y Conductores (Datos para los Modales) ---
  useEffect(() => {
    // Se ejecuta solo si tenemos el adminEmpresaId
    if (!adminEmpresaId) {
        console.log("[Paso 2] Esperando adminEmpresaId...");
        return; // Salir si no hay empresa
    }
    console.log("[Paso 2] adminEmpresaId detectado. Cargando Líneas y Conductores...");
    setIsLoadingDeps(true); // Activar loading de dependencias

    const fetchLineas = async () => {
        try {
            const qLineas = query(collection(db, 'Lineas'), where('empresaId', '==', adminEmpresaId));
            const lineasSnap = await getDocs(qLineas);
            const lineasData = lineasSnap.docs.map(doc => ({
                id: doc.id,
                nombre: doc.data().nombre ?? 'Sin Nombre',
            }));
            console.log(`[Paso 2] Líneas cargadas: ${lineasData.length} encontradas.`);
            setLineas(lineasData.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        } catch (err) { console.error("Error cargando líneas:", err); setError(prev => prev || "Error al cargar líneas."); }
    };

    const fetchConductores = async () => {
         try {
            const qConductores = query(collection(db, 'Conductores'), where('empresaId', '==', adminEmpresaId));
            const conductoresSnap = await getDocs(qConductores);
            const conductoresData = conductoresSnap.docs.map(doc => ({
                id: doc.id,
                nombre: doc.data().nombre ?? 'Sin Nombre',
            }));
            console.log(`[Paso 2] Conductores cargados: ${conductoresData.length} encontrados.`);
            setConductores(conductoresData.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        } catch (err) { console.error("Error cargando conductores:", err); setError(prev => prev || "Error al cargar conductores."); }
    };

    // Ejecutar ambas cargas en paralelo y desactivar loading de dependencias
    Promise.all([fetchLineas(), fetchConductores()]).finally(() => {
        console.log("[Paso 2] Carga de Líneas y Conductores finalizada.");
        setIsLoadingDeps(false);
    });
    
  }, [adminEmpresaId]); // Depende solo de adminEmpresaId

  // --- 3. Escuchar Vehículos de la Empresa (LÓGICA CORREGIDA Y ESTABLE) ---
  useEffect(() => {
    if (!adminEmpresaId || isLoadingDeps) {
      console.log(`[Paso 3] Esperando... adminEmpresaId: ${!!adminEmpresaId}, isLoadingDeps: ${isLoadingDeps}`);
      return;
    }

    if (lineas.length === 0) {
      console.log("[Paso 3] No hay líneas para esta empresa, no se buscarán vehículos.");
      setVehiculos([]);
      setIsLoading(false);
      return;
    }

    console.log(`[Paso 3] Líneas cargadas (${lineas.length}). Preparando consulta de vehículos...`);

    const lineaIds = lineas.map(l => l.id);

    let qVehiculos;
    if (filtroLineaId) {
      console.log(`[Paso 3a] Filtro activo. Buscando vehículos SOLO para línea: ${filtroLineaId}`);
      qVehiculos = query(collection(db, 'Vehiculos'), where('lineaId', '==', filtroLineaId));
    } else {
      console.log(`[Paso 3a] Sin filtro. Buscando vehículos para TODAS las líneas (${lineaIds.length}).`);
      // Firestore limita a 10 valores en "in", por si acaso validamos eso
      const grupos = [];
      for (let i = 0; i < lineaIds.length; i += 10) {
        grupos.push(lineaIds.slice(i, i + 10));
      }

      // Si hay más de 10, hacemos listeners múltiples
      const unsubscribes: (() => void)[] = [];
      setIsLoading(true);

      grupos.forEach(grupo => {
        const q = query(collection(db, 'Vehiculos'), where('lineaId', 'in', grupo));
        const unsub = onSnapshot(q, snapshot => {
          setVehiculos(prev => {
            // Fusionar resultados sin duplicar
            const nuevos = snapshot.docs.map(doc => ({
              id: doc.id,
              placa: doc.data().placa ?? 'Sin Placa',
              lineaId: doc.data().lineaId ?? '',
              conductorId: doc.data().conductorId ?? null,
              empresaId: doc.data().empresaId ?? '',
              estado: doc.data().estado ?? 'fuera_de_servicio',
            }));
            const combinados = [...prev.filter(v => !grupo.includes(v.lineaId)), ...nuevos];
            return combinados.sort((a, b) => a.placa.localeCompare(b.placa));
          });
          setIsLoading(false);
        });
        unsubscribes.push(unsub);
      });

      return () => {
        console.log("[Paso 3c] Limpiando listeners múltiples de vehículos.");
        unsubscribes.forEach(u => u());
      };
    }

    // --- Caso normal: una sola query (cuando hay filtro activo o <=10 líneas) ---
    setIsLoading(true);
    const unsubscribe = onSnapshot(
      qVehiculos,
      snapshot => {
        console.log(`[Paso 3b - Listener] Firestore devolvió ${snapshot.docs.length} vehículos.`);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          placa: doc.data().placa ?? 'Sin Placa',
          lineaId: doc.data().lineaId ?? '',
          conductorId: doc.data().conductorId ?? null,
          empresaId: doc.data().empresaId ?? '',
          estado: doc.data().estado ?? 'fuera_de_servicio',
        }));
        setVehiculos(data.sort((a, b) => a.placa.localeCompare(b.placa)));
        setIsLoading(false);
        setError(null);
      },
      err => {
        console.error("Error en [Paso 3b] (onSnapshot Vehiculos):", err);
        setError("Error al cargar vehículos.");
        setIsLoading(false);
      }
    );

    return () => {
      console.log("[Paso 3c] Limpiando listener de vehículos (único).");
      unsubscribe();
    };
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminEmpresaId, lineas, filtroLineaId]);


  // --- Handlers para Modales (sin cambios) ---
  const handleCrearVehiculo = () => {
    setVehiculoParaEditar(null);
    setShowModal(true);
  };
  const handleEditarVehiculo = (vehiculo: VehiculoData) => {
    setVehiculoParaEditar(vehiculo);
    setShowModal(true);
  };
  const handleCloseModal = () => {
    setShowModal(false);
    setVehiculoParaEditar(null);
  };
  
  // Mapear IDs a Nombres (sin cambios)
  const getLineaNombre = (lineaId: string) => lineas.find(l => l.id === lineaId)?.nombre ?? 'N/A';
  const getConductorNombre = (conductorId?: string | null) => conductores.find(c => c.id === conductorId)?.nombre ?? <span className="italic text-gray-500">Sin Asignar</span>;


  // --- Renderizado ---
  if (isLoadingAuth) {
     return <div className="text-center p-4">Verificando usuario...</div>;
  }
  if (error) {
    return <div className="text-center p-4 text-red-500">{error}</div>;
  }
  // Mostrar loader si estamos cargando (Cualquiera de las dependencias o los vehículos)
  if (isLoading || isLoadingDeps) {
    console.log("Cargando datos de la flota...")
     return <div className="text-center p-4">Cargando datos de la flota...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Cabecera con título y botón de crear */}
      <div className="flex justify-between items-center border-b pb-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Gestión de Vehículos
        </h1>
        <button
          onClick={handleCrearVehiculo}
          disabled={!adminEmpresaId || lineas.length === 0} // Deshabilitar si no hay empresa O no hay líneas
          title={!adminEmpresaId ? "Error: No se pudo identificar la empresa" : (lineas.length === 0 ? "Primero debe crear al menos una línea" : "Crear Nuevo Vehículo")}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <Plus size={18} className="mr-2"/>
          Crear Vehículo
        </button>
      </div>

      {/* Filtro por Línea */}
      <div className="max-w-xs">
           <label htmlFor="filtro_linea" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
               Filtrar por Línea
           </label>
           <select
               id="filtro_linea"
               value={filtroLineaId}
               onChange={(e) => setFiltroLineaId(e.target.value)}
               disabled={lineas.length === 0} // Deshabilitar si no hay líneas
               className="mt-1 block w-full input-form dark:bg-gray-700 dark:border-gray-600 dark:text-white"
           >
               <option value="">Todas las Líneas</option>
               {lineas.map(linea => (
                   <option key={linea.id} value={linea.id}>{linea.nombre}</option>
               ))}
           </select>
      </div>

      {/* Tabla de Vehículos */}
      {vehiculos.length === 0 ? (
          <div className="text-center p-4 bg-white dark:bg-gray-800 rounded shadow">
            {filtroLineaId ? 'No hay vehículos para esta línea.' : (lineas.length === 0 ? 'Por favor, crea una línea antes de añadir vehículos.' : 'No hay vehículos registrados para esta empresa.')}
          </div>
      ) : (
        <div className="overflow-x-auto shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Placa</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Línea Asignada</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Conductor Asignado</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Estado</th>
                <th scope="col" className="relative px-6 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
              {vehiculos.map((vehiculo) => (
                <tr key={vehiculo.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white font-mono">{vehiculo.placa}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{getLineaNombre(vehiculo.lineaId)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{getConductorNombre(vehiculo.conductorId)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{vehiculo.estado.replace(/_/g, ' ')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => handleEditarVehiculo(vehiculo)} title="Editar Vehículo" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
                        <Edit size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Renderizar el Modal si está visible */}
      {showModal && (
        <VehiculoModal
          vehiculoToEdit={vehiculoParaEditar}
          adminEmpresaId={adminEmpresaId!}
          lineasDisponibles={lineas}
          conductoresDisponibles={conductores}
          vehiculosActuales={vehiculos}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

