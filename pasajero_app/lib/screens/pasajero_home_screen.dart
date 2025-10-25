import 'dart:async'; // Necesario para StreamSubscription y Future.delayed
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:pasajero_app/widgets/filtro_lineas_modal.dart'; // Importar modal
import 'package:pasajero_app/screens/chatbot_screen.dart';

// --- Interfaz Vehículo (sin cambios) ---
class VehiculoInfo { /* ... */
  final String id;
  final String placa;
  final String estado;
  final LatLng posicion;
  final String lineaId;

  VehiculoInfo({ required this.id, required this.placa, required this.estado, required this.posicion, required this.lineaId });
}

// --- Interfaz Línea (sin cambios) ---
class LineaInfo { /* ... */
  final String id;
  final String nombre;
  final Color color;
  final List<LatLng> rutaIda;
  final List<LatLng> rutaVuelta;

  LineaInfo({ required this.id, required this.nombre, required this.color, required this.rutaIda, required this.rutaVuelta });
}
// --- Fin Interfaces ---

class PasajeroHomeScreen extends StatefulWidget {
  const PasajeroHomeScreen({super.key});

  @override
  State<PasajeroHomeScreen> createState() => _PasajeroHomeScreenState();
}

class _PasajeroHomeScreenState extends State<PasajeroHomeScreen> {
  final MapController _mapController = MapController();
  LatLng _userLocation = const LatLng(-15.4985, -70.1338); // Default Juliaca
  bool _locationLoaded = false;
  String _statusMessage = 'Cargando ubicación y datos...';
  String _defaultStatusMessage = '';

  List<VehiculoInfo> _vehiculosActivos = [];
  List<LineaInfo> _lineasDisponibles = [];
  // Filtro: null = todo, Set vacío = nada, Set con IDs = solo esos
  Set<String>? _lineasFiltradas = null;

  // Estado para mostrar/ocultar rutas
  bool _mostrarRutas = true; // Empezar mostrando las rutas por defecto

  StreamSubscription? _vehiculosSubscription;
  StreamSubscription? _lineasSubscription;
  Timer? _statusResetTimer;

  @override
  void initState() {
    super.initState();
    _checkPermissionsAndGetInitialLocation();
    _startListeningToVehiculos();
    _startListeningToLineas();
  }

  @override
  void dispose() {
    _vehiculosSubscription?.cancel();
    _lineasSubscription?.cancel();
    _statusResetTimer?.cancel();
    super.dispose();
  }

  // --- Lógica Permisos y Ubicación Pasajero (sin cambios) ---
  Future<void> _checkPermissionsAndGetInitialLocation() async { /* ... */
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled && mounted) { _updateStatusMessage('Por favor, activa tu GPS.'); return; }
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied && mounted) { _updateStatusMessage('Permiso de ubicación denegado.'); return; }
    }
    if (permission == LocationPermission.deniedForever && mounted) { _updateStatusMessage('Permiso denegado permanentemente.'); return; }
    try {
      Position currentPosition = await Geolocator.getCurrentPosition();
      if (mounted) {
          _userLocation = LatLng(currentPosition.latitude, currentPosition.longitude);
          _locationLoaded = true;
          _updateStatusMessage('Ubicación encontrada. Cargando datos...');
          _mapController.move(_userLocation, 15.0);
      }
    } catch (e) {
      print("Error obteniendo ubicación inicial del pasajero: $e");
       if (mounted) { _updateStatusMessage('No se pudo obtener tu ubicación. Mostrando Juliaca.'); _locationLoaded = true; }
    }
   }

  // --- Listener Vehículos (sin cambios) ---
  void _startListeningToVehiculos() { /* ... */
    final query = FirebaseFirestore.instance.collection('Vehiculos').where('estado', whereIn: ['en_ruta_ida', 'en_ruta_vuelta']);
    _vehiculosSubscription = query.snapshots().listen((QuerySnapshot snapshot) {
      if (!mounted) return;
      final vehiculos = snapshot.docs.map((doc) {
        final data = doc.data() as Map<String, dynamic>; final ubicacion = data['ubicacionActual'] as GeoPoint?;
        if (ubicacion != null && data['placa'] != null && data['estado'] != null && data['lineaId'] != null) { return VehiculoInfo(id: doc.id, placa: data['placa'], estado: data['estado'], posicion: LatLng(ubicacion.latitude, ubicacion.longitude), lineaId: data['lineaId']); } return null;
      }).whereType<VehiculoInfo>().toList();
      _vehiculosActivos = vehiculos;
      _defaultStatusMessage = '${_vehiculosActivos.length} vehículos activos.';
      if (_statusResetTimer == null || !_statusResetTimer!.isActive) { _updateStatusMessage(_defaultStatusMessage); } else { if(mounted) setState(() {}); }
    }, onError: (error) { print("Error escuchando vehículos: $error"); _updateStatusMessage('Error al cargar vehículos.'); });
  }

  // --- Listener Líneas (sin cambios) ---
  void _startListeningToLineas() { /* ... */
    final query = FirebaseFirestore.instance.collection('Lineas');
    _lineasSubscription = query.snapshots().listen((QuerySnapshot snapshot) {
      if (!mounted) return;
      final Set<String> currentLineIds = {};
      final lineas = snapshot.docs.map((doc) {
        final data = doc.data() as Map<String, dynamic>;
        final List<LatLng> rutaIda = (data['rutaIda'] as List<dynamic>? ?? []).whereType<GeoPoint>().map((gp) => LatLng(gp.latitude, gp.longitude)).toList();
        final List<LatLng> rutaVuelta = (data['rutaVuelta'] as List<dynamic>? ?? []).whereType<GeoPoint>().map((gp) => LatLng(gp.latitude, gp.longitude)).toList();
        Color color = Colors.red;
        if (data['color'] is String) { try { final colorString = (data['color'] as String).replaceAll('#', ''); if (colorString.length == 6) { color = Color(int.parse('0xFF$colorString')); } } catch (e) { print("Error parsing color ${data['color']}: $e"); } }
        currentLineIds.add(doc.id);
        return LineaInfo(id: doc.id, nombre: data['nombre'] ?? 'Sin Nombre', color: color, rutaIda: rutaIda, rutaVuelta: rutaVuelta);
      }).toList();
      _lineasDisponibles = lineas;
       _defaultStatusMessage = '${_vehiculosActivos.length} vehículos activos.';
      if (_statusResetTimer == null || !_statusResetTimer!.isActive) { _updateStatusMessage(_defaultStatusMessage); } else { if(mounted) setState(() {}); }
    }, onError: (error) { print("Error escuchando líneas: $error"); _updateStatusMessage('Error al cargar rutas.'); });
  }

  // --- Función actualizar mensaje (sin cambios) ---
  void _updateStatusMessage(String message, {Duration? duration}) { /* ... */
      if (mounted) { setState(() { _statusMessage = message; }); }
      _statusResetTimer?.cancel();
      if (duration != null) {
        _statusResetTimer = Timer(duration, () {
          if (mounted) { setState(() { _statusMessage = _defaultStatusMessage.isNotEmpty ? _defaultStatusMessage : 'Mapa listo.'; }); }
        });
      }
   }

  // --- Función abrir modal filtro (CORREGIDA) ---
  void _abrirModalFiltro() async {
    if (_lineasDisponibles.isEmpty) {
      _updateStatusMessage(
        _statusMessage.contains('Error')
            ? 'No se pueden cargar las líneas para filtrar.'
            : 'Cargando lista de líneas...',
        duration: const Duration(seconds: 3),
      );
      return;
    }

    final Set<String>? resultado = await showModalBottomSheet<Set<String>>(
      context: context,
      isScrollControlled: true,
      builder: (BuildContext context) {
        return FiltroLineasModal(
          lineasFiltradasActuales: _lineasFiltradas?.toList() ?? [],
          lineasDisponibles: _lineasDisponibles,
        );
      },
    );

    if (resultado != null && mounted) {
      setState(() {
        _lineasFiltradas = resultado.isEmpty ? null : resultado;
      });

      _updateStatusMessage(
        _lineasFiltradas == null
            ? 'Mostrando todas las líneas.'
            : 'Mostrando ${_lineasFiltradas!.length} línea(s) seleccionada(s).',
        duration: const Duration(seconds: 3),
      );
    }

  }


  // --- UI ---
  @override
  Widget build(BuildContext context) {
    // Lógica de Filtrado (sin cambios, usa _lineasFiltradas como Set?)
    final bool filtroActivo = _lineasFiltradas != null;
    final List<LineaInfo> lineasParaMostrar;
    final List<VehiculoInfo> vehiculosParaMostrar;
    if (!filtroActivo) { lineasParaMostrar = _lineasDisponibles; vehiculosParaMostrar = _vehiculosActivos; }
    else { lineasParaMostrar = _lineasDisponibles.where((l) => _lineasFiltradas!.contains(l.id)).toList(); vehiculosParaMostrar = _vehiculosActivos.where((v) => _lineasFiltradas!.contains(v.lineaId)).toList(); }

    return Scaffold(
      appBar: AppBar( /* ... (sin cambios) ... */
        title: const Text('Buses en Tiempo Real - Juliaca'),
        bottom: PreferredSize( preferredSize: const Size.fromHeight(20.0), child: Text( _statusMessage, style: Theme.of(context).textTheme.bodySmall?.copyWith( color: (_statusResetTimer?.isActive ?? false) || _statusMessage.contains('Error') ? Theme.of(context).colorScheme.secondary : null ), overflow: TextOverflow.ellipsis,),),
       ),
      body: FlutterMap(
        mapController: _mapController,
        options: MapOptions( /* ... (sin cambios) ... */ initialCenter: _userLocation, initialZoom: 14.0, maxZoom: 18, minZoom: 12 ),
        children: [
          // Capa de Mapa OSM
          TileLayer( /* ... (sin cambios) ... */ urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', userAgentPackageName: 'com.example.pasajero_app',),

          // Capa de Rutas (condicional con _mostrarRutas)
          if (_mostrarRutas)
            PolylineLayer( /* ... (sin cambios) ... */
              polylines: lineasParaMostrar.expand((linea) {
                List<Polyline> polylines = [];
                if (linea.rutaIda.isNotEmpty) { polylines.add(Polyline( points: linea.rutaIda, color: linea.color.withOpacity(0.7), strokeWidth: 4.0, )); }
                if (linea.rutaVuelta.isNotEmpty) { polylines.add(Polyline( points: linea.rutaVuelta, color: HSLColor.fromColor(linea.color).withLightness(0.7).toColor().withOpacity(0.6), strokeWidth: 3.0, )); }
                return polylines;
              }).toList(),
            ),

          // Capa de Marcadores de Vehículos (sin cambios)
          MarkerLayer( /* ... (sin cambios) ... */
            markers: vehiculosParaMostrar.map((vehiculo) {
              IconData iconData = Icons.directions_bus; Color iconColor = Colors.grey; String direccion = "";
               if (vehiculo.estado == 'en_ruta_ida') { iconColor = Colors.green; iconData = Icons.arrow_upward; direccion = " (IDA)"; }
               else if (vehiculo.estado == 'en_ruta_vuelta') { iconColor = Colors.blue; iconData = Icons.arrow_downward; direccion = " (VUELTA)"; }
              return Marker( width: 40.0, height: 40.0, point: vehiculo.posicion,
                child: GestureDetector( onTap: () { final linea = _lineasDisponibles.firstWhere((l) => l.id == vehiculo.lineaId, orElse: () => LineaInfo(id: '', nombre: 'Línea Desconocida', color: Colors.grey, rutaIda: [], rutaVuelta: [])); _updateStatusMessage( '${linea.nombre} - Placa ${vehiculo.placa}${direccion}', duration: const Duration(seconds: 3) ); },
                   child: Container( decoration: BoxDecoration( color: iconColor.withOpacity(0.9), shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2), boxShadow: [ BoxShadow(color: Colors.black26, blurRadius: 4, offset: Offset(2,2)) ]), child: Icon(iconData, color: Colors.white, size: 20),),
                ),);
            }).toList(),
           ),

          // Marcador de ubicación del usuario (sin cambios)
          if (_locationLoaded && _userLocation.latitude != -15.4985)
             MarkerLayer( markers: [ Marker( point: _userLocation, width: 24, height: 24, child: const Icon(Icons.my_location, color: Colors.blueAccent, size: 24)) ])

        ],
      ),
      // Botones Flotantes (sin cambios)
      floatingActionButton: Column(
         mainAxisAlignment: MainAxisAlignment.end,
         children: [
            FloatingActionButton( heroTag: 'filter_button', onPressed: _abrirModalFiltro, tooltip: 'Filtrar Líneas', child: const Icon(Icons.filter_list),),
            const SizedBox(height: 8),
            FloatingActionButton( heroTag: 'toggle_routes_button', onPressed: () { final nuevoEstado = !_mostrarRutas; setState(() { _mostrarRutas = nuevoEstado; }); _updateStatusMessage( nuevoEstado ? 'Mostrando rutas' : 'Ocultando rutas', duration: const Duration(seconds: 2) ); }, tooltip: _mostrarRutas ? 'Ocultar Rutas' : 'Mostrar Rutas', child: Icon(_mostrarRutas ? Icons.layers_clear : Icons.layers), mini: true, backgroundColor: Colors.white70, foregroundColor: Colors.black54,),
            const SizedBox(height: 8),
            FloatingActionButton(heroTag: 'chat_button', onPressed: () { 
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const ChatbotScreen()),
              );
            }, tooltip: 'Preguntar al Chatbot', child: const Icon(Icons.chat_bubble_outline),),
         ],
      )
    );
  }
}

