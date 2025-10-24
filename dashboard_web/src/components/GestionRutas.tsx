'use client';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useState } from 'react';
import ListaPropuestasRuta from './ListaPropuestasRuta';

export default function GestionRutas() {
  // Podríamos usar pestañas si quisiéramos, por ahora secciones
  // const [activeTab, setActiveTab] = useState('propuestas');

  return (
    <div className="space-y-8">
      {/* Sección 1: Rutas Propuestas Pendientes */}
      <section>
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Propuestas de Ruta Pendientes de Revisión
        </h2>
        <ListaPropuestasRuta />
      </section>

      <hr className="dark:border-gray-700"/>
    </div>
  );
}
