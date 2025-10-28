'use client';

import React, { useState, useEffect } from 'react';
// Imports completos de Firestore
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/app/context/AuthContext'; // Ajusta la ruta si es necesario
import { ShieldCheck, ShieldOff, Loader2, UserPlus } from 'lucide-react'; // Iconos

// --- Interfaz ConductorData ---
interface ConductorData {
  id: string; // ID del documento Firestore
  nombre: string;
  // authUid puede ser null si aún no se ha vinculado
  authUid: string | null;
  esAdminRutas: boolean;
  email?: string; // Guardar email como referencia
  isProcessing?: boolean;
}

// --- NUEVO: Modal Mejorado (Aún sin creación de Auth real) ---
const AgregarConductorModal: React.FC<{
    onClose: () => void;
    adminEmpresaId: string | null // Necesitamos el ID de la empresa
}> = ({ onClose, adminEmpresaId }) => {
    const [nombre, setNombre] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState(''); // Pedir contraseña para simular
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAddConductor = async () => {
        if (!adminEmpresaId) {
            setError('No se pudo determinar la empresa del administrador.');
            return;
        }
        setError(null);
        setIsSaving(true);

        try {
            // PASO 1: Crear SOLO el documento en Firestore
            const conductorData = {
                nombre: nombre.trim(),
                email: email.trim().toLowerCase(), // Guardar email
                empresaId: adminEmpresaId,
                authUid: null, // Dejar null inicialmente
                esAdminRutas: false,
                fechaRegistro: serverTimestamp() // Opcional: guardar fecha
            };
            const docRef = await addDoc(collection(db, 'Conductores'), conductorData);
            console.log("Conductor pre-registrado en Firestore con ID:", docRef.id);

            // PASO 2: Mostrar mensaje al usuario sobre el paso manual
            alert(`¡Conductor pre-registrado en Firestore!\n\nPASOS MANUALES IMPORTANTES:\n\n1. Ve a Firebase Authentication > Users.\n2. Haz clic en "Add user".\n3. Usa el Email: ${email}\n4. Asigna una contraseña segura (ej: ${password || 'GENERAR_UNA'}).\n5. Copia el UID del nuevo usuario.\n6. Vuelve a Firestore > Conductores, busca este conductor (por nombre o email) y pega el UID en el campo 'authUid'.`);
            setIsSaving(false);
            onClose(); // Cerrar modal

        } catch (err) {
            console.error("Error pre-registrando conductor:", err);
            if (err instanceof Error) {
                 // Podríamos verificar si el error es por email duplicado en Firestore si tuviéramos reglas
                 setError(`Error al guardar en Firestore: ${err.message}`);
            } else {
                 setError('Ocurrió un error desconocido al guardar.');
            }
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Agregar Nuevo Conductor
              </h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" disabled={isSaving}>
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
               <p className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900 p-3 rounded border border-yellow-200 dark:border-yellow-700">
                 **Importante:** Esto pre-registra al conductor. Aún necesitas crear su cuenta de login manualmente en Firebase Authentication.
               </p>
               <div>
                 <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre Completo</label>
                 <input type="text" id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={isSaving} className="mt-1 block w-full input-form dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
               </div>
               <div>
                 <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Correo Electrónico (para login)</label>
                 <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isSaving} className="mt-1 block w-full input-form dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
               </div>
                <div>
                 <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contraseña Sugerida</label>
                 <input type="text" id="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isSaving} className="mt-1 block w-full input-form dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="(Opcional, para recordar)" />
                 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ingresa una contraseña aquí para copiarla fácilmente al crear la cuenta en Firebase Auth.</p>
               </div>
                {error && (
                    <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
                )}
            </div>
            <div className="flex justify-end p-4 border-t dark:border-gray-700">
              <button onClick={onClose} type="button" className="mr-2 button-secondary dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-300" disabled={isSaving}>
                Cancelar
              </button>
              <button
                onClick={handleAddConductor}
                type="button"
                className="button-primary disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                disabled={!nombre || !email || isSaving} // Deshabilitar si falta nombre/email o está guardando
              >
                {isSaving ? <Loader2 size={18} className="animate-spin mr-2"/> : null}
                {isSaving ? 'Guardando...' : 'Pre-registrar Conductor'}
              </button>
            </div>
          </div>
        </div>
    );
};
// --- Fin Modal Mejorado ---


export default function ListaConductores() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [conductores, setConductores] = useState<ConductorData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminEmpresaId, setAdminEmpresaId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false); // Mantener estado del modal

  // --- Efecto 1: Obtener empresaId (sin cambios) ---
   useEffect(() => {
     if (!isLoadingAuth) {
        if (user) {
          async function fetchEmpresaId() {
            if (!user) { setError('Usuario no autenticado al buscar empresa.'); setIsLoading(false); return; }
            if (!isLoading) setIsLoading(true); // Podría ya estar cargando
            try {
               const q = query(collection(db, 'Empresas'), where('adminAuthUid', '==', user.uid), limit(1));
               const querySnapshot = await getDocs(q);
               if (!querySnapshot.empty) {
                  setAdminEmpresaId(querySnapshot.docs[0].id); setError(null);
               } else {
                   setError('No se encontró empresa asignada a tu cuenta.'); setIsLoading(false);
               }
            } catch(e) {
               console.error("Error buscando empresa del admin:", e); setError('Error al obtener datos de la empresa.'); setIsLoading(false);
            }
          }
          fetchEmpresaId();
        } else {
           setError('Usuario no autenticado.'); setIsLoading(false);
        }
     }
   }, [user, isLoadingAuth, isLoading]);


  // --- Efecto 2: Listener Conductores (sin cambios) ---
  useEffect(() => {
    if (!adminEmpresaId || isLoadingAuth) {
       if (!isLoadingAuth && !adminEmpresaId) setIsLoading(false); // Solo detener si auth terminó y no hay ID
       return;
    }
    // Asegurarse de poner isLoading a true solo si no lo está ya
    if (!isLoading) setIsLoading(true);
    setError(null);
    const qConductores = query(collection(db, 'Conductores'), where('empresaId', '==', adminEmpresaId));
    const unsubscribe = onSnapshot(qConductores, (querySnapshot) => {
      const conductoresData: ConductorData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        conductoresData.push({
             id: doc.id,
             nombre: data.nombre ?? 'Sin Nombre',
             // authUid puede ser null
             authUid: data.authUid ?? null,
             esAdminRutas: data.esAdminRutas ?? false,
             email: data.email, // Leer email si existe
             isProcessing: false });
      });
      conductoresData.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setConductores(conductoresData); setIsLoading(false);
    }, (err) => {
      console.error("Error escuchando conductores:", err); setError("Error al cargar la lista de conductores."); setIsLoading(false);
    });
    return () => unsubscribe();
  }, [adminEmpresaId, isLoadingAuth, isLoading]); // isLoading añadido a deps

  // --- Función cambiar permiso (sin cambios) ---
  const handleToggleAdminRutas = async (conductorId: string, currentState: boolean) => { /* ... Misma lógica que antes ... */
     setConductores(prev => prev.map(c => c.id === conductorId ? { ...c, isProcessing: true } : c));
     try {
       const conductorRef = doc(db, 'Conductores', conductorId);
       await updateDoc(conductorRef, { esAdminRutas: !currentState });
       console.log(`Permiso de admin de rutas cambiado para ${conductorId}`);
     } catch (e) {
        console.error("Error al cambiar permiso:", e); alert(`Error al actualizar el permiso: ${e}`);
        setConductores(prev => prev.map(c => c.id === conductorId ? { ...c, isProcessing: false } : c));
     } finally {
         setTimeout(() => {
              setConductores(prev => prev.map(c => c.id === conductorId ? { ...c, isProcessing: false } : c));
         }, 500);
     }
  };


  // --- Renderizado ---
  if (isLoading) {
    return <div className="text-center p-4">Cargando conductores...</div>;
  }
  if (error) {
    return <div className="text-center p-4 text-red-500">{error}</div>;
  }
  // No mostrar "No hay conductores" si el error es de no encontrar empresa
  // Ya que el mensaje de error se muestra arriba.
  // if (conductores.length === 0 && error?.includes('empresa asignada')) {
  //     return <div className="text-center p-4 text-red-500">{error}</div>;
  // }


  return (
    <div>
      {/* Botón para Agregar Conductor */}
      <div className="mb-4 text-right">
        <button
          onClick={() => setShowAddModal(true)}
          disabled={!adminEmpresaId} // Deshabilitar si no se encontró la empresa
          title={!adminEmpresaId ? "Error: No se pudo identificar la empresa" : "Agregar Nuevo Conductor"}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          <UserPlus size={18} className="mr-2"/>
          Agregar Conductor
        </button>
      </div>

      {/* Tabla de Conductores */}
      {conductores.length === 0 ? (
          <div className="text-center p-4 bg-white dark:bg-gray-800 rounded shadow">No hay conductores registrados para esta empresa.</div>
      ) : (
        <div className="overflow-x-auto shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
             <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Nombre</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Admin Rutas</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Email / Auth UID</th>
                <th scope="col" className="relative px-6 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
              {conductores.map((conductor) => (
                <tr key={conductor.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${!conductor.authUid ? 'bg-yellow-50 dark:bg-yellow-900/50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{conductor.nombre}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {conductor.esAdminRutas ? <span className="flex items-center text-green-600 dark:text-green-400"><ShieldCheck size={16} className="mr-1" /> Sí</span> : <span className="flex items-center text-gray-500 dark:text-gray-400"><ShieldOff size={16} className="mr-1" /> No</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {conductor.email && <div className="text-xs">{conductor.email}</div>}
                    {conductor.authUid ? (
                      <div className="font-mono text-xs opacity-70" title={conductor.authUid}>{conductor.authUid.substring(0, 10)}...</div>
                    ) : (
                      <span className="text-xs text-red-500 dark:text-red-400">(No vinculado a Auth)</span>
                    )}
                  </td>
                   <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                     {conductor.isProcessing ? (
                         <Loader2 size={18} className="animate-spin text-gray-500" />
                     ) : (
                        <>
                            {/* Opcional: Botón para editar/vincular UID */}
                            {/* {!conductor.authUid && <button className="text-blue-500 mr-2">Vincular</button>} */}
                            <button
                                onClick={() => handleToggleAdminRutas(conductor.id, conductor.esAdminRutas)}
                                disabled={!conductor.authUid} // Deshabilitar si no está vinculado
                                title={!conductor.authUid ? "Primero vincula el Auth UID" : (conductor.esAdminRutas ? 'Quitar Permiso Admin' : 'Dar Permiso Admin')}
                                className={`px-3 py-1 rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    conductor.esAdminRutas
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200 focus:ring-red-500 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800'
                                    : 'bg-green-100 text-green-700 hover:bg-green-200 focus:ring-green-500 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800'
                                }`}
                            >
                                {conductor.esAdminRutas ? 'Quitar Permiso' : 'Dar Permiso Admin'}
                            </button>
                        </>
                     )}
                   </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

       {/* Renderizar el Modal si showAddModal es true */}
       {showAddModal && <AgregarConductorModal adminEmpresaId={adminEmpresaId} onClose={() => setShowAddModal(false)} />}

    </div>
  );
}

