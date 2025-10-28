import 'package:flutter/material.dart';
import 'package:pasajero_app/screens/pasajero_home_screen.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

class MapaHibridoScreen extends StatefulWidget {
  const MapaHibridoScreen({super.key});

  @override
  State<MapaHibridoScreen> createState() => _MapaHibridoScreenState();
}

class _MapaHibridoScreenState extends State<MapaHibridoScreen> {
  final MapController _mapController = MapController();
  bool _mostrarMapaJuliaca = false;

  @override
  void initState() {
    super.initState();
    // Escuchar movimiento del mapa para detectar zoom
    _mapController.mapEventStream.listen((event) {
      if (event is MapEventMoveEnd) {
        if (_mapController.camera.zoom > 8 && !_mostrarMapaJuliaca) {
          setState(() {
            _mostrarMapaJuliaca = true;
          });
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_mostrarMapaJuliaca) {
      return const PasajeroHomeScreen(); // 👈 Tu mapa real
    }

    return Scaffold(
      appBar: AppBar(title: const Text("Vista 3D Perú - Zoom para ver Juliaca")),
      body: FlutterMap(
        mapController: _mapController,
        options: MapOptions(
          initialCenter: const LatLng(-9.19, -75.0152), // Centro del Perú
          initialZoom: 5.0,
          maxZoom: 18.0,
          minZoom: 3.0,
        ),
        children: [
          TileLayer(
            urlTemplate:
                'https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=TU_API_KEY_AQUI',
            userAgentPackageName: 'com.example.pasajero_app',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          setState(() {
            _mostrarMapaJuliaca = true;
          });
        },
        label: const Text("Ir a Juliaca"),
        icon: const Icon(Icons.location_city),
      ),
    );
  }
}
