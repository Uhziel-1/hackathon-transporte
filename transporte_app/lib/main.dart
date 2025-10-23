import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';

// --- IMPORTS DE FASE 0 ---
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart'; // Para el GPS

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Prueba Fase 0',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.cyan),
      ),
      home: const TestHomePage(), // Cambiamos el home
    );
  }
}

// --- PÁGINA DE PRUEBA DE FASE 0 ---
class TestHomePage extends StatefulWidget {
  const TestHomePage({super.key});

  @override
  State<TestHomePage> createState() => _TestHomePageState();
}

class _TestHomePageState extends State<TestHomePage> {
  LatLng? _posicionActual; // Para guardar nuestra ubicación
  String _mensajeEstado = 'Obteniendo ubicación...';

  @override
  void initState() {
    super.initState();
    _obtenerUbicacion();
  }

  // --- Función para pedir permiso y obtener GPS ---
  Future<void> _obtenerUbicacion() async {
    bool servicioHabilitado;
    LocationPermission permiso;

    // 1. Revisar si el GPS del teléfono está encendido
    servicioHabilitado = await Geolocator.isLocationServiceEnabled();
    if (!servicioHabilitado) {
      setState(() {
        _mensajeEstado = 'Por favor, enciende el GPS de tu teléfono.';
      });
      return;
    }

    // 2. Revisar si tenemos permiso
    permiso = await Geolocator.checkPermission();
    if (permiso == LocationPermission.denied) {
      permiso = await Geolocator.requestPermission(); // 3. Pedir permiso
      if (permiso == LocationPermission.denied) {
        setState(() {
          _mensajeEstado = 'Permiso de ubicación denegado.';
        });
        return;
      }
    }

    if (permiso == LocationPermission.deniedForever) {
      setState(() {
        _mensajeEstado = 'Permisos de ubicación denegados permanentemente.';
      });
      return;
    }

    // 4. Si todo está bien, obtener la ubicación
    try {
      Position posicion = await Geolocator.getCurrentPosition();
      setState(() {
        _posicionActual = LatLng(posicion.latitude, posicion.longitude);
        _mensajeEstado = '¡Ubicación encontrada!';
      });
    } catch (e) {
      setState(() {
        _mensajeEstado = 'No se pudo obtener la ubicación: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Prueba Fase 0 - Flutter'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(30.0),
          child: Text(_mensajeEstado, style: const TextStyle(color: Colors.white)),
        ),
      ),
      body: _posicionActual == null
          ? const Center(child: CircularProgressIndicator())
          : FlutterMap(
              options: MapOptions(
                initialCenter: _posicionActual!, // Centramos donde estés
                initialZoom: 16.0,
              ),
              children: [
                // Capa del mapa OSM (Gratuito)
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.example.transporte_app',
                ),
                // Marcador en tu ubicación
                if (_posicionActual != null)
                  MarkerLayer(
                    markers: [
                      Marker(
                        point: _posicionActual!,
                        child: const Icon(
                          Icons.person_pin_circle,
                          color: Colors.blue,
                          size: 40.0,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
    );
  }
}