package mavlink

import (
	"bufio"
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"net"
	"sync"
	"time"
)

const (
	heartbeatTimeout = 5 * time.Second
	reconnectDelay   = 3 * time.Second
	telemetryHz      = 2 // target telemetry read rate
)

// MAVLink message IDs we care about (subset of MAVLink 1 common messages).
const (
	msgIDHeartbeat         = 0
	msgIDSysStatus         = 1
	msgIDGlobalPositionInt = 33
	msgIDAttitude          = 30
	msgIDVFRHud            = 74
	msgIDBatteryStatus     = 147
	msgIDMissionCurrent    = 42
	msgIDMissionCount      = 44
)

// Bridge manages the TCP connection to a single SITL instance and
// parses incoming MAVLink 1 frames into the drone's state.
type Bridge struct {
	drone  *DroneState
	ctx    context.Context
	cancel context.CancelFunc
	mu     sync.Mutex
	conn   net.Conn
}

// NewBridge creates a bridge for the given drone but does not connect yet.
func NewBridge(drone *DroneState) *Bridge {
	ctx, cancel := context.WithCancel(context.Background())
	return &Bridge{drone: drone, ctx: ctx, cancel: cancel}
}

// Start begins the connection loop in a background goroutine.
func (b *Bridge) Start() {
	go b.connectLoop()
}

// Stop cancels the context and closes the connection.
func (b *Bridge) Stop() {
	b.cancel()
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.conn != nil {
		b.conn.Close()
	}
}

// connectLoop dials the SITL TCP port and re-dials on any error.
func (b *Bridge) connectLoop() {
	addr := fmt.Sprintf("127.0.0.1:%d", b.drone.SITLPort)
	for {
		select {
		case <-b.ctx.Done():
			return
		default:
		}

		fmt.Printf("[bridge] connecting to %s (%s)...\n", b.drone.Name, addr)
		conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
		if err != nil {
			fmt.Printf("[bridge] %s dial error: %v — retrying in %s\n", b.drone.Name, err, reconnectDelay)
			b.drone.SetFault()
			select {
			case <-b.ctx.Done():
				return
			case <-time.After(reconnectDelay):
			}
			continue
		}

		b.mu.Lock()
		b.conn = conn
		b.mu.Unlock()

		b.drone.mu.Lock()
		b.drone.Connected = true
		b.drone.LastHeartbeat = time.Now()
		b.drone.mu.Unlock()

		fmt.Printf("[bridge] %s connected\n", b.drone.Name)
		b.readLoop(conn)

		b.drone.SetFault()
		fmt.Printf("[bridge] %s disconnected — reconnecting...\n", b.drone.Name)

		select {
		case <-b.ctx.Done():
			return
		case <-time.After(reconnectDelay):
		}
	}
}

// readLoop reads MAVLink 1 frames from the connection and updates drone state.
func (b *Bridge) readLoop(conn net.Conn) {
	reader := bufio.NewReader(conn)

	// Heartbeat watchdog
	watchdog := time.NewTicker(heartbeatTimeout)
	defer watchdog.Stop()

	frameCh := make(chan mavFrame, 64)

	// Parse frames in a separate goroutine so watchdog is always checked.
	go func() {
		for {
			frame, err := readMAVLink1Frame(reader)
			if err != nil {
				if err != io.EOF {
					fmt.Printf("[bridge] %s read error: %v\n", b.drone.Name, err)
				}
				close(frameCh)
				return
			}
			frameCh <- frame
		}
	}()

	for {
		select {
		case <-b.ctx.Done():
			conn.Close()
			return

		case <-watchdog.C:
			if b.drone.IsHeartbeatStale(heartbeatTimeout) {
				fmt.Printf("[bridge] %s heartbeat timeout\n", b.drone.Name)
				conn.Close()
				return
			}

		case frame, ok := <-frameCh:
			if !ok {
				return
			}
			b.applyFrame(frame)
		}
	}
}

// mavFrame is a parsed MAVLink 1 message.
type mavFrame struct {
	msgID   uint8
	payload []byte
}

// readMAVLink1Frame reads exactly one MAVLink 1 frame from the reader.
// MAVLink 1 format: 0xFE | len(1) | seq(1) | sysid(1) | compid(1) | msgid(1) | payload(len) | cksum(2)
func readMAVLink1Frame(r *bufio.Reader) (mavFrame, error) {
	for {
		b, err := r.ReadByte()
		if err != nil {
			return mavFrame{}, err
		}
		if b != 0xFE {
			continue // scan for start byte
		}

		header := make([]byte, 5)
		if _, err := io.ReadFull(r, header); err != nil {
			return mavFrame{}, err
		}

		payloadLen := int(header[0])
		msgID := header[4]

		payload := make([]byte, payloadLen+2) // +2 for checksum
		if _, err := io.ReadFull(r, payload); err != nil {
			return mavFrame{}, err
		}

		return mavFrame{msgID: msgID, payload: payload[:payloadLen]}, nil
	}
}

// applyFrame updates the drone state based on the MAVLink message ID.
func (b *Bridge) applyFrame(f mavFrame) {
	b.drone.mu.Lock()
	defer b.drone.mu.Unlock()

	switch f.msgID {
	case msgIDHeartbeat:
		b.drone.LastHeartbeat = time.Now()
		b.drone.Connected = true
		if len(f.payload) >= 6 {
			baseMode := f.payload[4]
			b.drone.Armed = (baseMode & 0x80) != 0
			// Update status based on arm state
			if b.drone.Armed && b.drone.Status == StatusIdle {
				b.drone.Status = StatusArmed
			} else if !b.drone.Armed {
				b.drone.Status = StatusIdle
			}
		}

	case msgIDGlobalPositionInt:
		// lat(4) lon(4) alt(4) relative_alt(4) vx(2) vy(2) vz(2) hdg(2)
		if len(f.payload) < 18 {
			return
		}
		lat := int32(binary.LittleEndian.Uint32(f.payload[0:4]))
		lon := int32(binary.LittleEndian.Uint32(f.payload[4:8]))
		relAlt := int32(binary.LittleEndian.Uint32(f.payload[12:16]))
		hdg := binary.LittleEndian.Uint16(f.payload[16:18])

		b.drone.Lat = float64(lat) / 1e7
		b.drone.Lng = float64(lon) / 1e7
		b.drone.Alt = float64(relAlt) / 1000.0
		b.drone.Heading = float64(hdg) / 100.0

		if b.drone.Alt > 0.5 && b.drone.Armed {
			b.drone.Status = StatusFlying
		}

	case msgIDAttitude:
		// time_boot(4) roll(4) pitch(4) yaw(4) rollspeed(4) pitchspeed(4) yawspeed(4)
		if len(f.payload) < 16 {
			return
		}
		rollRaw := math.Float32frombits(binary.LittleEndian.Uint32(f.payload[4:8]))
		pitchRaw := math.Float32frombits(binary.LittleEndian.Uint32(f.payload[8:12]))
		yawRaw := math.Float32frombits(binary.LittleEndian.Uint32(f.payload[12:16]))

		b.drone.Roll = float64(rollRaw) * 180.0 / math.Pi
		b.drone.Pitch = float64(pitchRaw) * 180.0 / math.Pi
		b.drone.Yaw = float64(yawRaw) * 180.0 / math.Pi

	case msgIDVFRHud:
		// airspeed(4) groundspeed(4) alt(4) climb(4) heading(2) throttle(2)
		if len(f.payload) < 14 {
			return
		}
		airspeed := math.Float32frombits(binary.LittleEndian.Uint32(f.payload[0:4]))
		groundspeed := math.Float32frombits(binary.LittleEndian.Uint32(f.payload[4:8]))
		climb := math.Float32frombits(binary.LittleEndian.Uint32(f.payload[12:16]))

		b.drone.Airspeed = float64(airspeed)
		b.drone.Groundspeed = float64(groundspeed)
		b.drone.ClimbRate = float64(climb)

	case msgIDSysStatus:
		// voltage_battery(2) at offset 14
		if len(f.payload) < 22 {
			return
		}
		volt := binary.LittleEndian.Uint16(f.payload[14:16])
		remaining := int8(f.payload[21])
		b.drone.BatteryVolt = float64(volt) / 1000.0
		if remaining >= 0 {
			b.drone.BatteryPct = int(remaining)
		}

		// Battery failsafe — trigger fault if below 20%
		if b.drone.BatteryPct > 0 && b.drone.BatteryPct < 20 {
			b.drone.Status = StatusFault
			fmt.Printf("[bridge] %s battery failsafe triggered (%d%%)\n", b.drone.Name, b.drone.BatteryPct)
		}

	case msgIDMissionCurrent:
		if len(f.payload) >= 2 {
			b.drone.WaypointIndex = int(binary.LittleEndian.Uint16(f.payload[0:2]))
		}

	case msgIDMissionCount:
		if len(f.payload) >= 2 {
			b.drone.WaypointTotal = int(binary.LittleEndian.Uint16(f.payload[0:2]))
		}
	}
}
