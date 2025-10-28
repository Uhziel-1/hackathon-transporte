import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:firebase_auth/firebase_auth.dart';

class PantallaGrabarRuta extends StatefulWidget {
  const PantallaGrabarRuta({super.key});

  @override
  State<PantallaGrabarRuta> createState() => _PantallaGrabarRutaState();
}

class _PantallaGrabarRutaState extends State<PantallaGrabarRuta> 
    with TickerProviderStateMixin {
  
  final MapController _mapController = MapController();
  StreamSubscription<Position>? _positionStreamSubscription;
  List<LatLng> _puntosRuta = [];
  bool _isRecording = false;
  String _statusMessage = 'Listo para grabar.';
  LatLng _lastPosition = const LatLng(-15.4985, -70.1338);
  bool _initialLocationLoaded = false;

  // Variables para selección
  String? _lineaSeleccionadaId;
  String _direccionSeleccionada = 'ida';
  List<DropdownMenuItem<String>> _lineasDropdownItems = [];

  // Animaciones
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  late AnimationController _recordingController;

  @override
  void initState() {
    super.initState();
    _setupAnimations();
    _checkPermissionsAndGetInitialLocation();
    _cargarLineasParaDropdown();
  }

  void _setupAnimations() {
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    )..repeat(reverse: true);
    
    _pulseAnimation = Tween<double>(
      begin: 0.8,
      end: 1.2,
    ).animate(_pulseController);

    _recordingController = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _positionStreamSubscription?.cancel();
    _pulseController.dispose();
    _recordingController.dispose();
    super.dispose();
  }

  // --- Lógica de negocio (sin cambios) ---
  Future<void> _cargarLineasParaDropdown() async {
     try {
       final querySnapshot = await FirebaseFirestore.instance.collection('Lineas').get();
       final items = querySnapshot.docs.map((doc) {
         return DropdownMenuItem<String>(
           value: doc.id,
           child: Text(doc.data()['nombre'] ?? 'Sin Nombre'),
         );
       }).toList();

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
                   'Grabando ${_direccionSeleccionada.toUpperCase()}... ${_puntosRuta.length} puntos capturados.';
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

    final lineaItem = _lineasDropdownItems.firstWhere((item) => item.value == _lineaSeleccionadaId, orElse: () => const DropdownMenuItem(child: Text('Desconocida')));
    final nombreLinea = (lineaItem.child as Text).data ?? 'Desconocida';

    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1E1E2E),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          title: const Text(
            'Guardar Propuesta de Ruta',
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w600,
            ),
          ),
          content: SingleChildScrollView(
            child: ListBody(
              children: <Widget>[
                _buildSaveDialogItem('Línea', nombreLinea, Icons.directions_bus),
                _buildSaveDialogItem('Dirección', _direccionSeleccionada.toUpperCase(), Icons.alt_route),
                _buildSaveDialogItem('Puntos grabados', '${_puntosRuta.length}', Icons.location_pin),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.blue.withOpacity(0.3)),
                  ),
                  child: const Text(
                    'Esta ruta se guardará como "pendiente" para revisión.',
                    style: TextStyle(
                      color: Colors.blueAccent,
                      fontStyle: FontStyle.italic,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),
          actions: <Widget>[
            TextButton(
              style: TextButton.styleFrom(
                foregroundColor: Colors.white70,
              ),
              child: const Text('Cancelar'),
              onPressed: () {
                Navigator.of(context).pop();
              },
            ),
            Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF00b09b), Color(0xFF96c93d)],
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: TextButton(
                style: TextButton.styleFrom(
                  foregroundColor: Colors.white,
                ),
                child: const Text('Guardar Propuesta'),
                onPressed: () {
                  _saveRouteProposalToFirestore();
                  Navigator.of(context).pop();
                },
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildSaveDialogItem(String label, String value, IconData icon) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, color: Colors.blueAccent, size: 16),
          const SizedBox(width: 8),
          Text(
            '$label: ',
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _saveRouteProposalToFirestore() async {
     if (_lineaSeleccionadaId == null) return;

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
      await FirebaseFirestore.instance.collection('RutasPropuestas').add({
        'lineaId': _lineaSeleccionadaId,
        'propuestaIdaVuelta': _direccionSeleccionada,
        'puntosGrabados': rutaParaFirestore,
        'estadoPropuesta': 'pendiente',
        'fechaPropuesta': FieldValue.serverTimestamp(),
        'propuestoPorAuthUid': user.uid,
        'comentariosRevision': '',
      });

       if (mounted) {
         setState(() {
           _statusMessage = '¡Propuesta para ${_direccionSeleccionada.toUpperCase()} guardada para revisión!';
           _puntosRuta = [];
         });
       }

    } catch (e) {
      print("Error guardando propuesta: $e");
       if (mounted) {
         setState(() { _statusMessage = 'Error al guardar la propuesta: $e'; });
       }
    }
  }

  // --- UI MEJORADA CON DISEÑO FUTURISTA ---
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E21),
      appBar: _buildAppBarFuturista(),
      body: _buildMapWithOverlay(),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
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
            'Grabar Nueva Ruta',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          Text(
            'Modo Administrador',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w300,
              color: Colors.white70,
            ),
          ),
        ],
      ),
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(120.0),
        child: _buildControlPanel(),
      ),
    );
  }

  Widget _buildControlPanel() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            const Color(0xFF0A0E21).withOpacity(0.9),
            const Color(0xFF0A0E21).withOpacity(0.7),
            Colors.transparent,
          ],
        ),
      ),
      child: Column(
        children: [
          // Selectores de línea y dirección
          Row(
            children: [
              Expanded(
                child: _buildDropdownCard(
                  'Línea',
                  _lineaSeleccionadaId,
                  _lineasDropdownItems,
                  Icons.directions_bus,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildDirectionSelector(),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Estado de grabación
          _buildStatusIndicator(),
        ],
      ),
    );
  }

  Widget _buildDropdownCard(
    String label,
    String? value,
    List<DropdownMenuItem<String>> items,
    IconData icon,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: Colors.white70, size: 14),
              const SizedBox(width: 4),
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          DropdownButton<String>(
            value: value,
            items: items,
            onChanged: _isRecording ? null : (String? newValue) {
              setState(() {
                _lineaSeleccionadaId = newValue;
              });
            },
            isExpanded: true,
            dropdownColor: const Color(0xFF1E1E2E),
            style: const TextStyle(color: Colors.white, fontSize: 12),
            underline: const SizedBox(),
            icon: Icon(Icons.arrow_drop_down, color: Colors.white70),
          ),
        ],
      ),
    );
  }

  Widget _buildDirectionSelector() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.alt_route, color: Colors.white70, size: 14),
              const SizedBox(width: 4),
              Text(
                'Dirección',
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          Row(
            children: [
              _buildDirectionChip('IDA', 'ida', Colors.green),
              const SizedBox(width: 8),
              _buildDirectionChip('VUELTA', 'vuelta', Colors.blue),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDirectionChip(String text, String value, Color color) {
    final isSelected = _direccionSeleccionada == value;
    return Expanded(
      child: GestureDetector(
        onTap: _isRecording ? null : () {
          setState(() {
            _direccionSeleccionada = value;
          });
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
          decoration: BoxDecoration(
            color: isSelected ? color.withOpacity(0.2) : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isSelected ? color : Colors.white.withOpacity(0.2),
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Text(
            text,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isSelected ? color : Colors.white70,
              fontSize: 10,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusIndicator() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _getStatusColor().withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _getStatusColor().withOpacity(0.3)),
      ),
      child: Row(
        children: [
          AnimatedBuilder(
            animation: _pulseAnimation,
            builder: (context, child) {
              return Transform.scale(
                scale: _isRecording ? _pulseAnimation.value : 1.0,
                child: Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: _getStatusColor(),
                    shape: BoxShape.circle,
                    boxShadow: _isRecording ? [
                      BoxShadow(
                        color: _getStatusColor().withOpacity(0.5),
                        blurRadius: 8,
                        spreadRadius: 2,
                      )
                    ] : null,
                  ),
                ),
              );
            },
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              _statusMessage,
              style: TextStyle(
                color: _getStatusColor(),
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (_isRecording)
            AnimatedBuilder(
              animation: _recordingController,
              builder: (context, child) {
                return Icon(
                  Icons.circle,
                  color: Colors.red,
                  size: 8,
                );
              },
            ),
        ],
      ),
    );
  }

  Color _getStatusColor() {
    if (_isRecording) return const Color(0xFF00b09b);
    if (_puntosRuta.isNotEmpty) return const Color(0xFF667eea);
    return Colors.white70;
  }

  Widget _buildMapWithOverlay() {
    return Stack(
      children: [
        _buildMap(),
        if (!_initialLocationLoaded)
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

  Widget _buildMap() {
    return FlutterMap(
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
                color: const Color(0xFF00b09b),
                strokeWidth: 6.0,
              ),
            ],
          ),
        MarkerLayer(
          markers: [
            Marker(
              point: _lastPosition,
              child: AnimatedBuilder(
                animation: _pulseAnimation,
                builder: (context, child) {
                  return Transform.scale(
                    scale: _pulseAnimation.value,
                    child: const Icon(
                      Icons.my_location,
                      color: Color(0xFFff416c),
                      size: 30,
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildFloatingControls() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2E).withOpacity(0.9),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 20,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _buildControlButton(
            label: _isRecording ? 'DETENER' : 'GRABAR',
            icon: _isRecording ? Icons.stop : Icons.fiber_manual_record,
            gradient: _isRecording 
              ? const LinearGradient(colors: [Color(0xFFff416c), Color(0xFFff4b2b)])
              : const LinearGradient(colors: [Color(0xFF00b09b), Color(0xFF96c93d)]),
            onPressed: (_lineaSeleccionadaId == null) ? null : 
                     (_isRecording ? _stopRecording : _startRecording),
          ),
          if (!_isRecording && _puntosRuta.isNotEmpty)
            _buildControlButton(
              label: 'GUARDAR',
              icon: Icons.save,
              gradient: const LinearGradient(
                colors: [Color(0xFF667eea), Color(0xFF764ba2)],
              ),
              onPressed: _showSaveDialog,
            ),
        ],
      ),
    );
  }

  Widget _buildControlButton({
    required String label,
    required IconData icon,
    required Gradient gradient,
    required VoidCallback? onPressed,
  }) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        decoration: BoxDecoration(
          gradient: onPressed != null ? gradient : null,
          color: onPressed == null ? Colors.grey.shade800 : null,
          borderRadius: BorderRadius.circular(16),
          boxShadow: onPressed != null ? [
            BoxShadow(
              color: gradient.colors.first.withOpacity(0.3),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ] : null,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, color: Colors.white, size: 20),
                  const SizedBox(height: 4),
                  Text(
                    label,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}