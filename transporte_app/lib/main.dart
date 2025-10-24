import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
// Asumiendo que el nombre de tu paquete es 'transporte_app' (mira tu pubspec.yaml)
import 'package:transporte_app/auth_wrapper.dart'; 

// --- (Paso 1: Creación de usuario en Firebase) ---
// ANTES DE PROBAR, ve a tu consola de Firebase > Authentication > Users
// y crea manualmente un usuario. Por ejemplo:
// Email: conductor1@empresa.com
// Pass: 123456
// (Usaremos el 'cond_01' de Firestore como referencia)

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
      title: 'App Conductor',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.amber),
        useMaterial3: true,
      ),
      debugShowCheckedModeBanner: false,
      // Apuntamos al AuthWrapper, que está en su propio archivo
      home: const AuthWrapper(), 
    );
  }
}

