'use client';

import React, { useState, useEffect } from 'react';
import { doc, addDoc, updateDoc, collection, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Save } from 'lucide-react';
import { LineaData } from './GestionLineas'; // Importar la interfaz

// Interfaz para el formulario modal
interface LineaModalProps {
  lineaToEdit: LineaData | null; // null = modo creación
  adminEmpresaId: string; // ID de la empresa a la que pertenece
  onClose: () => void;
}

// Interfaz para la lista de POIs
interface PoiOption {
  id: string;
  nombre: string;
}

export default function LineaModal({ lineaToEdit, adminEmpresaId, onClose }: LineaModalProps) {
  // Estado del formulario
  const [nombre, setNombre] = useState(lineaToEdit?.nombre ?? '');
  const [color, setColor] = useState(lineaToEdit?.color ?? '#FF0000');
  const [terminal1Id, setTerminal1Id] = useState<string>(lineaToEdit?.terminal1Id ?? '');
  const [terminal2Id, setTerminal2Id] = useState<string>(lineaToEdit?.terminal2Id ?? '');
  
  // Estado para cargar los POIs
  const [poiList, setPoiList] = useState<PoiOption[]>([]);
  const [isLoadingPois, setIsLoadingPois] = useState(true);

  // Estado de UI
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Cargar POIs para los dropdowns ---
  useEffect(() => {
    const fetchPois = async () => {
      setIsLoadingPois(true);
      try {
        const poiSnapshot = await getDocs(collection(db, 'Ubicaciones_POI'));
        const pois: PoiOption[] = [];
        poiSnapshot.forEach(doc => {
          pois.push({ id: doc.id, nombre: doc.data().nombre ?? '(POI sin nombre)' });
        });
        setPoiList(pois.sort((a, b) => a.nombre.localeCompare(b.nombre))); // Ordenar
      } catch (err) {
        console.error("Error cargando POIs para el modal:", err);
        setError("No se pudieron cargar las ubicaciones.");
      } finally {
        setIsLoadingPois(false);
      }
    };
    fetchPois();
  }, []); // Cargar solo una vez al montar el modal

  
  const handleSave = async () => {
    if (!nombre.trim()) {
      setError("El campo 'Nombre' es obligatorio.");
      return;
    }
    
    setIsSaving(true);
    setError(null);

    // Preparar datos para Firestore
    const dataToSave = {
      nombre: nombre.trim(),
      color: color,
      empresaId: adminEmpresaId, // Siempre asignar la empresa del admin
      // Guardar null si la opción "Ninguna" está seleccionada
      terminal1Id: terminal1Id || null, 
      terminal2Id: terminal2Id || null,
      // Los campos de ruta (rutaIda, rutaVuelta) no se tocan aquí
      // Si es creación, se añadirán con '[]'
    };

    try {
      if (lineaToEdit) {
        // --- Modo Edición (Actualizar) ---
        const lineaRef = doc(db, 'Lineas', lineaToEdit.id);
        await updateDoc(lineaRef, dataToSave);
        console.log("Línea actualizada:", lineaToEdit.id);
      } else {
        // --- Modo Creación (Añadir) ---
        await addDoc(collection(db, 'Lineas'), {
            ...dataToSave,
            fechaCreacion: serverTimestamp(), // Opcional
            rutaIda: [], // Inicializar rutas vacías
            rutaVuelta: [],
        });
        console.log("Nueva línea creada");
      }
      onClose(); // Cerrar modal al guardar
    } catch (err) {
      console.error("Error guardando línea:", err);
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
            {lineaToEdit ? 'Editar Línea' : 'Crear Nueva Línea'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" disabled={isSaving}>
            &times;
          </button>
        </div>

        {/* Cuerpo (Formulario) */}
        <div className="p-6 space-y-4 overflow-y-auto">
            {/* Nombre */}
            <div>
                <label htmlFor="nombre_linea" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre de la Línea</label>
                <input type="text" id="nombre_linea" value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 block w-full input-form dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
            </div>
            
            {/* Color */}
             <div>
                <label htmlFor="color_linea" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Color de la Ruta</label>
                 <div className="flex items-center gap-2 mt-1">
                    <input type="color" id="color_linea" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-16 p-1 border-gray-300 rounded-md" />
                    <input type="text" value={color} onChange={(e) => setColor(e.target.value)} className="block w-full input-form dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="#FF0000" />
                 </div>
            </div>

            {/* Selector Terminal 1 */}
            <div>
                <label htmlFor="terminal1" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Terminal 1 (Inicio IDA)</label>
                <select
                    id="terminal1"
                    value={terminal1Id}
                    onChange={(e) => setTerminal1Id(e.target.value)}
                    disabled={isLoadingPois}
                    className="mt-1 block w-full input-form dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                    <option value="">(Opcional) Selecciona terminal...</option>
                    {poiList.map(poi => (
                        <option key={poi.id} value={poi.id}>{poi.nombre}</option>
                    ))}
                </select>
            </div>
            
            {/* Selector Terminal 2 */}
            <div>
                <label htmlFor="terminal2" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Terminal 2 (Fin IDA)</label>
                <select
                    id="terminal2"
                    value={terminal2Id}
                    onChange={(e) => setTerminal2Id(e.target.value)}
                    disabled={isLoadingPois}
                    className="mt-1 block w-full input-form dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                    <option value="">(Opcional) Selecciona terminal...</option>
                    {poiList.map(poi => (
                        <option key={poi.id} value={poi.id}>{poi.nombre}</option>
                    ))}
                </select>
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
            disabled={isSaving || !nombre.trim()}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin mr-2"/> : <Save size={16} className="mr-1" />}
            {isSaving ? 'Guardando...' : (lineaToEdit ? 'Guardar Cambios' : 'Crear Línea')}
          </button>
        </div>
        
      </div>
    </div>
  );
}
