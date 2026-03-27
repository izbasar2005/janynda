package realtime

import (
	"encoding/json"
	"strconv"
	"sync"
)

// Hub is an in-memory pub/sub for websocket connections.
// room key format: "<channel>:<id>" (e.g. "group:12", "direct:55", "conversation:9", "user:7")
type Hub struct {
	mu    sync.RWMutex
	rooms map[string]map[*Client]struct{}
}

type Client struct {
	UserID uint
	Role   string
	Send   chan []byte
	// Subs tracks currently subscribed rooms to allow cleanup.
	Subs map[string]struct{}
}

func NewHub() *Hub {
	return &Hub{rooms: make(map[string]map[*Client]struct{})}
}

func RoomKey(channel string, id uint) string {
	if channel == "" || id == 0 {
		return ""
	}
	return channel + ":" + strconv.FormatUint(uint64(id), 10)
}

func (h *Hub) Subscribe(room string, c *Client) {
	if room == "" || c == nil {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	set, ok := h.rooms[room]
	if !ok {
		set = make(map[*Client]struct{})
		h.rooms[room] = set
	}
	set[c] = struct{}{}
	if c.Subs == nil {
		c.Subs = make(map[string]struct{})
	}
	c.Subs[room] = struct{}{}
}

func (h *Hub) Unsubscribe(room string, c *Client) {
	if room == "" || c == nil {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if set, ok := h.rooms[room]; ok {
		delete(set, c)
		if len(set) == 0 {
			delete(h.rooms, room)
		}
	}
	if c.Subs != nil {
		delete(c.Subs, room)
	}
}

func (h *Hub) UnsubscribeAll(c *Client) {
	if c == nil {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	for room := range c.Subs {
		if set, ok := h.rooms[room]; ok {
			delete(set, c)
			if len(set) == 0 {
				delete(h.rooms, room)
			}
		}
	}
	c.Subs = make(map[string]struct{})
}

func (h *Hub) Broadcast(room string, evt any) {
	if room == "" {
		return
	}
	b, err := json.Marshal(evt)
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.rooms[room] {
		// non-blocking: drop if slow
		select {
		case c.Send <- b:
		default:
		}
	}
}

