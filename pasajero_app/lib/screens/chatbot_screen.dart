import 'package:flutter/material.dart';

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
  final ScrollController _scrollController = ScrollController(); // Para auto-scroll

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

  // --- Lógica Placeholder para Enviar Mensaje ---
  void _handleSendMessage() {
    final text = _textController.text.trim();
    if (text.isEmpty) return;

    // 1. Añadir mensaje del usuario
    final userMessage = ChatMessage(text: text, isUserMessage: true);
    setState(() {
      _messages.add(userMessage);
    });
    _textController.clear();
    _scrollToBottom(); // Hacer scroll hacia abajo

    // 2. Simular respuesta del Bot (Placeholder Fase 4.4)
    // En Fase 5, aquí llamaríamos a la Cloud Function
    Future.delayed(const Duration(milliseconds: 500), () {
       if (mounted) {
          final botResponse = ChatMessage(
            text: 'Recibido: "$text". La IA real responderá en la Fase 5.',
            isUserMessage: false,
          );
          setState(() {
            _messages.add(botResponse);
          });
          _scrollToBottom(); // Hacer scroll de nuevo
       }
    });
  }

  // --- Función para hacer scroll automático ---
  void _scrollToBottom() {
    // Esperar un frame para que el ListView se actualice antes de hacer scroll
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
              itemCount: _messages.length,
              itemBuilder: (context, index) {
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

  // Widget para construir cada burbuja de mensaje
  Widget _buildMessageBubble(ChatMessage message) {
    final alignment = message.isUserMessage
        ? CrossAxisAlignment.end
        : CrossAxisAlignment.start;
    final color = message.isUserMessage
        ? Theme.of(context).colorScheme.primary
        : Colors.grey[300];
    final textColor = message.isUserMessage
        ? Theme.of(context).colorScheme.onPrimary
        : Colors.black87;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4.0),
      child: Column(
        crossAxisAlignment: alignment,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 10.0),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16.0),
                topRight: const Radius.circular(16.0),
                bottomLeft: Radius.circular(message.isUserMessage ? 16.0 : 0),
                bottomRight: Radius.circular(message.isUserMessage ? 0 : 16.0),
              ),
            ),
             // Limitar ancho máximo de la burbuja
            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
            child: Text(
              message.text,
              style: TextStyle(color: textColor),
            ),
          ),
           // Opcional: Mostrar timestamp debajo
          // Padding(
          //   padding: const EdgeInsets.only(top: 2.0, left: 8.0, right: 8.0),
          //   child: Text(
          //      DateFormat('HH:mm').format(message.timestamp), // Necesita paquete intl
          //      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey),
          //    ),
          // ),
        ],
      ),
    );
  }

  // Widget para el área de entrada de texto
  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 8.0),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        boxShadow: [
          BoxShadow(
            offset: const Offset(0, -1),
            blurRadius: 2,
            color: Colors.black.withOpacity(0.1),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _textController,
              decoration: const InputDecoration(
                hintText: 'Escribe tu pregunta...',
                border: InputBorder.none, // Quitar borde por defecto
                contentPadding: EdgeInsets.symmetric(horizontal: 12.0),
              ),
              textInputAction: TextInputAction.send, // Tecla "Enviar" en teclado
              onSubmitted: (_) => _handleSendMessage(), // Enviar al presionar Enter/Enviar
               minLines: 1,
               maxLines: 5, // Permitir múltiples líneas
            ),
          ),
          IconButton(
            icon: const Icon(Icons.send),
            onPressed: _handleSendMessage,
            tooltip: 'Enviar mensaje',
          ),
        ],
      ),
    );
  }
}