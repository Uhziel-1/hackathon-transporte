import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:pasajero_app/widgets/filtro_lineas_modal.dart';
import 'package:pasajero_app/screens/chatbot_screen.dart';

// --- Interfaz Vehículo ---
class VehiculoInfo {
  final String id;
  final String placa;
  final String estado;
  final LatLng posicion;
  final String lineaId;

  VehiculoInfo({ 
    required this.id, 
    required this.placa, 
    required this.estado, 
    required this.posicion, 
    required this.lineaId 
  });
}

// --- Interfaz Línea ---
class LineaInfo {
  final String id;
  final String nombre;
  final Color color;
  final List<LatLng> rutaIda;
  final List<LatLng> rutaVuelta;

  LineaInfo({ 
    required this.id, 
    required this.nombre, 
    required this.color, 
    required this.rutaIda, 
    required this.rutaVuelta 
  });
}

class PasajeroHomeScreen extends StatefulWidget {
  const PasajeroHomeScreen({super.key});

  @override
  State<PasajeroHomeScreen> createState() => _PasajeroHomeScreenState();
}

class _PasajeroHomeScreenState extends State<PasajeroHomeScreen> 
    with TickerProviderStateMixin {
  
  final MapController _mapController = MapController();
  LatLng _userLocation = const LatLng(-15.4985, -70.1338);
  bool _locationLoaded = false;
  String _statusMessage = 'Cargando ubicación y datos...';
  String _defaultStatusMessage = '';

  List<VehiculoInfo> _vehiculosActivos = [];
  List<LineaInfo> _lineasDisponibles = [];
  Set<String>? _lineasFiltradas;
  bool _mostrarRutas = true;

  StreamSubscription? _vehiculosSubscription;
  StreamSubscription? _lineasSubscription;
  Timer? _statusResetTimer;

  // Animaciones
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _setupAnimations();
    _checkPermissionsAndGetInitialLocation();
    _startListeningToVehiculos();
    _startListeningToLineas();
  }

  void _setupAnimations() {
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);
    
    _pulseAnimation = Tween<double>(
      begin: 0.95,
      end: 1.05,
    ).animate(_pulseController);
  }

  @override
  void dispose() {
    _vehiculosSubscription?.cancel();
    _lineasSubscription?.cancel();
    _statusResetTimer?.cancel();
    _pulseController.dispose();
    super.dispose();
  }

  // --- Lógica Permisos y Ubicación Pasajero ---
  Future<void> _checkPermissionsAndGetInitialLocation() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled && mounted) { 
      _updateStatusMessage('Por favor, activa tu GPS.'); 
      return; 
    }
    
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied && mounted) { 
        _updateStatusMessage('Permiso de ubicación denegado.'); 
        return; 
      }
    }
    
    if (permission == LocationPermission.deniedForever && mounted) { 
      _updateStatusMessage('Permiso denegado permanentemente.'); 
      return; 
    }
    
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
      if (mounted) { 
        _updateStatusMessage('No se pudo obtener tu ubicación. Mostrando Juliaca.'); 
        _locationLoaded = true; 
      }
    }
  }

  // --- Listener Vehículos ---
  void _startListeningToVehiculos() {
    final query = FirebaseFirestore.instance.collection('Vehiculos')
        .where('estado', whereIn: ['en_ruta_ida', 'en_ruta_vuelta']);
    
    _vehiculosSubscription = query.snapshots().listen((QuerySnapshot snapshot) {
      if (!mounted) return;
      
      final vehiculos = snapshot.docs.map((doc) {
        final data = doc.data() as Map<String, dynamic>; 
        final ubicacion = data['ubicacionActual'] as GeoPoint?;
        
        if (ubicacion != null && data['placa'] != null && 
            data['estado'] != null && data['lineaId'] != null) { 
          return VehiculoInfo(
            id: doc.id, 
            placa: data['placa'], 
            estado: data['estado'], 
            posicion: LatLng(ubicacion.latitude, ubicacion.longitude), 
            lineaId: data['lineaId']
          ); 
        } 
        return null;
      }).whereType<VehiculoInfo>().toList();
      
      _vehiculosActivos = vehiculos;
      _defaultStatusMessage = '${_vehiculosActivos.length} vehículos activos.';
      
      if (_statusResetTimer == null || !_statusResetTimer!.isActive) { 
        _updateStatusMessage(_defaultStatusMessage); 
      } else { 
        if(mounted) setState(() {}); 
      }
    }, onError: (error) { 
      print("Error escuchando vehículos: $error"); 
      _updateStatusMessage('Error al cargar vehículos.'); 
    });
  }

  // --- Listener Líneas ---
  void _startListeningToLineas() {
    final query = FirebaseFirestore.instance.collection('Lineas');
    
    _lineasSubscription = query.snapshots().listen((QuerySnapshot snapshot) {
      if (!mounted) return;
      
      final Set<String> currentLineIds = {};
      final lineas = snapshot.docs.map((doc) {
        final data = doc.data() as Map<String, dynamic>;
        
        final List<LatLng> rutaIda = (data['rutaIda'] as List<dynamic>? ?? [])
            .whereType<GeoPoint>()
            .map((gp) => LatLng(gp.latitude, gp.longitude))
            .toList();
            
        final List<LatLng> rutaVuelta = (data['rutaVuelta'] as List<dynamic>? ?? [])
            .whereType<GeoPoint>()
            .map((gp) => LatLng(gp.latitude, gp.longitude))
            .toList();
            
        Color color = Colors.red;
        if (data['color'] is String) { 
          try { 
            final colorString = (data['color'] as String).replaceAll('#', ''); 
            if (colorString.length == 6) { 
              color = Color(int.parse('0xFF$colorString')); 
            } 
          } catch (e) { 
            print("Error parsing color ${data['color']}: $e"); 
          } 
        }
        
        currentLineIds.add(doc.id);
        return LineaInfo(
          id: doc.id, 
          nombre: data['nombre'] ?? 'Sin Nombre', 
          color: color, 
          rutaIda: rutaIda, 
          rutaVuelta: rutaVuelta
        );
      }).toList();
      
      _lineasDisponibles = lineas;
      _defaultStatusMessage = '${_vehiculosActivos.length} vehículos activos.';
      
      if (_statusResetTimer == null || !_statusResetTimer!.isActive) { 
        _updateStatusMessage(_defaultStatusMessage); 
      } else { 
        if(mounted) setState(() {}); 
      }
    }, onError: (error) { 
      print("Error escuchando líneas: $error"); 
      _updateStatusMessage('Error al cargar rutas.'); 
    });
  }

  // --- Función actualizar mensaje ---
  void _updateStatusMessage(String message, {Duration? duration}) {
    if (mounted) { 
      setState(() { 
        _statusMessage = message; 
      }); 
    }
    
    _statusResetTimer?.cancel();
    if (duration != null) {
      _statusResetTimer = Timer(duration, () {
        if (mounted) { 
          setState(() { 
            _statusMessage = _defaultStatusMessage.isNotEmpty ? 
                _defaultStatusMessage : 'Mapa listo.'; 
          }); 
        }
      });
    }
  }

  // --- Función abrir modal filtro ---
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
      backgroundColor: Colors.transparent,
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

  // --- UI MEJORADA CON DISEÑO FUTURISTA ---
  @override
  Widget build(BuildContext context) {
    final bool filtroActivo = _lineasFiltradas != null;
    final List<LineaInfo> lineasParaMostrar;
    final List<VehiculoInfo> vehiculosParaMostrar;
    
    if (!filtroActivo) { 
      lineasParaMostrar = _lineasDisponibles; 
      vehiculosParaMostrar = _vehiculosActivos; 
    } else { 
      lineasParaMostrar = _lineasDisponibles.where((l) => _lineasFiltradas!.contains(l.id)).toList(); 
      vehiculosParaMostrar = _vehiculosActivos.where((v) => _lineasFiltradas!.contains(v.lineaId)).toList(); 
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E21),
      appBar: _buildAppBarFuturista(),
      body: _buildMapWithOverlay(lineasParaMostrar, vehiculosParaMostrar),
      floatingActionButton: _buildFloatingControls(),
    );
  }

  AppBar _buildAppBarFuturista() {
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      title: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Buses en Tiempo Real',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          Text(
            'Juliaca - Transporte Urbano',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w300,
              color: Colors.white70,
            ),
          ),
        ],
      ),
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(40.0),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Colors.black.withOpacity(0.6),
                Colors.transparent,
              ],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
          child: Text(
            _statusMessage,
            style: TextStyle(
              color: (_statusResetTimer?.isActive ?? false) || _statusMessage.contains('Error')
                  ? const Color(0xFF00b09b)
                  : Colors.white70,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
            overflow: TextOverflow.ellipsis,
            maxLines: 1,
          ),
        ),
      ),
    );
  }

  Widget _buildMapWithOverlay(List<LineaInfo> lineas, List<VehiculoInfo> vehiculos) {
    return Stack(
      children: [
        _buildMap(lineas, vehiculos),
        if (!_locationLoaded)
          Container(
            color: const Color(0xFF0A0E21),
            child: const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF667eea)),
                  ),
                  SizedBox(height: 16),
                  Text(
                    'Cargando ubicación...',
                    style: TextStyle(color: Colors.white70),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildMap(List<LineaInfo> lineas, List<VehiculoInfo> vehiculos) {
    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: _userLocation,
        initialZoom: 14.0,
        maxZoom: 18,
        minZoom: 12,
      ),
      children: [
        // Capa de Mapa OSM
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.example.pasajero_app',
        ),

        // Capa de Rutas
        if (_mostrarRutas)
          PolylineLayer(
            polylines: lineas.expand((linea) {
              List<Polyline> polylines = [];
              if (linea.rutaIda.isNotEmpty) {
                polylines.add(Polyline(
                  points: linea.rutaIda,
                  color: linea.color.withOpacity(0.8),
                  strokeWidth: 5.0,
                ));
              }
              if (linea.rutaVuelta.isNotEmpty) {
                polylines.add(Polyline(
                  points: linea.rutaVuelta,
                  color: HSLColor.fromColor(linea.color).withLightness(0.7).toColor().withOpacity(0.7),
                  strokeWidth: 4.0,
                ));
              }
              return polylines;
            }).toList(),
          ),

        // Capa de Marcadores de Vehículos
        MarkerLayer(
          markers: vehiculos.map((vehiculo) {
            IconData iconData = Icons.directions_bus;
            Color iconColor = Colors.grey;
            String direccion = "";
            
            if (vehiculo.estado == 'en_ruta_ida') {
              iconColor = const Color(0xFF00b09b);
              iconData = Icons.arrow_upward;
              direccion = " (IDA)";
            } else if (vehiculo.estado == 'en_ruta_vuelta') {
              iconColor = const Color(0xFF667eea);
              iconData = Icons.arrow_downward;
              direccion = " (VUELTA)";
            }
            
            return Marker(
              width: 50.0,
              height: 50.0,
              point: vehiculo.posicion,
              child: GestureDetector(
                onTap: () {
                  final linea = _lineasDisponibles.firstWhere(
                    (l) => l.id == vehiculo.lineaId,
                    orElse: () => LineaInfo(
                      id: '',
                      nombre: 'Línea Desconocida',
                      color: Colors.grey,
                      rutaIda: [],
                      rutaVuelta: []
                    )
                  );
                  _updateStatusMessage(
                    '${linea.nombre} - Placa ${vehiculo.placa}$direccion',
                    duration: const Duration(seconds: 3)
                  );
                },
                child: AnimatedBuilder(
                  animation: _pulseAnimation,
                  builder: (context, child) {
                    return Transform.scale(
                      scale: _pulseAnimation.value,
                      child: Container(
                        decoration: BoxDecoration(
                          color: iconColor,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 3),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.4),
                              blurRadius: 8,
                              offset: const Offset(2, 2)
                            )
                          ]
                        ),
                        child: Icon(iconData, color: Colors.white, size: 24),
                      ),
                    );
                  },
                ),
              ),
            );
          }).toList(),
        ),

        // Marcador de ubicación del usuario
        if (_locationLoaded && _userLocation.latitude != -15.4985)
          MarkerLayer(
            markers: [
              Marker(
                point: _userLocation,
                width: 32,
                height: 32,
                child: AnimatedBuilder(
                  animation: _pulseAnimation,
                  builder: (context, child) {
                    return Transform.scale(
                      scale: _pulseAnimation.value,
                      child: Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFF667eea),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF667eea).withOpacity(0.5),
                              blurRadius: 6,
                              spreadRadius: 2,
                            )
                          ]
                        ),
                        child: const Icon(Icons.person_pin_circle, color: Colors.white, size: 18),
                      ),
                    );
                  },
                ),
              )
            ]
          ),
      ],
    );
  }

  // --- BOTONES FLOTANTES MEJORADOS ---
  Widget _buildFloatingControls() {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // Botón de Filtro (más importante, más grande)
          _buildPrimaryButton(
            icon: Icons.filter_alt,
            label: _lineasFiltradas != null ? 'Filtro (${_lineasFiltradas!.length})' : 'Filtrar',
            tooltip: 'Filtrar Líneas',
            isActive: _lineasFiltradas != null,
            onPressed: _abrirModalFiltro,
          ),
          
          const SizedBox(height: 12),
          
          // Botón de Rutas
          _buildSecondaryButton(
            icon: _mostrarRutas ? Icons.layers_clear : Icons.layers,
            label: _mostrarRutas ? 'Sin Rutas' : 'Con Rutas',
            tooltip: _mostrarRutas ? 'Ocultar Rutas' : 'Mostrar Rutas',
            isActive: _mostrarRutas,
            onPressed: () {
              final nuevoEstado = !_mostrarRutas;
              setState(() { 
                _mostrarRutas = nuevoEstado; 
              });
              _updateStatusMessage(
                nuevoEstado ? 'Mostrando rutas' : 'Ocultando rutas',
                duration: const Duration(seconds: 2)
              );
            },
          ),
          
          const SizedBox(height: 12),
          
          // Botón de Chatbot
          _buildTertiaryButton(
            icon: Icons.smart_toy,
            label: 'Asistente',
            tooltip: 'Preguntar al Chatbot',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const ChatbotScreen()),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildPrimaryButton({
    required IconData icon,
    required String label,
    required String tooltip,
    required bool isActive,
    required VoidCallback onPressed,
  }) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: isActive
            ? const LinearGradient(
                colors: [Color(0xFF00b09b), Color(0xFF96c93d)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : const LinearGradient(
                colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
        boxShadow: [
          BoxShadow(
            color: (isActive ? const Color(0xFF00b09b) : const Color(0xFF667eea)).withOpacity(0.4),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, color: Colors.white, size: 18),
                const SizedBox(width: 8),
                Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSecondaryButton({
    required IconData icon,
    required String label,
    required String tooltip,
    required bool isActive,
    required VoidCallback onPressed,
  }) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(15),
        color: isActive 
            ? const Color(0xFF00b09b).withOpacity(0.9)
            : Colors.white.withOpacity(0.15),
        border: Border.all(
          color: isActive ? const Color(0xFF00b09b) : Colors.white.withOpacity(0.3),
          width: 1.5,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(15),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(15),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, color: Colors.white, size: 16),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTertiaryButton({
    required IconData icon,
    required String label,
    required String tooltip,
    required VoidCallback onPressed,
  }) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(15),
        color: Colors.white.withOpacity(0.1),
        border: Border.all(
          color: Colors.white.withOpacity(0.2),
          width: 1,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(15),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(15),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, color: Colors.white70, size: 16),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}