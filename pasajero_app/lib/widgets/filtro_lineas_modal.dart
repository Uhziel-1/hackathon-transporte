import 'package:flutter/material.dart';
import 'package:pasajero_app/screens/pasajero_home_screen.dart'; // Importar LineaInfo si la movemos a modelos

// Usaremos la misma interfaz LineaInfo definida en pasajero_home_screen.dart
// TODO: Considerar mover LineaInfo a un archivo de modelos separado si la app crece.

class FiltroLineasModal extends StatefulWidget {
  // Recibe las líneas actualmente filtradas para pre-marcar checkboxes
  final List<String> lineasFiltradasActuales;
  // Recibe todas las líneas disponibles para no tener que cargarlas aquí de nuevo
  final List<LineaInfo> lineasDisponibles;

  const FiltroLineasModal({
    super.key,
    required this.lineasFiltradasActuales,
    required this.lineasDisponibles,
  });

  @override
  State<FiltroLineasModal> createState() => _FiltroLineasModalState();
}

class _FiltroLineasModalState extends State<FiltroLineasModal> {
  // Usar un Set para manejar eficientemente la selección
  late Set<String> _lineasSeleccionadas;

  @override
  void initState() {
    super.initState();
    // Inicializar el Set con las líneas que ya estaban filtradas
    _lineasSeleccionadas = Set<String>.from(widget.lineasFiltradasActuales);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16.0),
      // Altura máxima para evitar que ocupe toda la pantalla
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.6,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min, // Ocupar solo el espacio necesario
        children: [
          Text(
            'Filtrar Líneas Visibles',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 10),
          // Botones para seleccionar/deseleccionar todo
          Row(
             mainAxisAlignment: MainAxisAlignment.spaceEvenly,
             children: [
                TextButton(
                    onPressed: () {
                       setState(() {
                           // Seleccionar todas las disponibles
                           _lineasSeleccionadas = widget.lineasDisponibles.map((l) => l.id).toSet();
                       });
                    },
                    child: const Text('Seleccionar Todas'),
                ),
                 TextButton(
                    onPressed: () {
                       setState(() {
                           // Limpiar selección
                           _lineasSeleccionadas.clear();
                       });
                    },
                    child: const Text('Deseleccionar Todas'),
                ),
             ],
          ),
          const Divider(),
          // Lista de líneas con checkboxes
          Expanded( // Para que la lista use el espacio restante y sea scrollable
            child: widget.lineasDisponibles.isEmpty
                ? const Center(child: Text('No hay líneas disponibles.'))
                : ListView.builder(
                    itemCount: widget.lineasDisponibles.length,
                    itemBuilder: (context, index) {
                      final linea = widget.lineasDisponibles[index];
                      final bool isSelected = _lineasSeleccionadas.contains(linea.id);
                      return CheckboxListTile(
                        title: Text(linea.nombre),
                        value: isSelected,
                        onChanged: (bool? value) {
                          if (value != null) {
                            setState(() {
                              if (value) {
                                _lineasSeleccionadas.add(linea.id);
                              } else {
                                _lineasSeleccionadas.remove(linea.id);
                              }
                            });
                          }
                        },
                        // Usar el color de la línea como color activo
                        activeColor: linea.color,
                        secondary: Icon(Icons.route, color: linea.color),
                      );
                    },
                  ),
          ),
          const Divider(),
          // Botón para aplicar el filtro y cerrar
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                // Devolver la lista de IDs seleccionados
                Navigator.pop(context, _lineasSeleccionadas);
              },
              child: const Text('Aplicar Filtro'),
            ),
          ),
        ],
      ),
    );
  }
}

