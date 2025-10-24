import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:transporte_app/screens/conductor_home_screen.dart';
import 'package:transporte_app/screens/login_screen.dart';

// -------------------------------------------------------------------
// 1. WIDGET DE AUTENTICACIÓN
// -------------------------------------------------------------------
class AuthWrapper extends StatelessWidget {
  const AuthWrapper({super.key});

  @override
  Widget build(BuildContext context) {
    // Escucha los cambios de autenticación
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
              body: Center(child: CircularProgressIndicator()));
        }
        if (snapshot.hasData) {
          // Si el usuario está logueado, va a la app principal
          return PantallaPrincipalConductor(userId: snapshot.data!.uid);
        }
        // Si no, va al Login
        return const PantallaLogin();
      },
    );
  }
}
