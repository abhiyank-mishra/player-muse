type EventCallback = (data?: any) => void;

class EventBus {
    private static listeners: Record<string, EventCallback[]> = {};

    /**
     * Subscribe to an event.
     * @param event The event name to listen for.
     * @param callback The function to invoke when the event is emitted.
     */
    static on(event: string, callback: EventCallback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    /**
     * Unsubscribe from an event.
     * @param event The event name.
     * @param callback The function to remove.
     */
    static off(event: string, callback: EventCallback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    /**
     * Emit an event to all subscribers.
     * @param event The event name.
     * @param data Optional payload to send to subscribers.
     */
    static emit(event: string, data?: any) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(cb => {
            try {
                cb(data);
            } catch (e) {
                console.error(`Error in event listener for ${event}:`, e);
            }
        });
    }
}

export default EventBus;
