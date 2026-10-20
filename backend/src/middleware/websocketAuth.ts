import { IncomingMessage } from 'http';
import { Duplex } from 'stream';
import { WebSocket, WebSocketServer } from 'ws';
import { authenticateToken, AuthUser } from './auth';
import { WS_CLOSE_CODES } from '../constants/shared';

// Authenticates WebSocket handshakes with the same JWT rules as authMiddleware (see authenticateToken).
// Browsers can't set headers on a WebSocket handshake, so the token comes as the `token` query parameter.
// The organization is taken from the authenticated user, never from the client.
export const createUpgradeHandler = (
  wss: WebSocketServer,
  onConnection: (ws: WebSocket, user: AuthUser) => void
) => async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
  const token = new URL(req.url || '', 'http://localhost').searchParams.get('token');

  let authenticated = null;
  try {
    authenticated = token ? await authenticateToken(token) : null;
  } catch (error) {
    console.error('WebSocket authentication error:', error);
  }

  // Rejected before the upgrade, so no WebSocket is ever opened for an unauthenticated client
  if (!authenticated) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const { user, expiresAt } = authenticated;
  wss.handleUpgrade(req, socket, head, (ws) => {
    // The token is checked only on the handshake, so the connection must not outlive it
    const expiryTimer = setTimeout(() => ws.close(WS_CLOSE_CODES.TOKEN_EXPIRED, 'Token expired'), expiresAt - Date.now());
    ws.on('close', () => clearTimeout(expiryTimer));

    onConnection(ws, user);
  });
};
