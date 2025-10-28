import 'dart:async'; // Para el Timer
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart'; // Para el GPS
import 'package:firebase_auth/firebase_auth.dart';
// Importamos las otras pantallas
// import 'package:transporte_app/screens/placeholder_screen.dart'; // Ya no lo usamos
import 'package:transporte_app/screens/reportar_incidente_screen.dart';
import 'package:transporte_app/screens/grabar_ruta_screen.dart';

class PantallaPrincipalConductor extends StatefulWidget {
  final String userId; // ID de Firebase Auth (authUid)
  const PantallaPrincipalConductor({super.key, required this.userId});

  @override
  State<PantallaPrincipalConductor> createState() =>
      _PantallaPrincipalConductorState();
}

class _PantallaPrincipalConductorState
    extends State<PantallaPrincipalConductor> {

  // --- Estado de la App ---
  bool _isLoading = true;
  String? _conductorIdFirestore;
  String? _vehiculoIdFirestore;
  DocumentReference? _vehiculoRef;

  // Datos para mostrar en UI
  String _nombreConductor = 'Cargando...';
  String _placaVehiculo = 'Cargando...';
  String _lineaNombre = 'Cargando...';
  String _nombreTerminal1 = '';
  String _nombreTerminal2 = '';
  bool _esAdmin = false; // <-- NUEVO: Para guardar el permiso

  // Estado del servicio GPS
  bool _isTracking = false;
  String _currentEstadoVehiculo = '';
  String _feedbackMessage = 'Servicio detenido.';
  double _intervaloSegundos = 5.0;
  Timer? _gpsTimer;

  @override
  void initState() {
    super.initState();
    _buscarDatosIniciales();
  }

  @override
  void dispose() {
    _gpsTimer?.cancel();
    super.dispose();
  }

  Future<String> _getNombrePOI(String? poiId, String nombrePorDefecto) async {
    if (poiId == null || poiId.isEmpty) {
      return nombrePorDefecto;
    }
    try {
      final poiDoc = await FirebaseFirestore.instance
          .collection('Ubicaciones_POI')
          .doc(poiId)
          .get();
      if (poiDoc.exists) {
        return poiDoc.data()?['nombre'] ?? nombrePorDefecto;
      }
      return 'Terminal (ID no F)'; // ID no encontrado
    } catch (e) {
      print("Error buscando nombre POI ($poiId): $e");
      return 'Error Terminal';
    }
  }

  // --- Lógica de Búsqueda Inicial ---
  Future<void> _buscarDatosIniciales() async {
    setState(() { _isLoading = true; });
    try {
      // 1. Buscar al conductor usando el authUid
      final conductorQuery = await FirebaseFirestore.instance
          .collection('Conductores')
          .where('authUid', isEqualTo: widget.userId)
          .limit(1)
          .get();

      if (conductorQuery.docs.isEmpty) {
        throw Exception("Conductor no encontrado en Firestore para este usuario.");
      }
      final conductorDoc = conductorQuery.docs.first;
      _conductorIdFirestore = conductorDoc.id;
      _nombreConductor = conductorDoc.data()['nombre'] ?? 'Nombre no encontrado';
      _esAdmin = conductorDoc.data()['esAdminRutas'] ?? false; // <-- LEER PERMISO

      // 2. Buscar el vehículo asignado a este conductor
      // (Resto de la función sin cambios...)
      final vehiculoQuery = await FirebaseFirestore.instance
          .collection('Vehiculos')
          .where('conductorId', isEqualTo: _conductorIdFirestore)
          .limit(1)
          .get();

      if (vehiculoQuery.docs.isEmpty) {
        throw Exception("No se encontró vehículo asignado a este conductor.");
      }
      final vehiculoDoc = vehiculoQuery.docs.first;
      _vehiculoIdFirestore = vehiculoDoc.id;
      _vehiculoRef = vehiculoDoc.reference;
      _placaVehiculo = vehiculoDoc.data()['placa'] ?? 'Placa no encontrada';
      _currentEstadoVehiculo = vehiculoDoc.data()['estado'] ?? 'fuera_de_servicio';


      final lineaId = vehiculoDoc.data()['lineaId'];
      if (lineaId != null) {
        final lineaDoc = await FirebaseFirestore.instance.collection('Lineas').doc(lineaId).get();
        if (lineaDoc.exists) {
           _lineaNombre = lineaDoc.data()?['nombre'] ?? '';
           // Leer los IDs de las terminales (en lugar de los nombres)
           final terminal1Id = lineaDoc.data()?['terminal1Id'] as String?;
           final terminal2Id = lineaDoc.data()?['terminal2Id'] as String?;

           // Buscar los nombres de forma asíncrona en paralelo
           final nombres = await Future.wait([
               _getNombrePOI(terminal1Id, 'Terminal 1'), // Usar helper
               _getNombrePOI(terminal2Id, 'Terminal 2')  // Usar helper
           ]);
           
           _nombreTerminal1 = nombres[0];
           _nombreTerminal2 = nombres[1];
        }
      }

      _actualizarFeedbackInicial();

      setState(() { _isLoading = false; });

    } catch (e) {
      print("Error buscando datos iniciales: $e");
      setState(() {
        _isLoading = false;
        _nombreConductor = 'Error';
        _placaVehiculo = 'Error';
        _feedbackMessage = 'Error al cargar datos: $e';
        _esAdmin = false; // Asegurarse que no tenga permisos si hay error
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error crítico al cargar datos: $e')),
        );
      }
    }
  }

  // _actualizarFeedbackInicial sin cambios...
  void _actualizarFeedbackInicial() {
    switch (_currentEstadoVehiculo) {
      case 'en_ruta_ida':
      case 'en_ruta_vuelta':
        _feedbackMessage = 'Servicio ya estaba activo. Retomando...';
        _isTracking = true;
         _iniciarTimerGPS();
        break;
      case 'en_terminal_1':
        _feedbackMessage = 'Vehículo en $_nombreTerminal1. Listo para iniciar IDA.';
        _isTracking = false;
        break;
      case 'en_terminal_2':
        _feedbackMessage = 'Vehículo en $_nombreTerminal2. Listo para iniciar VUELTA.';
        _isTracking = false;
        break;
      default:
        _feedbackMessage = 'Servicio detenido.';
        _isTracking = false;
    }
  }


  // --- Lógica del GPS (Sin cambios) ---
  Future<bool> _handlePermissions() async {
    LocationPermission permiso = await Geolocator.checkPermission();
    if (permiso == LocationPermission.denied) {
      permiso = await Geolocator.requestPermission();
      if (permiso != LocationPermission.whileInUse &&
          permiso != LocationPermission.always) {
        setState(() {
          _feedbackMessage = 'Permiso de GPS denegado para iniciar.';
        });
        return false;
      }
    }
    bool servicioHabilitado = await Geolocator.isLocationServiceEnabled();
    if (!servicioHabilitado) {
       setState(() {
         _feedbackMessage = 'Por favor, enciende el GPS del teléfono.';
       });
      return false;
    }
    return true;
  }

  Future<void> _iniciarRuta(String direccion) async {
    if (_vehiculoRef == null) {
       setState(() { _feedbackMessage = 'Error: Referencia de vehículo no encontrada.'; });
       return;
    }
    bool permisosListos = await _handlePermissions();
    if (!permisosListos) return;
    final nuevoEstado = (direccion == 'ida') ? 'en_ruta_ida' : 'en_ruta_vuelta';
    try {
      await _vehiculoRef!.update({'estado': nuevoEstado});
      _currentEstadoVehiculo = nuevoEstado;
    } catch (e) {
      setState(() { _feedbackMessage = 'Error al actualizar estado en DB.'; });
      return;
    }
    _iniciarTimerGPS();
    setState(() {
      _isTracking = true;
      final destino = (direccion == 'ida') ? _nombreTerminal2 : _nombreTerminal1;
      _feedbackMessage = 'Ruta ${direccion.toUpperCase()} iniciada hacia $destino. Enviando cada ${_intervaloSegundos.toInt()} seg.';
    });
  }

  void _iniciarTimerGPS() {
     _gpsTimer?.cancel();
     _gpsTimer = Timer.periodic(Duration(seconds: _intervaloSegundos.toInt()), (timer) {
       _obtenerYEnviarPosicionActual();
     });
     _obtenerYEnviarPosicionActual();
  }

  Future<void> _obtenerYEnviarPosicionActual() async {
    if (_vehiculoRef == null || !_isTracking) return;
     try {
       Position position = await Geolocator.getCurrentPosition(
         desiredAccuracy: LocationAccuracy.high,
         timeLimit: Duration(seconds: _intervaloSegundos.toInt() - 1)
       );
       final geoPoint = GeoPoint(position.latitude, position.longitude);
       await _vehiculoRef!.update({'ubicacionActual': geoPoint});
       if (mounted) {
         setState(() {
           _feedbackMessage =
               '¡Enviado! (${position.latitude.toStringAsFixed(4)}, ${position.longitude.toStringAsFixed(4)})';
         });
       }
     } catch (e) {
       if (mounted) {
         setState(() {
           _feedbackMessage = 'Error al obtener/enviar GPS: $e';
         });
       }
     }
  }

  void _terminarRuta() async {
    if (_vehiculoRef == null) return;
    _gpsTimer?.cancel();
    _gpsTimer = null;
    final nuevoEstado;
    String mensajeFeedback;
    if (_currentEstadoVehiculo == 'en_ruta_ida') {
      nuevoEstado = 'en_terminal_2';
      mensajeFeedback = 'Ruta IDA finalizada. En $_nombreTerminal2.';
    } else if (_currentEstadoVehiculo == 'en_ruta_vuelta') {
      nuevoEstado = 'en_terminal_1';
       mensajeFeedback = 'Ruta VUELTA finalizada. En $_nombreTerminal1.';
    } else {
      nuevoEstado = 'fuera_de_servicio';
      mensajeFeedback = 'Servicio detenido.';
    }
    try {
      await _vehiculoRef!.update({'estado': nuevoEstado});
       _currentEstadoVehiculo = nuevoEstado;
    } catch (e) {
      print("Error al actualizar a terminal: $e");
      mensajeFeedback = 'Error al finalizar ruta en DB.';
    }
    if (mounted) {
      setState(() {
        _isTracking = false;
        _feedbackMessage = mensajeFeedback;
      });
    }
  }

  // --- Navegación a Otras Pantallas (Sin cambios internos, pero _irAModoAdmin se ocultará)---
  void _irAReportes() {
    if (_vehiculoIdFirestore != null) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => PantallaReportarIncidente(vehiculoId: _vehiculoIdFirestore!),
        ),
      );
    } else {
       ScaffoldMessenger.of(context).showSnackBar(
         const SnackBar(content: Text('ID del vehículo aún no cargado.')),
       );
    }
  }

  void _irAModoAdmin() {
     // Ya no necesitamos Placeholder aquí si lo ocultamos, pero lo dejamos por si acaso
    Navigator.push(
        context,
        MaterialPageRoute(
            builder: (context) => const PantallaGrabarRuta()));
  }

  // --- UI ---
  @override
  Widget build(BuildContext context) {
    // Botones de acción (Sin cambios)...
     List<Widget> botonesAccion = [];
    if (_isLoading) {
      botonesAccion.add(const Center(child: CircularProgressIndicator()));
    } else if (_isTracking) {
      botonesAccion.add(
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.red, foregroundColor: Colors.white,
            minimumSize: const Size(double.infinity, 50),
          ),
          onPressed: _terminarRuta,
          child: const Text('TERMINAR RUTA ACTUAL', style: TextStyle(fontSize: 16)),
        )
      );
    } else {
       if (_currentEstadoVehiculo == 'en_terminal_1' || _currentEstadoVehiculo == 'fuera_de_servicio') {
         botonesAccion.add(
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green, foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 50),
              ),
              onPressed: () => _iniciarRuta('ida'),
              child: Text('INICIAR IDA (hacia $_nombreTerminal2)', style: const TextStyle(fontSize: 16)),
            )
         );
       }
       if ((_currentEstadoVehiculo == 'en_terminal_1' || _currentEstadoVehiculo == 'fuera_de_servicio') &&
           (_currentEstadoVehiculo == 'en_terminal_2' || _currentEstadoVehiculo == 'fuera_de_servicio')) {
          botonesAccion.add(const SizedBox(height: 10));
       }
       if (_currentEstadoVehiculo == 'en_terminal_2' || _currentEstadoVehiculo == 'fuera_de_servicio') {
         botonesAccion.add(
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue, foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 50),
              ),
              onPressed: () => _iniciarRuta('vuelta'),
              child: Text('INICIAR VUELTA (hacia $_nombreTerminal1)', style: const TextStyle(fontSize: 16)),
            )
         );
       }
       if (botonesAccion.isEmpty && !_isLoading) {
          botonesAccion.add(const Text('Estado del vehículo no permite iniciar ruta.', textAlign: TextAlign.center,));
       }
    }

    return Scaffold(
      appBar: AppBar(
        title: Column( // Sin cambios...
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Conductor: $_nombreConductor', style: const TextStyle(fontSize: 16)),
            Text('Vehículo: $_placaVehiculo ($_lineaNombre)', style: const TextStyle(fontSize: 12, color: Colors.white70)),
          ],
        ),
        actions: [ // Sin cambios...
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Cerrar Sesión',
            onPressed: () async {
              if (_isTracking) {
                _terminarRuta();
              }
              await FirebaseAuth.instance.signOut();
            },
          )
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            // Panel de Estado (Sin cambios)...
             Card(
              color: _isLoading
                  ? Colors.grey.shade300
                  : _isTracking ? Colors.green.shade100 : Colors.amber.shade100,
              child: ListTile(
                leading: _isLoading
                    ? const CircularProgressIndicator()
                    : Icon(
                        _isTracking ? Icons.route : Icons.local_parking,
                        color: _isTracking ? Colors.green : Colors.orange,
                        size: 30,
                      ),
                title: const Text('Estado Actual'),
                subtitle: Text(_feedbackMessage, style: const TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
            const SizedBox(height: 20),

            // Botones de Acción (Sin cambios)...
            ...botonesAccion,

            const SizedBox(height: 30),
            const Divider(),

            // --- BOTONES SECUNDARIOS (CON CAMBIO) ---
            ListTile( // Reportar Incidente (Sin cambios)
              leading: const Icon(Icons.report_problem_outlined),
              title: const Text('Reportar Incidente'),
              trailing: const Icon(Icons.arrow_forward_ios),
              onTap: _irAReportes,
            ),
            // *** AQUÍ ESTÁ EL CAMBIO ***
            // Solo muestra el ListTile si _esAdmin es true
            if (_esAdmin)
              ListTile(
                leading: const Icon(Icons.edit_road_outlined, color: Colors.purple), // Color distinto para Admin
                title: const Text('Modo Admin: Grabar Ruta'),
                trailing: const Icon(Icons.arrow_forward_ios),
                onTap: _irAModoAdmin,
              ),

            // Slider de Intervalo (Sin cambios)...
             const Spacer(),
            Text(
                'Intervalo de envío: ${_intervaloSegundos.toInt()} seg'),
            Slider(
              value: _intervaloSegundos,
              min: 3, max: 30, divisions: 9,
              label: _intervaloSegundos.toInt().toString(),
              onChanged: (double value) {
                setState(() { _intervaloSegundos = value; });
                if (_isTracking) {
                   _iniciarTimerGPS();
                   setState(() {
                     _feedbackMessage = 'Intervalo actualizado a ${_intervaloSegundos.toInt()} seg.';
                   });
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}

