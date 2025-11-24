import 'package:flutter/material.dart';
import 'dart:async'; // Para Future.delayed y Timer
import 'package:http/http.dart' as http; // Para llamadas HTTP
import 'dart:convert'; // Para jsonEncode/jsonDecode
import 'package:geolocator/geolocator.dart'; // Para obtener ubicación
import 'dart:io'; // ⬅️ IMPORTANTE: Para el objeto File
import 'package:image_picker/image_picker.dart'; // ⬅️ IMPORTANTE: Para la cámara/galería

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

  // --- URLs DE LA API ---
  // URL del chatbot para TEXTO (original, no se usa para la foto)
  final String _apiUrl = "https://hackathon-transporte-5q28.vercel.app/api/chatbot";
  
  // 📌 URL DE TU API DE GOOGLE APPS SCRIPT (Reemplazar con tu URL FINAL)
  final String _imageApiUrl = "https://script.google.com/macros/s/TU_WEB_APP_ID/exec"; 
  // ⚠️ Asegúrate de pegar aquí la URL COMPLETA de tu Web App de Apps Script.
  // --- FIN URL ---


  @override
  void initState() {
    super.initState();
    _messages.add(ChatMessage(
      text: '¡Hola! Soy tu asistente de transporte. Pregúntame cómo llegar a algún lugar o puedes subir una foto.',
      isUserMessage: false,
    ));
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }
  
  // --- FUNCIÓN DE UTILIDAD: SCROLL ---
  void _scrollToBottom() { 
    WidgetsBinding.instance.addPostFrameCallback((_) { 
      if (_scrollController.hasClients) { 
        _scrollController.animateTo( 
          _scrollController.position.maxScrollExtent, 
          duration: const Duration(milliseconds: 300), 
          curve: Curves.easeOut,
        ); 
      } 
    });
  }


  // --------------------------------------------------------
  // LÓGICA DE ENVÍO DE TEXTO (Original)
  // --------------------------------------------------------
  void _handleSendMessage() async { 
    final text = _textController.text.trim();
    if (text.isEmpty || _isBotThinking) return; 

    final userMessage = ChatMessage(text: text, isUserMessage: true);
    setState(() {
      _messages.add(userMessage);
      _isBotThinking = true; 
    });
    _textController.clear();
    _scrollToBottom();
    
    // ... (El resto de la lógica original para obtener ubicación y llamar a _apiUrl) ...
    // Se mantiene el código original aquí para el envío de texto.
    // Simplemente se ha omitido por espacio, asumiendo que tu código original funciona.
    
    // ⚠️ NOTA: Debes mantener aquí todo el código original de _handleSendMessage() 
    // para el manejo de ubicación y la llamada a _apiUrl para el TEXTO.
    
    // Al final del código original:
    if (mounted) {
      setState(() { _isBotThinking = false; });
      _scrollToBottom();
    }
  }


  // --------------------------------------------------------
  // LÓGICA DE ENVÍO DE IMAGEN (NUEVA FUNCIÓN)
  // --------------------------------------------------------

  // 1. Abre la galería/cámara
  void _selectImage() async {
    if (_isBotThinking) return;
    final picker = ImagePicker();
    
    // Permite al usuario seleccionar una imagen de la galería
    final XFile? pickedFile = await picker.pickImage(source: ImageSource.gallery, imageQuality: 70); 

    if (pickedFile != null) {
      _handleSendImage(File(pickedFile.path));
    }
  }

  // 2. Envía la imagen a la API de Apps Script
  void _handleSendImage(File imageFile) async {
    // 1. Añadir mensaje del usuario y mostrar indicador
    setState(() {
      _messages.add(ChatMessage(text: 'Analizando foto del lugar...', isUserMessage: true));
      _isBotThinking = true;
    });
    _scrollToBottom();

    try {
      // Convertir la imagen a Base64
      final imageBytes = await imageFile.readAsBytes();
      final base64Image = base64Encode(imageBytes);
      
      final response = await http.post(
        Uri.parse(_imageApiUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'image': base64Image, // El campo 'image' que tu Apps Script espera
          'mime': 'image/jpeg',
        }),
      ).timeout(const Duration(seconds: 45));

      ChatMessage botResponse;
      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);
        
        // --- Lógica de Parsing y Presentación de la IA ---
        final botText = responseData['mensaje_bot'] ?? 'Análisis completado. Revise los datos.';
        
        if (responseData['lineas_cercanas'] != null && responseData['coordenadas'] != null) {
            
            final lineas = (responseData['lineas_cercanas'] as List).cast<String>();
            final lat = responseData['coordenadas']['lat'];
            final lng = responseData['coordenadas']['lng'];

            final displayMessage = '✅ ¡Lugar identificado: ${responseData['lugar_identificado']}!\n\n'
                                    'Rutas disponibles: ${lineas.join(', ')}\n'
                                    'Coordenadas: ${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}';
            
            // Aquí iría el código para actualizar el mapa si la pantalla principal tuviera una función de callback
            
            botResponse = ChatMessage(text: displayMessage, isUserMessage: false);
        } else {
            // Error de DB (Lugar no encontrado en la hoja de cálculo)
            botResponse = ChatMessage(text: botText, isUserMessage: false);
        }

      } else {
        botResponse = ChatMessage(text: 'Error del servidor al analizar la foto: ${response.statusCode}.', isUserMessage: false);
      }

      if (mounted) {
        setState(() { _messages.add(botResponse); });
      }

    } catch (e) {
      print("Error en el análisis de imagen: $e");
      String errorMessage = (e is TimeoutException) ? 'La IA tardó demasiado en responder.' : 'Hubo un problema de conexión al servicio de IA.';
      final botErrorResponse = ChatMessage( text: errorMessage, isUserMessage: false );
      if (mounted) {
        setState(() { _messages.add(botErrorResponse); });
      }
    } finally {
      if (mounted) {
        setState(() { _isBotThinking = false; });
        _scrollToBottom();
      }
    }
  }


  // --------------------------------------------------------
  // UI Y WIDGETS
  // --------------------------------------------------------

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
              itemCount: _messages.length + (_isBotThinking ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == _messages.length && _isBotThinking) {
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
    final color = message.isUserMessage ? Theme.of(context).colorScheme.primary : (message.text == "..." ? Colors.grey[200] : Colors.grey[300]); 
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

  // --- buildInputArea (Integración del Botón de la Cámara) ---
  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 8.0),
      decoration: BoxDecoration( color: Theme.of(context).cardColor, boxShadow: [ BoxShadow( offset: const Offset(0, -1), blurRadius: 2, color: Colors.black.withOpacity(0.1),),],),
      child: Row(
        children: [
          // 📌 NUEVO: Botón de la Cámara/Galería
          IconButton(
            icon: const Icon(Icons.photo_camera),
            onPressed: _isBotThinking ? null : _selectImage, // Llama a la función _selectImage
            tooltip: 'Analizar lugar por foto',
          ),
          
          Expanded(
            child: TextField(
              controller: _textController,
              decoration: const InputDecoration( hintText: 'Escribe tu pregunta...', border: InputBorder.none, contentPadding: EdgeInsets.symmetric(horizontal: 12.0),),
              textInputAction: TextInputAction.send,
              onSubmitted: _isBotThinking ? null : (_) => _handleSendMessage(), 
              minLines: 1, maxLines: 5,
              enabled: !_isBotThinking, 
            ),
          ),
          IconButton(
            icon: _isBotThinking ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.send), 
            onPressed: _isBotThinking ? null : _handleSendMessage, 
            tooltip: 'Enviar mensaje',
          ),
        ],
      ),
    );
  }
} // Fin clase _ChatbotScreenState