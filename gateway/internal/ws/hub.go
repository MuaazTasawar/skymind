package ws

import (
	"fmt"
	"sync"

	ws "github.com/gofiber/websocket/v2"
)

// Client represents a single connected WebSocket operator.
type Client struct {
	id   string
	conn *ws.Conn
	send chan []byte
}

// Hub manages all active WebSocket clients and routes broadcast messages.
type Hub struct {
	mu      sync.RWMutex
	clients map[string]*Client
}

// NewHub creates an initialised Hub.
func NewHub() *Hub {
	return &Hub{
		clients: make(map[string]*Client),
	}
}

// Register adds a new WebSocket client to the hub and starts its write pump.
func (h *Hub) Register(id string, conn *ws.Conn) {
	client := &Client{
		id:   id,
		conn: conn,
		send: make(chan []byte, 256),
	}

	h.mu.Lock()
	h.clients[id] = client
	h.mu.Unlock()

	fmt.Printf("[hub] client connected: %s (total: %d)\n", id, h.count())

	// Write pump — drains the send channel into the WebSocket connection.
	go func() {
		defer func() {
			h.Unregister(id)
			conn.Close()
		}()
		for msg := range client.send {
			if err := conn.WriteMessage(ws.TextMessage, msg); err != nil {
				fmt.Printf("[hub] write error for %s: %v\n", id, err)
				return
			}
		}
	}()
}

// Unregister removes a client from the hub and closes its send channel.
func (h *Hub) Unregister(id string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if client, ok := h.clients[id]; ok {
		close(client.send)
		delete(h.clients, id)
		fmt.Printf("[hub] client disconnected: %s (total: %d)\n", id, len(h.clients))
	}
}

// Broadcast sends a message to all currently connected clients.
// Slow clients are dropped rather than blocking the broadcast.
func (h *Hub) Broadcast(msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for id, client := range h.clients {
		select {
		case client.send <- msg:
		default:
			fmt.Printf("[hub] client %s send buffer full — dropping\n", id)
		}
	}
}

// ClientCount returns the number of currently connected clients.
func (h *Hub) ClientCount() int {
	return h.count()
}

func (h *Hub) count() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}
