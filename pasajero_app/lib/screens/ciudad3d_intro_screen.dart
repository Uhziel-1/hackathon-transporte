import 'package:flutter/material.dart';
import 'package:rive/rive.dart';

class Ciudad3D extends StatefulWidget {
  final VoidCallback? onTap;

  const Ciudad3D({super.key, this.onTap});

  @override
  State<Ciudad3D> createState() => _Ciudad3DState();
}

class _Ciudad3DState extends State<Ciudad3D> {
  Artboard? _artboard;
  StateMachineController? _controller;

  @override
  void initState() {
    super.initState();
    // Cargar Rive
    rootBundle.load('assets/4667-9425-isomatric-city.riv').then(
      (data) async {
        final file = RiveFile.import(data);
        final artboard = file.mainArtboard;
        var controller = StateMachineController.fromArtboard(artboard, 'State Machine 1');
        if (controller != null) {
          artboard.addController(controller);
        }
        setState(() {
          _artboard = artboard;
          _controller = controller;
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      child: _artboard == null
          ? const Center(child: CircularProgressIndicator())
          : Rive(artboard: _artboard!),
    );
  }
}
