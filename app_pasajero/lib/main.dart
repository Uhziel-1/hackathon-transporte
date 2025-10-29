import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'screens/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();
  await Hive.openBox('walletBox'); // almacenamiento local

  runApp(const AppPasajero());
}

class AppPasajero extends StatelessWidget {
  const AppPasajero({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'App Pasajero',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(primarySwatch: Colors.green),
      home: const HomeScreen(),
    );
  }
}
