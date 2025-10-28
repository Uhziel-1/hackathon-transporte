import 'dart:async';
import 'package:flutter/material.dart';
import 'package:rive/rive.dart' as rive;
import 'pasajero_home_screen.dart';
import 'package:flutter/services.dart';
import 'dart:math';


class PantallaInicial extends StatefulWidget {
  const PantallaInicial({super.key});

  @override
  State<PantallaInicial> createState() => _PantallaInicialState();
}

class _PantallaInicialState extends State<PantallaInicial>
    with TickerProviderStateMixin {

  bool _mostrarMapa2D = false;
  rive.Artboard? _artboard;
  rive.StateMachineController? _controller;
  rive.SMIInput<bool>? _nightInput;
  rive.SMIInput<bool>? _morningInput;

  // Animaciones
  late AnimationController _rotacionController;
  late AnimationController _scaleController;
  late Animation<double> _scaleAnimation;
  late AnimationController _fadeController;
  late Animation<double> _fadeAnimation;
  late AnimationController _glowController;
  late Animation<double> _glowAnimation;

  @override
  void initState() {
    super.initState();

    // Animación de rotación continua
    _rotacionController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 30),
    )..repeat();

    // Animación de escala para efecto pulsante
    _scaleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    )..repeat(reverse: true);

    _scaleAnimation = Tween<double>(
      begin: 0.98,
      end: 1.02,
    ).animate(_scaleController);

    // Animación de fade para textos
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);

    _fadeAnimation = Tween<double>(
      begin: 0.7,
      end: 1.0,
    ).animate(_fadeController);

    // Animación de brillo
    _glowController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);

    _glowAnimation = Tween<double>(
      begin: 0.3,
      end: 0.8,
    ).animate(_glowController);

    // Cargar Rive
    rootBundle.load('assets/4667-9425-isomatric-city.riv').then((data) {
     final file = rive.RiveFile.import(data);
final artboard = file.mainArtboard;
final controller = rive.StateMachineController.fromArtboard(artboard, 'State Machine 1');

      if (controller != null) {
        artboard.addController(controller);

        // Inputs para día/noche
        _nightInput = controller.findInput('night');
        _morningInput = controller.findInput('morning');

        // Configurar ciclo inicial
        _nightInput?.value = false;
        _morningInput?.value = true;
      }

      setState(() {
        _artboard = artboard;
        _controller = controller;
      });
    });

    // Cambiar automáticamente de día a noche cada 15 segundos
    Timer.periodic(const Duration(seconds: 15), (_) {
      if (_morningInput != null && _nightInput != null && mounted) {
        final temp = _morningInput!.value;
        _morningInput!.value = !_morningInput!.value;
        _nightInput!.value = temp;
      }
    });
  }

  @override
  void dispose() {
    _rotacionController.dispose();
    _scaleController.dispose();
    _fadeController.dispose();
    _glowController.dispose();
    super.dispose();
  }

  void _navigateToMap() {
    setState(() {
      _mostrarMapa2D = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E21),
      body: _mostrarMapa2D
          ? const PasajeroHomeScreen()
          : Stack(
              children: [
                // Fondo con gradiente espacial
                Container(
                  width: double.infinity,
                  height: double.infinity,
                  decoration: const BoxDecoration(
                    gradient: RadialGradient(
                      center: Alignment.center,
                      radius: 1.5,
                      colors: [
                        Color(0xFF0A0E21),
                        Color(0xFF1A1F34),
                        Color(0xFF0A0E21),
                      ],
                      stops: [0.0, 0.5, 1.0],
                    ),
                  ),
                ),

                // Efecto de partículas estelares
                _buildStarfield(),

                // Líneas de conexión futuristas
                _buildConnectionLines(),

                // Contenido principal centrado
                Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Título principal con efecto neón
                      AnimatedBuilder(
                        animation: _fadeAnimation,
                        builder: (context, child) {
                          return Opacity(
                            opacity: _fadeAnimation.value,
                            child: child,
                          );
                        },
                        child: Column(
                          children: [
                            Text(
                              'TRANSPORTE JULIACA',
                              style: TextStyle(
                                fontSize: 32,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                letterSpacing: 3.0,
                                shadows: [
                                  Shadow(
                                    color: const Color(0xFF00b09b).withOpacity(_glowAnimation.value),
                                    blurRadius: 20,
                                  ),
                                  Shadow(
                                    color: const Color(0xFF96c93d).withOpacity(_glowAnimation.value),
                                    blurRadius: 40,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'SISTEMA DE VISUALIZACIÓN EN TIEMPO REAL',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w300,
                                color: Colors.white70,
                                letterSpacing: 2.0,
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 80),

                      // DOMO futurista con la ciudad Rive
                      AnimatedBuilder(
                        animation: _rotacionController,
                        builder: (context, child) {
                          return Transform.rotate(
                            angle: _rotacionController.value * 6.28,
                            child: AnimatedBuilder(
                              animation: _scaleAnimation,
                              builder: (context, child) {
                                return Transform.scale(
                                  scale: _scaleAnimation.value,
                                  child: child,
                                );
                              },
                              child: GestureDetector(
                                onTap: _navigateToMap,
                                child: Stack(
                                  alignment: Alignment.center,
                                  children: [
                                    // Anillo exterior giratorio
                                    AnimatedBuilder(
                                      animation: _rotacionController,
                                      builder: (context, child) {
                                        return Transform.rotate(
                                          angle: -_rotacionController.value * 6.28,
                                          child: child,
                                        );
                                      },
                                      child: Container(
                                        width: 320,
                                        height: 320,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          border: Border.all(
                                            color: const Color(0xFF00b09b).withOpacity(0.5),
                                            width: 2,
                                          ),
                                        ),
                                      ),
                                    ),

                                    // DOMO principal
                                    Container(
                                      width: 300,
                                      height: 300,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        gradient: RadialGradient(
                                          center: Alignment.center,
                                          radius: 0.8,
                                          colors: [
                                            const Color(0xFF667eea).withOpacity(0.8),
                                            const Color(0xFF764ba2).withOpacity(0.6),
                                            Colors.transparent,
                                          ],
                                          stops: const [0.0, 0.5, 1.0],
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: const Color(0xFF667eea).withOpacity(0.4),
                                            blurRadius: 30,
                                            spreadRadius: 5,
                                          ),
                                          BoxShadow(
                                            color: const Color(0xFF764ba2).withOpacity(0.3),
                                            blurRadius: 50,
                                            spreadRadius: 10,
                                          ),
                                        ],
                                      ),
                                      child: ClipOval(
                                        child: Container(
                                          decoration: const BoxDecoration(
                                            gradient: RadialGradient(
                                              center: Alignment.center,
                                              radius: 0.6,
                                              colors: [
                                                Colors.transparent,
                                                Color(0xFF1A1F34),
                                              ],
                                            ),
                                          ),
                                          child: _artboard == null
                                              ? const Center(
                                                  child: CircularProgressIndicator(
                                                    valueColor: AlwaysStoppedAnimation<Color>(
                                                      Color(0xFF00b09b),
                                                    ),
                                                  ),
                                                )
                                              : rive.Rive(
                                                  artboard: _artboard!,
                                                  fit: BoxFit.cover,
                                                ),
                                        ),
                                      ),
                                    ),

                                    // Efecto de escaneo radial
                                    AnimatedBuilder(
                                      animation: _glowController,
                                      builder: (context, child) {
                                        return Container(
                                          width: 300,
                                          height: 300,
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            gradient: RadialGradient(
                                              center: Alignment.center,
                                              radius: 0.8,
                                              colors: [
                                                const Color(0xFF00b09b).withOpacity(_glowAnimation.value * 0.3),
                                                Colors.transparent,
                                              ],
                                            ),
                                          ),
                                        );
                                      },
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),

                      const SizedBox(height: 80),

                      // Indicador de interacción
                      AnimatedBuilder(
                        animation: _fadeAnimation,
                        builder: (context, child) {
                          return Opacity(
                            opacity: _fadeAnimation.value,
                            child: child,
                          );
                        },
                        child: Column(
                          children: [
                            Icon(
                              Icons.touch_app_rounded,
                              color: const Color(0xFF00b09b),
                              size: 40,
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'TOCA EL DOMO PARA EXPLORAR',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: const Color(0xFF00b09b),
                                letterSpacing: 1.5,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Visualiza las rutas de microbuses en tiempo real',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w300,
                                color: Colors.white54,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 60),

                      // Panel de estadísticas en tiempo real
                      Container(
                        margin: const EdgeInsets.symmetric(horizontal: 40),
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.05),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: Colors.white.withOpacity(0.1),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.3),
                              blurRadius: 20,
                              spreadRadius: 5,
                            ),
                          ],
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.spaceAround,
                          children: [
                            _StatItem(
                              icon: Icons.directions_bus,
                              value: '25+',
                              label: 'Microbuses',
                            ),
                            _StatItem(
                              icon: Icons.route,
                              value: '15+',
                              label: 'Rutas Activas',
                            ),
                            _StatItem(
                              icon: Icons.location_on,
                              value: 'GPS',
                              label: 'Tiempo Real',
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // Footer futurista
                Positioned(
                  bottom: 30,
                  left: 0,
                  right: 0,
                  child: AnimatedBuilder(
                    animation: _fadeAnimation,
                    builder: (context, child) {
                      return Opacity(
                        opacity: _fadeAnimation.value * 0.7,
                        child: child,
                      );
                    },
                    child: const Text(
                      'Tecnología de Visualización Avanzada - Ciudad de Juliaca',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w300,
                        color: Colors.white54,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildStarfield() {
    return IgnorePointer(
      child: Container(
        width: double.infinity,
        height: double.infinity,
        child: CustomPaint(
          painter: _StarfieldPainter(),
        ),
      ),
    );
  }

  Widget _buildConnectionLines() {
    return IgnorePointer(
      child: Container(
        width: double.infinity,
        height: double.infinity,
        child: CustomPaint(
          painter: _ConnectionLinesPainter(_glowAnimation),
        ),
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;

  const _StatItem({
    required this.icon,
    required this.value,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF00b09b).withOpacity(0.2),
            shape: BoxShape.circle,
            border: Border.all(
              color: const Color(0xFF00b09b).withOpacity(0.5),
              width: 1,
            ),
          ),
          child: Icon(
            icon,
            color: const Color(0xFF00b09b),
            size: 20,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w300,
            color: Colors.white70,
          ),
        ),
      ],
    );
  }
}

class _StarfieldPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.1)
      ..style = PaintingStyle.fill;

    final random = Random(42); // Semilla fija para consistencia

    for (int i = 0; i < 100; i++) {
      final x = random.nextDouble() * size.width;
      final y = random.nextDouble() * size.height;
      final radius = random.nextDouble() * 1.5 + 0.5;
      final opacity = random.nextDouble() * 0.3 + 0.1;

      canvas.drawCircle(
        Offset(x, y),
        radius,
        paint..color = Colors.white.withOpacity(opacity),
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _ConnectionLinesPainter extends CustomPainter {
  final Animation<double> glowAnimation;

  _ConnectionLinesPainter(this.glowAnimation);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF00b09b).withOpacity(glowAnimation.value * 0.1)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    final center = Offset(size.width / 2, size.height / 2);
    final random = Random(42);

    for (int i = 0; i < 20; i++) {
      final angle = random.nextDouble() * 6.28;
      final distance = random.nextDouble() * 200 + 100;
      final endX = center.dx + cos(angle) * distance;
      final endY = center.dy + sin(angle) * distance;

      canvas.drawLine(
        center,
        Offset(endX, endY),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

// Clase Random local para evitar importaciones adicionales
class Random {
  final int seed;

  Random(this.seed);

  double nextDouble() {
    // Algoritmo simple de random
    final x = sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - x.floorToDouble();
  }
}