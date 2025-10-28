'use client';

import React, { useState, useMemo } from 'react';
import { doc, addDoc, updateDoc, collection, serverTimestamp, GeoPoint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Save } from 'lucide-react';
import { VehiculoData, LineaDataSimple, ConductorDataSimple } from './GestionVehiculos'; // Importar interfaces

interface VehiculoModalProps {
  vehiculoToEdit: VehiculoData | null; // null = modo creación
  adminEmpresaId: string;
  lineasDisponibles: LineaDataSimple[];
  conductoresDisponibles: ConductorDataSimple[];
  vehiculosActuales: VehiculoData[]; // Para verificar asignación 1-a-1
  onClose: () => void;
}

export default function VehiculoModal({
  vehiculoToEdit,
  lineasDisponibles,
  conductoresDisponibles,
  vehiculosActuales,
  onClose
}: VehiculoModalProps) {
  
  // --- Estado del Formulario ---
  const [placa, setPlaca] = useState(vehiculoToEdit?.placa ?? '');
  const [lineaId, setLineaId] = useState(vehiculoToEdit?.lineaId ?? '');
  const [conductorId, setConductorId] = useState(vehiculoToEdit?.conductorId ?? '');
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Lógica de Conductores Disponibles (Regla 1-a-1) ---
  const conductoresParaDropdown = useMemo(() => {
    console.log("Calculando conductores disponibles...");
    // 1. Encontrar todos los IDs de conductores ya asignados
    const idsConductoresAsignados = new Set(
        vehiculosActuales
            .map(v => v.conductorId)
            .filter((id): id is string => !!id) // Filtrar nulos o undefined
    );
    console.log("Conductores ya asignados:", idsConductoresAsignados);

    // 2. Filtrar la lista de conductores
    const conductoresFiltrados = conductoresDisponibles.filter(conductor => {
      // Si el conductor NO está en la lista de asignados, incluirlo
      if (!idsConductoresAsignados.has(conductor.id)) {
        return true;
      }
      // Si SÍ está asignado, incluirlo SOLO SI está asignado a ESTE vehículo (modo edición)
      if (vehiculoToEdit && conductor.id === vehiculoToEdit.conductorId) {
        return true;
      }
      // Si está asignado a OTRO vehículo, excluirlo
      return false;
    });
    
    console.log("Conductores para dropdown:", conductoresFiltrados.map(c => c.nombre));
    return conductoresFiltrados;

  }, [conductoresDisponibles, vehiculosActuales, vehiculoToEdit]);


  // --- Lógica de Guardado (CORREGIDA) ---
  const handleSave = async () => {
    if (!placa.trim() || !lineaId) {
      setError("La Placa y la Línea son obligatorias.");
      return;
    }
    
    setIsSaving(true);
    setError(null);

    // --- CORRECCIÓN: Datos a guardar según tu schema ---
    // Quitar 'empresaId' de aquí
    const dataToSave: {
        placa: string;
        lineaId: string;
        conductorId: string | null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any; // Para permitir campos opcionales en creación
    } = {
      placa: placa.trim().toUpperCase(),
      lineaId: lineaId,
      conductorId: conductorId || null, // Guardar null si es ''
    };
    // --- FIN CORRECCIÓN ---


    try {
      if (vehiculoToEdit) {
        // --- Modo Edición (Actualizar) ---
        const vehRef = doc(db, 'Vehiculos', vehiculoToEdit.id);
        // Solo actualizamos estos campos, no sobreescribimos estado o ubicación
        await updateDoc(vehRef, dataToSave);
        console.log("Vehículo actualizado:", vehiculoToEdit.id);
      } else {
        // --- Modo Creación (Añadir) ---
        // Añadir los campos por defecto solo al crear
        dataToSave.estado = 'fuera_de_servicio';
        dataToSave.ubicacionActual = new GeoPoint(-15.4985, -70.1338); // Juliaca
        dataToSave.lastUpdateTimestamp = serverTimestamp();
        // Añadir empresaId aquí si es ABSOLUTAMENTE necesario para otra query
        // pero basado en tu schema, lo omitimos.
        // dataToSave.empresaId = adminEmpresaId; 
        
        await addDoc(collection(db, 'Vehiculos'), dataToSave);
        console.log("Nuevo vehículo creado");
      }
      onClose(); // Cerrar modal al guardar
    } catch (err) {
      console.error("Error guardando vehículo:", err);
      setError("Error al guardar en Firestore.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // Estilo base del modal (fondo oscuro, centrado)
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {vehiculoToEdit ? 'Editar Vehículo' : 'Crear Nuevo Vehículo'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" disabled={isSaving}>
            &times;
          </button>
        </div>

        {/* Cuerpo (Formulario) */}
        <div className="p-6 space-y-4 overflow-y-auto">
            {/* Placa */}
            <div>
                <label htmlFor="placa" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Placa del Vehículo</label>
                <input type="text" id="placa" value={placa} onChange={(e) => setPlaca(e.target.value)} className="mt-1 block w-full input-form dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
            </div>
            
            {/* Selector Línea */}
            <div>
                <label htmlFor="linea" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Línea Asignada</label>
                <select
                    id="linea"
                    value={lineaId}
                    onChange={(e) => setLineaId(e.target.value)}
                    disabled={lineasDisponibles.length === 0}
                    className="mt-1 block w-full input-form dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                    <option value="">Selecciona una línea...</option>
                    {lineasDisponibles.map(linea => (
                        <option key={linea.id} value={linea.id}>{linea.nombre}</option>
                    ))}
                </select>
            </div>
            
            {/* Selector Conductor */}
            <div>
                <label htmlFor="conductor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Conductor Asignado (Opcional)</label>
                <select
                    id="conductor"
                    value={conductorId}
                    onChange={(e) => setConductorId(e.target.value)}
                    // No deshabilitar, siempre debe mostrar "Sin Asignar"
                    // disabled={conductoresParaDropdown.length === 0}
                    className="mt-1 block w-full input-form dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                    <option value="">(Sin Asignar / Simulación)</option>
                    {conductoresParaDropdown.map(conductor => (
                        <option key={conductor.id} value={conductor.id}>{conductor.nombre}</option>
                    ))}
                </select>
                 <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                   Solo se muestran conductores que no estén ya asignados a otro vehículo.
                 </p>
            </div>
            
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {/* Pie */}
        <div className="flex justify-end p-4 border-t dark:border-gray-700 shrink-0 space-x-2">
          <button
            onClick={onClose} type="button"
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave} type="button"
            disabled={isSaving || !placa.trim() || !lineaId}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin mr-2"/> : <Save size={16} className="mr-1" />}
            {isSaving ? 'Guardando...' : (vehiculoToEdit ? 'Guardar Cambios' : 'Crear Vehículo')}
          </button>
        </div>
        
      </div>
    </div>
  );
}

