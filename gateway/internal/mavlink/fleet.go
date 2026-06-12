package mavlink

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// Fleet manages all drone bridges and provides a single point of access
// to the live fleet state.
type Fleet struct {
	mu      sync.RWMutex
	drones  map[string]*DroneState // keyed by drone ID
	bridges map[string]*Bridge
}

// NewFleet creates an empty fleet manager.
func NewFleet() *Fleet {
	return &Fleet{
		drones:  make(map[string]*DroneState),
		bridges: make(map[string]*Bridge),
	}
}

// DroneConfig is used to register drones at startup.
type DroneConfig struct {
	ID       string
	Name     string
	SITLPort int
}

// RegisterDrone adds a drone to the fleet and starts its MAVLink bridge.
func (f *Fleet) RegisterDrone(cfg DroneConfig) {
	f.mu.Lock()
	defer f.mu.Unlock()

	state := &DroneState{
		ID:       cfg.ID,
		Name:     cfg.Name,
		SITLPort: cfg.SITLPort,
		Status:   StatusIdle,
	}

	bridge := NewBridge(state)
	f.drones[cfg.ID] = state
	f.bridges[cfg.ID] = bridge

	bridge.Start()
	fmt.Printf("[fleet] registered drone %s on port %d\n", cfg.Name, cfg.SITLPort)
}

// GetDrone returns a snapshot of a single drone's state by ID.
func (f *Fleet) GetDrone(id string) (DroneState, bool) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	state, ok := f.drones[id]
	if !ok {
		return DroneState{}, false
	}
	return state.Snapshot(), true
}

// GetAllDrones returns snapshots of all drones in the fleet.
func (f *Fleet) GetAllDrones() []DroneState {
	f.mu.RLock()
	defer f.mu.RUnlock()

	result := make([]DroneState, 0, len(f.drones))
	for _, d := range f.drones {
		result = append(result, d.Snapshot())
	}
	return result
}

// GetFaultedDrones returns drones currently in fault state.
func (f *Fleet) GetFaultedDrones() []DroneState {
	f.mu.RLock()
	defer f.mu.RUnlock()

	var faulted []DroneState
	for _, d := range f.drones {
		snap := d.Snapshot()
		if snap.Status == StatusFault {
			faulted = append(faulted, snap)
		}
	}
	return faulted
}

// GetAvailableDrones returns drones that are idle or flying (not faulted/RTL).
func (f *Fleet) GetAvailableDrones() []DroneState {
	f.mu.RLock()
	defer f.mu.RUnlock()

	var available []DroneState
	for _, d := range f.drones {
		snap := d.Snapshot()
		if snap.Status == StatusIdle || snap.Status == StatusFlying {
			available = append(available, snap)
		}
	}
	return available
}

// AssignZone sets the zone and mission assignment for a drone.
func (f *Fleet) AssignZone(droneID, zoneID, missionID string) bool {
	f.mu.RLock()
	state, ok := f.drones[droneID]
	f.mu.RUnlock()

	if !ok {
		return false
	}

	state.mu.Lock()
	state.AssignedZoneID = zoneID
	state.MissionID = missionID
	state.mu.Unlock()
	return true
}

// WatchFaults runs a background goroutine that detects newly faulted drones
// and calls onFault(droneID) so the mission layer can reassign zones.
func (f *Fleet) WatchFaults(ctx context.Context, onFault func(droneID string)) {
	go func() {
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		reported := make(map[string]bool)

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				f.mu.RLock()
				for id, d := range f.drones {
					snap := d.Snapshot()
					if snap.Status == StatusFault && !reported[id] {
						reported[id] = true
						fmt.Printf("[fleet] fault detected on drone %s — triggering reassignment\n", snap.Name)
						go onFault(id)
					}
					// Clear reported flag if drone recovers
					if snap.Status != StatusFault {
						reported[id] = false
					}
				}
				f.mu.RUnlock()
			}
		}
	}()
}

// StopAll stops all MAVLink bridges gracefully.
func (f *Fleet) StopAll() {
	f.mu.Lock()
	defer f.mu.Unlock()

	for name, bridge := range f.bridges {
		bridge.Stop()
		fmt.Printf("[fleet] stopped bridge for %s\n", name)
	}
}
