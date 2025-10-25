import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart'; // Asegúrate que este archivo exista en lib/
import 'screens/pasajero_home_screen.dart'; // Importar la nueva pantalla

void main() async {
  // Asegurar inicialización de Flutter
  WidgetsFlutterBinding.ensureInitialized();
  // Inicializar Firebase
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const PasajeroApp());
}

class PasajeroApp extends StatelessWidget {
  const PasajeroApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'App Pasajero Juliaca',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.lightBlue), // Color diferente
        useMaterial3: true,
      ),
      debugShowCheckedModeBanner: false,
      home: const PasajeroHomeScreen(), // Pantalla principal del pasajero
    );
  }
}
