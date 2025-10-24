import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:firebase_auth/firebase_auth.dart'; // Para obtener el UID del admin

class PantallaGrabarRuta extends StatefulWidget {
  const PantallaGrabarRuta({super.key});

  @override
  State<PantallaGrabarRuta> createState() => _PantallaGrabarRutaState();
}

class _PantallaGrabarRutaState extends State<PantallaGrabarRuta> {
  final MapController _mapController = MapController();
  StreamSubscription<Position>? _positionStreamSubscription;
  List<LatLng> _puntosRuta = [];
  bool _isRecording = false;
  String _statusMessage = 'Listo para grabar.';
  LatLng _lastPosition = const LatLng(-15.4985, -70.1338);
  bool _initialLocationLoaded = false;

  // --- NUEVO: Para seleccionar Línea y Dirección ---
  String? _lineaSeleccionadaId; // Guardará el ID automático de la línea elegida
  String _direccionSeleccionada = 'ida'; // Por defecto 'ida'
  List<DropdownMenuItem<String>> _lineasDropdownItems = []; // Para el Dropdown

  // Controladores para el diálogo de guardado (ya no se usan aquí directamente)
  // final _nombreLineaController = TextEditingController();
  // final _colorLineaController = TextEditingController(text: '#FF0000');
  // final _empresaIdController = TextEditingController(text: 'empresa_01');

  @override
  void initState() {
    super.initState();
    _checkPermissionsAndGetInitialLocation();
    _cargarLineasParaDropdown(); // Cargar líneas al iniciar
  }

  @override
  void dispose() {
    _positionStreamSubscription?.cancel();
    // _nombreLineaController.dispose(); // Ya no se usan
    // _colorLineaController.dispose();
    // _empresaIdController.dispose();
    super.dispose();
  }

  // --- Lógica para cargar las Líneas existentes ---
  Future<void> _cargarLineasParaDropdown() async {
     try {
       final querySnapshot = await FirebaseFirestore.instance.collection('Lineas').get();
       final items = querySnapshot.docs.map((doc) {
         return DropdownMenuItem<String>(
           value: doc.id, // El valor es el ID automático
           child: Text(doc.data()['nombre'] ?? 'Sin Nombre'), // Mostramos el nombre
         );
       }).toList();

       // Si hay líneas, seleccionar la primera por defecto
       if (items.isNotEmpty) {
          _lineaSeleccionadaId = items.first.value;
       }

       setState(() {
         _lineasDropdownItems = items;
       });

     } catch (e) {
        print("Error cargando líneas: $e");
        if (mounted) {
           ScaffoldMessenger.of(context).showSnackBar(
             SnackBar(content: Text('Error al cargar líneas existentes: $e')));
        }
     }
  }


  // --- Lógica de Permisos y Ubicación Inicial (Sin Cambios) ---
  Future<void> _checkPermissionsAndGetInitialLocation() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Por favor, activa el GPS.')));
      return;
    }
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Permiso de ubicación denegado.')));
        return;
      }
    }
    if (permission == LocationPermission.deniedForever && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text(
              'Permiso denegado permanentemente. Abre la configuración.')));
      return;
    }
    try {
      Position currentPosition = await Geolocator.getCurrentPosition();
      _lastPosition = LatLng(currentPosition.latitude, currentPosition.longitude);
      if (mounted) {
        _mapController.move(_lastPosition, 16.0);
        setState(() {
           _initialLocationLoaded = true;
        });
      }
    } catch (e) {
      print("Error obteniendo ubicación inicial: $e");
       if (mounted) {
         ScaffoldMessenger.of(context).showSnackBar(
           SnackBar(content: Text('Error al obtener ubicación: $e')));
         setState(() {
           _initialLocationLoaded = true;
         });
       }
    }
  }

  // --- Lógica de Grabación (Sin Cambios Internos) ---
  void _startRecording() {
    if (_isRecording) return;
    _checkPermissionsAndGetInitialLocation().then((_) async {
       if (!_initialLocationLoaded && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
             content: Text('No se pudo obtener la ubicación inicial. Intenta de nuevo.')));
          return;
       }
        _puntosRuta = [];
        if (_lastPosition.latitude != -15.4985) {
          _puntosRuta.add(_lastPosition);
        }
        const LocationSettings locationSettings = LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 5,
        );
        _positionStreamSubscription =
            Geolocator.getPositionStream(locationSettings: locationSettings)
                .handleError((error) {
           if (mounted) {
             setState(() {
               _statusMessage = 'Error de GPS: $error';
               _stopRecording();
             });
           }
        }).listen((Position position) {
          final nuevoPunto = LatLng(position.latitude, position.longitude);
          _lastPosition = nuevoPunto;
           if (mounted) {
             setState(() {
               _puntosRuta.add(nuevoPunto);
               _statusMessage =
                   'Grabando ${_direccionSeleccionada.toUpperCase()}... ${_puntosRuta.length} puntos capturados.'; // Muestra Ida/Vuelta
                _mapController.move(_lastPosition, _mapController.camera.zoom);
             });
           }
        });
         if (mounted) {
           setState(() {
             _isRecording = true;
             _statusMessage = 'Grabación iniciada para ${_direccionSeleccionada.toUpperCase()}. ¡Muévete!';
           });
         }
    });
  }

  void _stopRecording() {
    _positionStreamSubscription?.cancel();
    _positionStreamSubscription = null;
    if (mounted) {
      setState(() {
        _isRecording = false;
        _statusMessage =
            'Grabación ${_direccionSeleccionada.toUpperCase()} detenida. ${_puntosRuta.length} puntos. ¿Guardar Propuesta?';
      });
    }
  }

  // --- Lógica de Guardado (MODIFICADA) ---
  Future<void> _showSaveDialog() async {
    if (_puntosRuta.length < 2) {
       if (mounted) {
         ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
           content: Text('Necesitas al menos 2 puntos para guardar una ruta.')));
       }
      return;
    }
    if (_lineaSeleccionadaId == null) {
      if (mounted) {
         ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
           content: Text('Por favor, selecciona una línea antes de guardar.')));
       }
      return;
    }

    // Ya no pedimos nombre/color/empresa aquí, solo confirmamos
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        // Encontrar el nombre de la línea seleccionada para mostrarlo
        final lineaItem = _lineasDropdownItems.firstWhere((item) => item.value == _lineaSeleccionadaId, orElse: () => const DropdownMenuItem(child: Text('Desconocida')));
        final nombreLinea = (lineaItem.child as Text).data ?? 'Desconocida';

        return AlertDialog(
          title: const Text('Guardar Propuesta de Ruta'),
          content: SingleChildScrollView(
            child: ListBody(
              children: <Widget>[
                Text('Línea: $nombreLinea'),
                Text('Dirección: ${_direccionSeleccionada.toUpperCase()}'),
                Text('Puntos a guardar: ${_puntosRuta.length}'),
                const SizedBox(height: 10),
                const Text('Esta ruta se guardará como "pendiente" para revisión.', style: TextStyle(fontStyle: FontStyle.italic)),
              ],
            ),
          ),
          actions: <Widget>[
            TextButton(
              child: const Text('Cancelar'),
              onPressed: () {
                Navigator.of(context).pop();
              },
            ),
            TextButton(
              child: const Text('Guardar Propuesta'),
              onPressed: () {
                _saveRouteProposalToFirestore(); // Llamar a la nueva función
                Navigator.of(context).pop(); // Cerrar diálogo
              },
            ),
          ],
        );
      },
    );
  }

  // --- NUEVA FUNCIÓN PARA GUARDAR EN RutasPropuestas ---
  Future<void> _saveRouteProposalToFirestore() async {
     if (_lineaSeleccionadaId == null) return; // Doble chequeo

     final user = FirebaseAuth.instance.currentUser;
     if (user == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Error: No se pudo identificar al usuario admin.')));
        }
       return;
     }


     if (mounted) {
       setState(() { _statusMessage = 'Guardando propuesta en Firestore...'; });
     }

    List<GeoPoint> rutaParaFirestore = _puntosRuta
        .map((latlng) => GeoPoint(latlng.latitude, latlng.longitude))
        .toList();

    try {
      // Crear documento en la NUEVA colección
      await FirebaseFirestore.instance.collection('RutasPropuestas').add({
        'lineaId': _lineaSeleccionadaId,
        'propuestaIdaVuelta': _direccionSeleccionada, // 'ida' o 'vuelta'
        'puntosGrabados': rutaParaFirestore,
        'estadoPropuesta': 'pendiente',
        'fechaPropuesta': FieldValue.serverTimestamp(),
        'propuestoPorAuthUid': user.uid, // Quién lo propuso
        'comentariosRevision': '', // Vacío inicialmente
      });

       if (mounted) {
         setState(() {
           _statusMessage = '¡Propuesta para ${_direccionSeleccionada.toUpperCase()} guardada para revisión!';
           _puntosRuta = []; // Limpiar puntos después de guardar
         });
       }

    } catch (e) {
      print("Error guardando propuesta: $e");
       if (mounted) {
         setState(() { _statusMessage = 'Error al guardar la propuesta: $e'; });
       }
    }
  }


  // --- UI ---
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin: Grabar Ruta'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(80.0), // Aumentar altura para Dropdowns
          child: Container(
             color: Colors.black.withOpacity(0.7),
             width: double.infinity,
             padding: const EdgeInsets.all(8.0),
             child: Column(
               children: [
                 // --- NUEVO: Selectores de Línea y Dirección ---
                 Row(
                   mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                   children: [
                     // Dropdown para Líneas
                     DropdownButton<String>(
                        value: _lineaSeleccionadaId,
                        items: _lineasDropdownItems,
                        onChanged: _isRecording ? null : (String? newValue) { // Deshabilitar si está grabando
                          setState(() {
                            _lineaSeleccionadaId = newValue;
                          });
                        },
                        hint: const Text('Selecciona Línea', style: TextStyle(color: Colors.white70)),
                        style: const TextStyle(color: Colors.white), // Texto blanco
                        dropdownColor: Colors.grey[800], // Fondo oscuro
                     ),
                      // Dropdown/Selector para Ida/Vuelta
                      DropdownButton<String>(
                        value: _direccionSeleccionada,
                        items: const [
                           DropdownMenuItem(value: 'ida', child: Text('IDA')),
                           DropdownMenuItem(value: 'vuelta', child: Text('VUELTA')),
                        ],
                        onChanged: _isRecording ? null : (String? newValue) { // Deshabilitar si está grabando
                           if (newValue != null) {
                             setState(() {
                               _direccionSeleccionada = newValue;
                             });
                           }
                        },
                         style: const TextStyle(color: Colors.white),
                         dropdownColor: Colors.grey[800],
                      ),
                   ],
                 ),
                 // Mensaje de estado
                 Padding(
                   padding: const EdgeInsets.only(top: 8.0),
                   child: Text(
                      _statusMessage,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white)
                   ),
                 ),
               ],
             )
          ),
        ),
      ),
      body: !_initialLocationLoaded
          ? const Center(child: CircularProgressIndicator())
          : FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: _lastPosition,
                initialZoom: 16.0,
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.example.transporte_app',
                ),
                if (_puntosRuta.isNotEmpty)
                  PolylineLayer(
                    polylines: [
                      Polyline(
                        points: _puntosRuta,
                        color: Colors.blue.withOpacity(0.8),
                        strokeWidth: 6.0,
                      ),
                    ],
                  ),
                 MarkerLayer(markers: [
                   Marker(
                      point: _lastPosition,
                      child: const Icon(Icons.my_location, color: Colors.redAccent, size: 30,)
                   )
                 ])
              ],
            ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            FloatingActionButton.extended(
              heroTag: 'record_button',
              // Deshabilitar si no se ha seleccionado una línea
              onPressed: (_lineaSeleccionadaId == null) ? null : (_isRecording ? _stopRecording : _startRecording),
              label: Text(_isRecording ? 'Detener Grabación' : 'Iniciar Grabación'),
              icon: Icon(_isRecording ? Icons.stop : Icons.fiber_manual_record, color: _isRecording ? Colors.red : Colors.green),
              backgroundColor: (_lineaSeleccionadaId == null) ? Colors.grey : (_isRecording ? Colors.red.shade100 : Colors.green.shade100),
            ),
            if (!_isRecording && _puntosRuta.isNotEmpty)
              FloatingActionButton.extended(
                heroTag: 'save_button',
                onPressed: _showSaveDialog,
                label: const Text('Guardar Propuesta'), // Cambiado texto
                icon: const Icon(Icons.save),
                backgroundColor: Colors.blue.shade100,
              ),
          ],
        ),
      ),
    );
  }
}

