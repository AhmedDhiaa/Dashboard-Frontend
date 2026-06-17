# SignalR Tracking Hooks - Usage Examples

## Overview

The SignalR tracking hooks provide an easy, clean way to connect to real-time tracking groups with automatic lifecycle management.

## Hooks

### 1. `useTicketTracking` - Ticket Message Tracking

Track ticket messages in real-time.

```typescript
import { useTicketTracking } from '@/infra/socket';

function TicketDetailPage({ ticketId }: { ticketId: string }) {
  const {
    joinTicketGroup,
    leaveTicketGroup,
    currentTicketId,
    isTracking,
    latestMessage,
  } = useTicketTracking({
    ticketId, // Auto-joins on mount
    onReceiveTicketMessage: (message) => {
      console.log('New message:', message);
      // Update UI, show notification, etc.
    },
  });

  // Or join manually
  const handleJoin = () => {
    joinTicketGroup('some-ticket-id');
  };

  return (
    <div>
      <p>Tracking: {isTracking ? 'Yes' : 'No'}</p>
      {latestMessage && <div>{latestMessage.content}</div>}
    </div>
  );
}
```

### 2. `useOrderTracking` - Order & Driver Tracking

Track order status and driver location updates.

```typescript
import { useOrderTracking } from '@/infra/socket';

function OrderTrackingPage({ orderId }: { orderId: string }) {
  const {
    joinOrderTrackingGroup,
    leaveOrderTrackingGroup,
    currentOrderId,
    isTracking,
    latestOrderTracking,
    latestDriverTracking,
  } = useOrderTracking({
    orderId, // Auto-joins on mount
    onReceiveOrderTracking: (tracking) => {
      console.log('Order update:', tracking.status);
      // Update order status in UI
    },
    onReceiveDriverOrderTracking: (tracking) => {
      console.log('Driver location:', tracking.location);
      // Update driver marker on map
    },
  });

  return (
    <div>
      <h2>Order Status: {latestOrderTracking?.status}</h2>
      {latestDriverTracking && (
        <p>
          Driver: {latestDriverTracking.driverName} at 
          ({latestDriverTracking.location.lat}, {latestDriverTracking.location.lng})
        </p>
      )}
    </div>
  );
}
```

### 3. `useDriverTracking` - Global Driver Tracking

Track all active drivers on a live map.

```typescript
import { useDriverTracking } from '@/infra/socket';

function LiveDriverMap() {
  const {
    joinDriverTrackingGroup,
    leaveDriverTrackingGroup,
    isTracking,
    driverLocations,
    latestDriverTracking,
  } = useDriverTracking({
    autoJoin: true, // Auto-joins on mount
    throttleMs: 500, // Throttle updates to prevent too many re-renders
    onReceiveDriverTracking: (tracking) => {
      console.log('Driver moved:', tracking.driverId);
    },
  });

  return (
    <div>
      <h2>Active Drivers: {driverLocations.size}</h2>
      <Map>
        {Array.from(driverLocations.values()).map((driver) => (
          <Marker
            key={driver.driverId}
            position={driver.location}
            status={driver.status}
          />
        ))}
      </Map>
    </div>
  );
}
```

### 4. `useGroupTracking` - Generic Group Tracking

For custom tracking scenarios.

```typescript
import { useGroupTracking } from '@/infra/socket';

function CustomTracking() {
  const { join, leave, isInGroup } = useGroupTracking({
    groupName: 'CustomGroup_123',
    eventName: 'ReceiveCustomEvent',
    onEvent: (data) => {
      console.log('Custom event:', data);
    },
    autoJoin: true,
  });

  return <div>Tracking: {isInGroup ? 'Yes' : 'No'}</div>;
}
```

## Features

✅ **Automatic Lifecycle Management** - Auto-join on mount, auto-leave on unmount  
✅ **Reconnection Handling** - Automatically rejoins groups after reconnection  
✅ **Type Safety** - Full TypeScript support with generics  
✅ **Performance Optimized** - Memoized callbacks, throttling support  
✅ **Clean API** - Simple, intuitive interface  
✅ **Error Handling** - Built-in error callbacks

## Server Methods Called

- `JoinTicketGroup(ticketId: Guid)` → Joins ticket-specific group
- `JoinOrderTrackingGroup(orderId: Guid)` → Joins order-specific group
- `JoinDriverTrackingGroup()` → Joins global driver tracking group

## Events Received

- `ReceiveTicketMessage` → Ticket message updates
- `ReceiveOrderTracking` → Order status updates
- `ReceiveDriverOrderTracking` → Driver location for specific order
- `ReceiveDriverTracking` → Global driver location updates
