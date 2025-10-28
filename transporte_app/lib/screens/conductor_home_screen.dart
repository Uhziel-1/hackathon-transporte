import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:transporte_app/screens/reportar_incidente_screen.dart';
import 'package:transporte_app/screens/grabar_ruta_screen.dart';

class PantallaPrincipalConductor extends StatefulWidget {
  final String userId;
  const PantallaPrincipalConductor({super.key, required this.userId});

  @override
  State<PantallaPrincipalConductor> createState() =>
      _PantallaPrincipalConductorState();
}

class _PantallaPrincipalConductorState
    extends State<PantallaPrincipalConductor> with TickerProviderStateMixin {

  // --- Estado de la App (sin cambios en la lógica) ---
  bool _isLoading = true;
  String? _conductorIdFirestore;
  String? _vehiculoIdFirestore;
  DocumentReference? _vehiculoRef;

  String _nombreConductor = 'Cargando...';
  String _placaVehiculo = 'Cargando...';
  String _lineaNombre = 'Cargando...';
  String _nombreTerminal1 = '';
  String _nombreTerminal2 = '';
  bool _esAdmin = false;

  bool _isTracking = false;
  String _currentEstadoVehiculo = '';
  String _feedbackMessage = 'Servicio detenido.';
  double _intervaloSegundos = 5.0;
  Timer? _gpsTimer;

  // Animaciones
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _setupAnimations();
    _buscarDatosIniciales();
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
    _gpsTimer?.cancel();
    _pulseController.dispose();
    super.dispose();
  }

  // --- Lógica de negocio (sin cambios) ---
  Future<void> _buscarDatosIniciales() async {
    setState(() { _isLoading = true; });
    try {
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
      _esAdmin = conductorDoc.data()['esAdminRutas'] ?? false;

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
           _nombreTerminal1 = lineaDoc.data()?['nombreTerminal1'] ?? 'Terminal 1';
           _nombreTerminal2 = lineaDoc.data()?['nombreTerminal2'] ?? 'Terminal 2';
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
        _esAdmin = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error crítico al cargar datos: $e')),
        );
      }
    }
  }

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

  // --- Lógica del GPS (sin cambios) ---
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
    final String nuevoEstado;
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
    Navigator.push(
        context,
        MaterialPageRoute(
            builder: (context) => const PantallaGrabarRuta()));
  }

  // --- UI MEJORADA CON DISEÑO FUTURISTA ---
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E21),
      appBar: _buildAppBarFuturista(),
      body: _buildBodyFuturista(),
    );
  }

  AppBar _buildAppBarFuturista() {
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Hola, $_nombreConductor',
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w300,
              color: Colors.white70,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '$_placaVehiculo • $_lineaNombre',
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w400,
              color: Colors.white54,
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF667eea), Color(0xFF764ba2)],
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.logout, color: Colors.white, size: 20),
          ),
          onPressed: () async {
            if (_isTracking) _terminarRuta();
            await FirebaseAuth.instance.signOut();
          },
        ),
      ],
    );
  }

  Widget _buildBodyFuturista() {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          // Panel de Estado Mejorado
          _buildStatusPanel(),
          const SizedBox(height: 24),

          // Botones de Acción Principales
          Expanded(
            child: _buildActionSection(),
          ),

          // Panel de Configuración
          _buildConfigPanel(),
        ],
      ),
    );
  }

  Widget _buildStatusPanel() {
    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (context, child) {
        return Transform.scale(
          scale: _isTracking ? _pulseAnimation.value : 1.0,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: _getStatusGradient(),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: _getStatusColor().withOpacity(0.3),
                  blurRadius: 15,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: _isLoading
                          ? const CircularProgressIndicator(color: Colors.white)
                          : Icon(
                              _isTracking ? Icons.radar : Icons.pending_actions,
                              color: Colors.white,
                              size: 24,
                            ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _isTracking ? 'EN RUTA ACTIVA' : 'SERVICIO DETENIDO',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _feedbackMessage,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 12,
                              fontWeight: FontWeight.w400,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  LinearGradient _getStatusGradient() {
    if (_isLoading) {
      return const LinearGradient(
        colors: [Color(0xFF636363), Color(0xFFa2ab58)],
      );
    }
    return _isTracking 
      ? const LinearGradient(
          colors: [Color(0xFF00b09b), Color(0xFF96c93d)],
        )
      : const LinearGradient(
          colors: [Color(0xFFff7e5f), Color(0xFFfeb47b)],
        );
  }

  Color _getStatusColor() {
    if (_isLoading) return const Color(0xFF636363);
    return _isTracking ? const Color(0xFF00b09b) : const Color(0xFFff7e5f);
  }

  Widget _buildActionSection() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF667eea)),
        ),
      );
    }

    if (_isTracking) {
      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildActionButton(
            text: 'FINALIZAR RUTA ACTUAL',
            icon: Icons.stop_circle_outlined,
            gradient: const LinearGradient(
              colors: [Color(0xFFff416c), Color(0xFFff4b2b)],
            ),
            onPressed: _terminarRuta,
          ),
        ],
      );
    }

    List<Widget> buttons = [];
    
    if (_currentEstadoVehiculo == 'en_terminal_1' || _currentEstadoVehiculo == 'fuera_de_servicio') {
      buttons.add(
        _buildActionButton(
          text: 'INICIAR RUTA IDA',
          subtitle: 'Hacia $_nombreTerminal2',
          icon: Icons.play_arrow_rounded,
          gradient: const LinearGradient(
            colors: [Color(0xFF00b09b), Color(0xFF96c93d)],
          ),
          onPressed: () => _iniciarRuta('ida'),
        ),
      );
    }

    if (_currentEstadoVehiculo == 'en_terminal_2' || _currentEstadoVehiculo == 'fuera_de_servicio') {
      if (buttons.isNotEmpty) {
        buttons.add(const SizedBox(height: 12));
      }
      buttons.add(
        _buildActionButton(
          text: 'INICIAR RUTA VUELTA',
          subtitle: 'Hacia $_nombreTerminal1',
          icon: Icons.play_arrow_rounded,
          gradient: const LinearGradient(
            colors: [Color(0xFF667eea), Color(0xFF764ba2)],
          ),
          onPressed: () => _iniciarRuta('vuelta'),
        ),
      );
    }

    if (buttons.isEmpty) {
      buttons.add(
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.05),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.1)),
          ),
          child: const Text(
            'Estado del vehículo no permite iniciar ruta',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white54),
          ),
        ),
      );
    }

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: buttons,
    );
  }

  Widget _buildActionButton({
    required String text,
    String? subtitle,
    required IconData icon,
    required Gradient gradient,
    required VoidCallback onPressed,
  }) {
    return Container(
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: gradient.colors.first.withOpacity(0.3),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: Colors.white, size: 24),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        text,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (subtitle != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          subtitle,
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: Colors.white),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildConfigPanel() {
    return Column(
      children: [
        // Botones secundarios
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.05),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              _buildSecondaryButton(
                icon: Icons.report_problem_outlined,
                text: 'Reportar Incidente',
                color: const Color(0xFFffa726),
                onTap: _irAReportes,
              ),
              if (_esAdmin) ...[
                const SizedBox(height: 12),
                _buildSecondaryButton(
                  icon: Icons.edit_road_outlined,
                  text: 'Modo Admin: Grabar Ruta',
                  color: const Color(0xFFab47bc),
                  onTap: _irAModoAdmin,
                ),
              ],
            ],
          ),
        ),

        const SizedBox(height: 20),

        // Slider de intervalo
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.05),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Intervalo de envío GPS',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${_intervaloSegundos.toInt()}s',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              SliderTheme(
                data: SliderThemeData(
                  trackHeight: 6,
                  thumbShape: const RoundSliderThumbShape(
                    enabledThumbRadius: 12,
                    disabledThumbRadius: 8,
                  ),
                  overlayShape: const RoundSliderOverlayShape(overlayRadius: 20),
                  activeTrackColor: const Color(0xFF667eea),
                  inactiveTrackColor: Colors.white.withOpacity(0.1),
                  thumbColor: const Color(0xFF667eea),
                  overlayColor: const Color(0xFF667eea).withOpacity(0.2),
                ),
                child: Slider(
                  value: _intervaloSegundos,
                  min: 3,
                  max: 30,
                  divisions: 9,
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
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSecondaryButton({
    required IconData icon,
    required String text,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Text(
                  text,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              Icon(Icons.arrow_forward_ios, color: Colors.white.withOpacity(0.5), size: 16),
            ],
          ),
        ),
      ),
    );
  }
}