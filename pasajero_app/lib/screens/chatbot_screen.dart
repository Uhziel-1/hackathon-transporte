import 'package:flutter/material.dart';
import 'dart:async'; // Para Future.delayed y Timer
import 'package:http/http.dart' as http; // Para llamadas HTTP
import 'dart:convert'; // Para jsonEncode/jsonDecode
import 'package:geolocator/geolocator.dart'; // Para obtener ubicación

// Modelo simple para un mensaje en el chat
class ChatMessage {
  final String text;
  final bool isUserMessage;
  final DateTime timestamp;

  ChatMessage({
    required this.text,
    required this.isUserMessage,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();
}

class ChatbotScreen extends StatefulWidget {
  const ChatbotScreen({super.key});

  @override
  State<ChatbotScreen> createState() => _ChatbotScreenState();
}

class _ChatbotScreenState extends State<ChatbotScreen> {
  final TextEditingController _textController = TextEditingController();
  final List<ChatMessage> _messages = [];
  final ScrollController _scrollController = ScrollController();
  bool _isBotThinking = false; // Estado para mostrar carga

  // --- ¡¡¡IMPORTANTE!!! REEMPLAZA CON TU URL REAL DE VERCEL ---
  final String _apiUrl = "https://hackathon-transporte-5q28.vercel.app/api/chatbot";
  // Ejemplo: "https://tu-proyecto-xxxxx.vercel.app/api/chatbot"
  // Asegúrate que empiece con https://
  // --- FIN URL ---


  @override
  void initState() {
    super.initState();
    // Mensaje inicial del bot
    _messages.add(ChatMessage(
      text: '¡Hola! Soy tu asistente de transporte. Pregúntame cómo llegar a algún lugar o sobre las líneas.',
      isUserMessage: false,
    ));
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  // --- Lógica REAL para Enviar Mensaje y Llamar a la API ---
  void _handleSendMessage() async { // Hacerla async
    final text = _textController.text.trim();
    if (text.isEmpty || _isBotThinking) return; // No enviar vacío o si ya está pensando

    // 1. Añadir mensaje del usuario y mostrar indicador de carga
    final userMessage = ChatMessage(text: text, isUserMessage: true);
    setState(() {
      _messages.add(userMessage);
      _isBotThinking = true; // Mostrar indicador "..."
    });
    _textController.clear();
    _scrollToBottom();

    Position userPosition;

    // 2. Obtener ubicación actual del usuario (con manejo de errores)
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      LocationPermission permission = await Geolocator.checkPermission();

      if (!serviceEnabled) throw Exception('GPS desactivado.');
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
         // Intentar pedir permiso de nuevo si es necesario
         permission = await Geolocator.requestPermission();
          if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
             throw Exception('Permiso de ubicación denegado.');
          }
      }

      userPosition = await Geolocator.getCurrentPosition();
      print("User location obtained: ${userPosition.latitude}, ${userPosition.longitude}");

    } catch (e) {
      print("Error getting location for chatbot: $e");
      final botErrorResponse = ChatMessage(
        text: 'No pude obtener tu ubicación actual. Asegúrate de tener el GPS activado y los permisos concedidos para continuar.',
        isUserMessage: false,
      );
      if (mounted) {
        setState(() { _messages.add(botErrorResponse); _isBotThinking = false; });
        _scrollToBottom();
      }
      return; // Salir si no hay ubicación
    }

    // 3. Llamar a la API Externa (Vercel)
    try {
      print("Calling API: $_apiUrl");
      final response = await http.post(
        Uri.parse(_apiUrl), // Usar la URL de Vercel
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'preguntaUsuario': text,
          'ubicacionUsuario': {
            'lat': userPosition.latitude,
            'lng': userPosition.longitude,
          },
        }),
      ).timeout(const Duration(seconds: 45)); // Timeout más largo para la API

      print("API Response Status: ${response.statusCode}");
      // print("API Response Body: ${response.body}"); // Descomentar para depurar body

      ChatMessage botResponse;
      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);
        final botText = responseData['respuestaBot'] ?? responseData['error'] ?? 'Recibí una respuesta inesperada del servidor.';
        botResponse = ChatMessage(text: botText, isUserMessage: false);
      } else {
         // Intentar leer mensaje de error del servidor si existe
         String serverError = 'Error del servidor (${response.statusCode}).';
         try {
           final errorData = jsonDecode(response.body);
           if (errorData['error'] != null) {
             serverError = 'Error: ${errorData['error']}';
           }
         } catch (_) { /* Ignorar error de parseo */ }
         botResponse = ChatMessage(text: serverError, isUserMessage: false);
      }
       if (mounted) {
          setState(() { _messages.add(botResponse); });
       }

    } catch (e) {
      print("Error calling API or processing response: $e");
      String errorMessage;
      if (e is TimeoutException) {
          errorMessage = 'El servidor tardó demasiado en responder. Inténtalo de nuevo.';
      } else {
          errorMessage = 'Lo siento, hubo un problema de conexión al procesar tu pregunta.';
      }
      final botErrorResponse = ChatMessage( text: errorMessage, isUserMessage: false );
      if (mounted) {
        setState(() { _messages.add(botErrorResponse); });
      }
    } finally {
      // Ocultar indicador y hacer scroll al final
      if (mounted) {
        setState(() { _isBotThinking = false; });
        _scrollToBottom();
      }
    }
  }

  // --- Función scroll (sin cambios) ---
  void _scrollToBottom() { /* ... */
    WidgetsBinding.instance.addPostFrameCallback((_) { if (_scrollController.hasClients) { _scrollController.animateTo( _scrollController.position.maxScrollExtent, duration: const Duration(milliseconds: 300), curve: Curves.easeOut,); } });
  }

  // --- UI del Chat ---
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Asistente de Transporte'),
      ),
      body: Column(
        children: [
          // Lista de mensajes
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(8.0),
              // Añadir espacio extra al final si el bot está pensando
              itemCount: _messages.length + (_isBotThinking ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == _messages.length && _isBotThinking) {
                   // Mostrar burbuja de "pensando"
                   return _buildMessageBubble(ChatMessage(text: "...", isUserMessage: false));
                }
                final message = _messages[index];
                return _buildMessageBubble(message);
              },
            ),
          ),
          // Área de entrada de texto
          _buildInputArea(),
        ],
      ),
    );
  }

  // --- buildMessageBubble (sin cambios) ---
  Widget _buildMessageBubble(ChatMessage message) { /* ... */
    final alignment = message.isUserMessage ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    final color = message.isUserMessage ? Theme.of(context).colorScheme.primary : (message.text == "..." ? Colors.grey[200] : Colors.grey[300]); // Color diferente para "pensando"
    final textColor = message.isUserMessage ? Theme.of(context).colorScheme.onPrimary : Colors.black87;
    return Container( margin: const EdgeInsets.symmetric(vertical: 4.0),
      child: Column( crossAxisAlignment: alignment, children: [
          Container( padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 10.0),
            decoration: BoxDecoration( color: color, borderRadius: BorderRadius.only( topLeft: const Radius.circular(16.0), topRight: const Radius.circular(16.0), bottomLeft: Radius.circular(message.isUserMessage ? 16.0 : 0), bottomRight: Radius.circular(message.isUserMessage ? 0 : 16.0),),),
            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
            child: Text( message.text, style: TextStyle(color: textColor),),
          ),
        ],),);
   }

  // --- buildInputArea (deshabilitar mientras piensa) ---
  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 8.0),
      decoration: BoxDecoration( /* ... */ color: Theme.of(context).cardColor, boxShadow: [ BoxShadow( offset: const Offset(0, -1), blurRadius: 2, color: Colors.black.withOpacity(0.1),),],),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _textController,
              decoration: const InputDecoration( hintText: 'Escribe tu pregunta...', border: InputBorder.none, contentPadding: EdgeInsets.symmetric(horizontal: 12.0),),
              textInputAction: TextInputAction.send,
              onSubmitted: _isBotThinking ? null : (_) => _handleSendMessage(), // Deshabilitar onSubmitted
               minLines: 1, maxLines: 5,
               enabled: !_isBotThinking, // Deshabilitar campo
            ),
          ),
          IconButton(
            icon: _isBotThinking ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.send), // Mostrar spinner en botón
            onPressed: _isBotThinking ? null : _handleSendMessage, // Deshabilitar botón
            tooltip: 'Enviar mensaje',
          ),
        ],
      ),
    );
  }
} // Fin clase _ChatbotScreenState

