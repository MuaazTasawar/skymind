package telemetry

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/MuaazTasawar/skymind/gateway/internal/mavlink"
	"github.com/MuaazTasawar/skymind/gateway/internal/ws"
)

const broadcastInterval = 500 * time.Millisecond // 2 Hz

// Broadcaster reads fleet state at a fixed interval and pushes
// serialised FleetSnapshot messages to the WebSocket hub.
type Broadcaster struct {
	fleet *mavlink.Fleet
	hub   *ws.Hub
}

// NewBroadcaster creates a Broadcaster bound to the given fleet and hub.
func NewBroadcaster(fleet *mavlink.Fleet, hub *ws.Hub) *Broadcaster {
	return &Broadcaster{fleet: fleet, hub: hub}
}

// Start launches the broadcast loop in a background goroutine.
// It stops cleanly when ctx is cancelled.
func (b *Broadcaster) Start(ctx context.Context) {
	go b.loop(ctx)
}

func (b *Broadcaster) loop(ctx context.Context) {
	ticker := time.NewTicker(broadcastInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			fmt.Println("[broadcaster] stopped")
			return

		case <-ticker.C:
			snapshot := FleetSnapshot{
				Timestamp: time.Now().UTC(),
				Drones:    b.fleet.GetAllDrones(),
			}

			msg := WSMessage{
				Type:    EventTelemetry,
				Payload: snapshot,
			}

			data, err := json.Marshal(msg)
			if err != nil {
				fmt.Printf("[broadcaster] marshal error: %v\n", err)
				continue
			}

			b.hub.Broadcast(data)
		}
	}
}

// SendEvent pushes a one-off event message (fault, reassignment, etc.)
// to all connected WebSocket clients immediately.
func (b *Broadcaster) SendEvent(eventType EventType, payload interface{}) {
	msg := WSMessage{Type: eventType, Payload: payload}
	data, err := json.Marshal(msg)
	if err != nil {
		fmt.Printf("[broadcaster] event marshal error: %v\n", err)
		return
	}
	b.hub.Broadcast(data)
}
